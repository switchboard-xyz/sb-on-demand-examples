import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  InstructionUtils,
  PullFeed,
  Queue,
  RecentSlotHashes,
  sleep,
} from "@switchboard-xyz/on-demand";
import * as anchor from "@coral-xyz/anchor";
import { SwitchboardSecrets, OracleJob } from "@switchboard-xyz/common"; 
import { createHash } from "crypto";
import nacl from "tweetnacl";
import * as fs from "fs";
import * as shell from "shelljs";
import resolve from "resolve-dir";
import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
  } from "@solana/web3.js";
import dotenv from "dotenv";

function loadDefaultKeypair() {
    const command =
      'solana config get | grep "Keypair Path" | awk -F " " \'{ print $3 }\'';
    const res = shell.exec(command, { async: false }).stdout.trim();
    const payerJson = new Uint8Array(
      JSON.parse(fs.readFileSync(resolve(res), "utf8"))
    );
    return Keypair.fromSecretKey(payerJson);
  }

  function buildOpenWeatherAPI(city: String, secretName: String): OracleJob {
    const tasks = [
      OracleJob.Task.create({
        httpTask: OracleJob.HttpTask.create({
          url: `https://api.openweathermap.org/data/2.5/weather?q=${city},us&appid=${secretName}&units=metric`,
        }),
      }),
      OracleJob.Task.create({
        jsonParseTask: OracleJob.JsonParseTask.create({ path: "$.main.temp" }),
      }),
    ];
    return OracleJob.create({ tasks });
  }

(async () => {
    dotenv.config();
    const PID = sb.SB_ON_DEMAND_PID;
    const API_KEY = process.env.OPEN_WEATHER_API_KEY;
    const queue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
    const myKeypair = loadDefaultKeypair();
    const wallet = new anchor.Wallet(myKeypair);
    const connection = new Connection(
        "https://api.devnet.solana.com",
        "confirmed"
      );
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    const idl = (await anchor.Program.fetchIdl(PID, provider))!;
    const program = new anchor.Program(idl, PID, provider);
    
    const sbSecrets = new SwitchboardSecrets();
    console.log("\n🔒 Step 1: Creating the User for Secrets");
    try {
        const user = await sbSecrets.getUser(wallet.publicKey.toBase58(),"ed25519");
        console.log("User found",user);
    } catch (error) {
        console.log("User not found, creating user");
        const payload = await sbSecrets.createOrUpdateUserRequest(wallet.publicKey.toBase58(),"ed25519","");
        const signature = nacl.sign.detached(
            new Uint8Array(payload.toEncodedMessage()),
            wallet.payer.secretKey
          );
        const user = await sbSecrets.createOrUpdateUser(
            payload,
            Buffer.from(signature).toString("base64")
          );
        console.log("User created",user);
    }
    const secretName = "OPEN_WEATHER_API_KEY_TEST";
    const secretValue =  API_KEY ?? "API_KEY_NOT_FOUND";
    console.log("\n🔒 Step 2: Checking and Creating the Secret");

    const userSecrets = await sbSecrets.getUserSecrets(wallet.publicKey.toBase58(), "ed25519");
    console.log("User Secrets",userSecrets)
    const existingSecret = userSecrets.find(secret => secret.secret_name === secretName);
    
    if (existingSecret) {
        console.log(`Secret '${secretName}' already exists. No need to create.`);
      } else {
        console.log(`Secret '${secretName}' not found. Creating now...`);
        const secretRequest = sbSecrets.createSecretRequest(
            wallet.publicKey.toBase58(),
            "ed25519", 
            secretName, 
            secretValue
        );
        const secretSignature = nacl.sign.detached(
            new Uint8Array(secretRequest.toEncodedMessage()),
            wallet.payer.secretKey
        );
        const secret = await sbSecrets.createSecret(
            secretRequest,
            Buffer.from(secretSignature).toString("base64")
        );
        console.log("Secret created:", secret);
    }
    
    // const feedKp = Keypair.generate();
    // console.log("feed secret key",feedKp.secretKey.toString());

    const feedSecret = process.env.FEED_SK;
    const feedSecretKey = JSON.parse(feedSecret|| "");
    const feedKeypair = Keypair.fromSecretKey(new Uint8Array(feedSecretKey));
    if (!feedKeypair) {
        console.error("Invalid feed secret key");
        return;
    }
    const pullFeed = new PullFeed(program , feedKeypair.publicKey);
    // config for the feed
    const conf: any = {
        queue,
        jobs: [buildOpenWeatherAPI("Aspen", "OPEN_WEATHER_API_KEY_TEST")],
        maxVariance: 1.0,
        minResponses: 1,
        numSignatures: 1,
        
      };
    
    while (true) {
        try {
            conf.feedHash = await Queue.fetchFeedHash(program, conf);
            console.log("Successfully fetched Feed Hash:", conf.feedHash);
            break
        } catch (error) {
            console.error(`Feed fetch attempt retry....`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
        }
    }

    // const deleteSecret = await sbSecrets.createDeleteSecretRequest(wallet.publicKey.toBase58(), "ed25519", secretName);
    // console.log("Delete Secret Request",deleteSecret);
    // const deleteSecretSignature = nacl.sign.detached(
    //     new Uint8Array(deleteSecret.toEncodedMessage()),
    //     wallet.payer.secretKey
    // );
    // const deletedSecret = await sbSecrets.deleteSecret(deleteSecret, Buffer.from(deleteSecretSignature).toString("base64"));
    // console.log("Deleted Secret",deletedSecret);
    // const getSecret = await sbSecrets.getUserSecrets(wallet.publicKey.toString(), "ed25519");
    // console.log("Secrets: ",getSecret);
    const addwhitelist = await sbSecrets.createAddMrEnclaveRequest(wallet.payer.publicKey.toBase58(), "ed25519", conf.feedHash , [secretName]);
    const whitelistSignature = nacl.sign.detached(
        new Uint8Array(addwhitelist.toEncodedMessage()),
        wallet.payer.secretKey
    );
    const sendwhitelist = await sbSecrets.addMrEnclave(
        addwhitelist, 
        Buffer.from(whitelistSignature).toString("base64"));
    
    console.log("sendwhitelist",sendwhitelist);
    const getuserSecrets = await sbSecrets.getUserSecrets(wallet.payer.publicKey.toBase58(), "ed25519");
    console.log("getuserSecrets",getuserSecrets)

})();