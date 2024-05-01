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
  const queue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
  const queueAccount = new Queue(program, queue);
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  const wallet = new anchor.Wallet(keypair)
  const path = "target/deploy/sb_on_demand_solana-keypair.json";
  const myProgramKeypair = await AnchorUtils.initKeypairFromFile(path);
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
  };

  const secretName = "OPEN_WEATHER_API_KEY";
  const API_KEY = process.env.OPEN_WEATHER_API_KEY;
  const secretValue = API_KEY ?? "API_KEY_NOT_FOUND";
  const conf = {
    // the feed name (max 32 bytes)
    name: "Test Secret",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [
      OracleJob.fromObject({
      tasks: [
        {
          secretsTask: {
            authority: keypair.publicKey.toBase58(),
            url: "https://api.secrets.switchboard.xyz"
          }
        },
        {
          httpTask: {
            url: `https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${secretName}&units=metric`,
          }
        },
        {
          jsonParseTask: {
            path: "$.main.temp"
          }   
        },
        {
          valueTask: {
            big: "120"
          } 
        } 
      ]
    })
  //  buildCoinbaseJob("BTC-USD"),
   //buildBinanceComJob("USDTBTC")
  // buildOpenWeatherAPI("aspen", secretName)
  ],
    // allow 1% variance between submissions and jobs
    maxVariance: 1.0,
    // minimum number of responses of jobs to allow
    minResponses: 1,
    // number of signatures to fetch per update
    numSignatures: 3,
  };

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

  // start of secrets.. 
  const sbSecrets = new SwitchboardSecrets();
  console.log("\n🔒 Step 1: Creating the User for Secrets");
  try {
    const user = await sbSecrets.getUser(keypair.publicKey.toBase58(), "ed25519");
    console.log("User found", user);
  } catch (error) {
    console.log("User not found, creating user");
    const payload = await sbSecrets.createOrUpdateUserRequest(keypair.publicKey.toBase58(), "ed25519", "");
    const signature = nacl.sign.detached(
      new Uint8Array(payload.toEncodedMessage()),
      wallet.payer.secretKey
    );
    const user = await sbSecrets.createOrUpdateUser(
      payload,
      Buffer.from(signature).toString("base64")
    );
    console.log("User created", user);
  }

  console.log("\n🔒 Step 2: Checking and Creating the Secret");

  const userSecrets = await sbSecrets.getUserSecrets(wallet.publicKey.toBase58(), "ed25519");
  console.log("User Secrets", userSecrets)
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

  // const testSignatures = await Queue.fetchSignatures(program,conf);
  // console.log("Test Signatures", testSignatures);
  // // no need to set pullfeed configs with feedhash.. does it already when init a feed
  // const test_pullFeed = await pullFeed.loadData();
  //const feed_hash = Array.from(new Uint8Array(test_pullFeed.feedHash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  //console.log("Feed Hash", feed_hash);
  const feed_hash = FeedHash.compute(queue.toBuffer(), conf.jobs);
  console.log("Feed Hash", feed_hash.toString("hex"));

  // now add feed hash to the whitelist of the secret
  const addwhitelist = await sbSecrets.createAddMrEnclaveRequest(wallet.payer.publicKey.toBase58(), "ed25519", feed_hash.toString('hex'), [secretName]);
  const whitelistSignature = nacl.sign.detached(
    new Uint8Array(addwhitelist.toEncodedMessage()),
    wallet.payer.secretKey
  );
  const sendwhitelist = await sbSecrets.addMrEnclave(
    addwhitelist,
    Buffer.from(whitelistSignature).toString("base64"));

  console.log("sendwhitelist", sendwhitelist);
  
  const userSecrets2 = await sbSecrets.getUserSecrets(wallet.publicKey.toBase58(), "ed25519");
  console.log("User Secrets", userSecrets2)

  // Send a price update with a following user instruction every N seconds
  const interval = 500; // ms
  while (true) {
    // Fetch the price update instruction and report the selected oracles
    const [priceUpdateIx, oracles] = await pullFeed.fetchUpdateIx(conf);

    // Load the lookup tables
    const luts = oracles.map((x) => x.loadLookupTable());
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

    // Parse the tx logs to get the price on chain
    const simPrice = +sim.value.logs.join().match(/price:\s*"(\d+(\.\d+)?)/)[1];
    console.log(`${conf.name} price update:`, simPrice);
    console.log("\tTransaction sent: ", sig);
    await sleep(interval);
  }
})();


function buildOpenWeatherAPI(city: String, secretName: String): OracleJob {
  const tasks = [
    OracleJob.Task.create({
      secretsTask: OracleJob.SecretsTask.create({
          authority: "something",
          url: "somethingElse",
      }),
    }),
    OracleJob.Task.create({
      httpTask: OracleJob.HttpTask.create({
        url: `https://api.openweathermap.org/data/2.5/weather?q=${city},us&appid=${secretName}&units=metric`,
      }),
    }),
    OracleJob.Task.create({
      jsonParseTask: OracleJob.JsonParseTask.create({ path: "$.main.temp" }),
    }),
    // {
    //   secretsTask: {
    //     authority: .publicKey.toBase58(),
    //     url: "https://api.secrets.switchboard.xyz"
    //   }
    // },
    // {
    //   valueTask: {
    //     big: "120"
    //   } 
    // } 
  ];
  return OracleJob.create({ tasks });
}