import { Connection, Keypair, PublicKey, Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  InstructionUtils,
  PullFeed,
  Queue,
  sleep,
} from "@switchboard-xyz/on-demand";
import { SwitchboardSecrets, OracleJob, FeedHash } from "@switchboard-xyz/common";
import {
  myAnchorProgram,
  buildCoinbaseJob,
  buildBinanceComJob,
  buildSanctumFairPriceJob,
  buildPythnetJob,
  sendAndConfirmTx,
} from "./utils";
import yargs from "yargs";
import * as anchor from "@coral-xyz/anchor";
import dotenv from "dotenv";
import nacl from "tweetnacl";

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
}).argv;

async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

(async function main() {
  dotenv.config();
  // Devnet default queue (cli configs must be set to devnet)
  const { keypair, connection, provider, program } =
    await AnchorUtils.loadEnv();
  const queue = new PublicKey("FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di");
  const queueAccount = new Queue(program, queue);
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  const path = "target/deploy/sb_on_demand_solana-keypair.json";
  const myProgramKeypair = await AnchorUtils.initKeypairFromFile(path);
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
  };

  // secrets start
  const secretNameTask = "${OPEN_WEATHER_API_KEY}"
  const secretName = "OPEN_WEATHER_API_KEY";
  // Pull in API Key from .env file
  const API_KEY = process.env.OPEN_WEATHER_API_KEY;
  const secretValue = API_KEY ?? "API_KEY_NOT_FOUND";
  console.log("API_KEY", secretValue);

  console.log("\n🔒 Step 1: Creating the User profile to store secrets");
  // start of secrets.. 
  const sbSecrets = new SwitchboardSecrets();
  try {
    const user = await sbSecrets.getUser(keypair.publicKey.toBase58(), "ed25519");
    console.log("User found", user);
  } catch (error) {
    console.log("User not found, creating user");
    const payload = await sbSecrets.createOrUpdateUserRequest(keypair.publicKey.toBase58(), "ed25519", "");
    const signature = nacl.sign.detached(
      new Uint8Array(payload.toEncodedMessage()),
      keypair.secretKey
    );
    const user = await sbSecrets.createOrUpdateUser(
      payload,
      Buffer.from(signature).toString("base64")
    );
    console.log("User created", user);
  }

  console.log("\n🔒 Step 2: Checking and Creating the Secret");

  const userSecrets = await sbSecrets.getUserSecrets(keypair.publicKey.toBase58(), "ed25519");
  console.log("User secrets found", userSecrets);
  const existingSecret = userSecrets.find(secret => secret.secret_name === secretName);

  if (existingSecret) {
    console.log(`Secret '${secretName}' already exists. No need to create.`);
  } else {
    console.log(`Secret '${secretName}' not found. Creating now...`);
    const secretRequest = sbSecrets.createSecretRequest(
      keypair.publicKey.toBase58(),
      "ed25519",
      secretName,
      secretValue
    );
    const secretSignature = nacl.sign.detached(
      new Uint8Array(secretRequest.toEncodedMessage()),
      keypair.secretKey
    );
    const secret = await sbSecrets.createSecret(
      secretRequest,
      Buffer.from(secretSignature).toString("base64")
    );
    console.log("Secret created:", secret);
  }



  const conf = {
    // the feed name (max 32 bytes)
    name: "Feed secret Test 3",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [OracleJob.fromObject({
        tasks: [
          {
            secretsTask: {
              authority: keypair.publicKey.toBase58(),
              url: "https://api.secrets.switchboard.xyz"
            }
          },
          {
            httpTask: {
              url: `https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${secretNameTask}&units=metric`,
            }
          },
          {
            jsonParseTask: {
              path: "$.main.temp"
            }
          },
          // {
          //   valueTask: {
          //     big: "120"
          //   } 
          // } 
        ]
      })
    ],
    // allow 1% variance between submissions and jobs
    maxVariance: 1.0,
    // minimum number of responses of jobs to allow
    minResponses: 1,
    // number of signatures to fetch per update
    numSignatures: 3,
  };

  const feed_hash = FeedHash.compute(queue.toBuffer(), conf.jobs);
  console.log("Generate Feed with Feed Hash : ", feed_hash.toString("hex"));

  // Initialize the feed if needed
  let pullFeed: PullFeed;
  if (argv.feed === undefined) {
    // Generate the feed keypair
    const [pullFeed_, feedKp] = PullFeed.generate(program);
    const tx = await pullFeed_.initTx(program, conf);
    const sig = await sendAndConfirmTx(connection, tx, [keypair, feedKp]);
    console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
    pullFeed = pullFeed_;
  } else {
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  // add to whitelist the feed hash
  const addWhitelist = await sbSecrets.createAddMrEnclaveRequest(keypair.publicKey.toBase58(), "ed25519", feed_hash.toString('hex'), [secretName]);
  const whitelistSignature = nacl.sign.detached(
    new Uint8Array(addWhitelist.toEncodedMessage()),
    keypair.secretKey
  );
  const sendWhitelist = await sbSecrets.addMrEnclave(
    addWhitelist,
    Buffer.from(whitelistSignature).toString("base64")
  );

  console.log("Whitelist added", sendWhitelist);
  const userSecrets2 = await sbSecrets.getUserSecrets(keypair.publicKey.toBase58(), "ed25519");
  console.log("User secrets found", userSecrets2);

  // Send a price update with a following user in struction every N seconds
  const interval = 1000; // ms
  console.log("Starting metric update loop");
  while (true) {
    // Fetch the price update instruction and report the selected oracles
    const [priceUpdateIx, oracleResponses, numSuccess] =
      await pullFeed.fetchUpdateIx(conf);
    if (numSuccess === 0) {
      console.log("No metric update available");
      console.log(
        "\tErrors:",
        oracleResponses.map((x) => x.error)
      );
      return;
    }

    // Load the lookup tables
    const luts = oracleResponses.map((x) => x.oracle.loadLookupTable());
    luts.push(pullFeed.loadLookupTable());

    // Construct the transaction
    const tx = await InstructionUtils.asV0Tx(
      program,
      [priceUpdateIx, await myProgramIx(myProgram, pullFeed.pubkey)],
      await Promise.all(luts)
    );
    tx.sign([keypair]);

    // Simulate the transaction to get the price and send the tx
    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);
    console.log(`${conf.name} update:`, sim);
    console.log("\tTransaction sent: ", sig);
    // Parse the tx logs to get the price on chain
    //const simPrice = +sim.value.logs.join().match(/price:\s*"(\d+(\.\d+)?)/)[1];
    //console.log(`${conf.name} price update:`, simPrice);
    

   
    await sleep(interval);
  }
})();
