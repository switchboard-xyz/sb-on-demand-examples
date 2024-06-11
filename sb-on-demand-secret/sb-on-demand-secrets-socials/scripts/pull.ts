import { PublicKey, Commitment } from "@solana/web3.js";
import {
  AnchorUtils,
  InstructionUtils,
  PullFeed,
  Queue,
  sleep,
} from "@switchboard-xyz/on-demand";
import { SwitchboardSecrets, FeedHash } from "@switchboard-xyz/common";
import {
  myAnchorProgram,
  sendAndConfirmTx,
  ensureUserExists,
  ensureSecretExists,
  whitelistFeedHash, buildTwitterJob
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
    setTimeout: 10000,
  };

  // secrets start
  const secretNameTask = "${BEARER_TOKEN_2}"
  const secretName = "BEARER_TOKEN_2";
  // Pull in API Key from .env file
  const API_KEY = process.env.BEARER_TOKEN;
  const secretValue = API_KEY ?? "API_KEY_NOT_FOUND";
  console.log("\n🔒 Step 1: Creating the User profile to store secrets");

  // start of secrets
  // check if user exists, if not create user profile
  const sbSecrets = new SwitchboardSecrets();
  const user = await ensureUserExists(sbSecrets, keypair, nacl);

  console.log("\n🔒 Step 2: Checking and Creating the Secret");
  const secret = await ensureSecretExists(sbSecrets, keypair, nacl, secretName, secretValue);

  console.log("\n🔒 Step 3: Building Feed Configuration");
  // configure the feed
  const conf = {
    // the feed name (max 32 bytes)
    name: "Twitter Follower Count @Astewart1510",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    //jobs: [buildSecretsJob(secretNameTask, keypair)],
    jobs: [
      buildTwitterJob(secretNameTask, keypair)
    ],
    // allow 1% variance between submissions and jobs
    maxVariance: 1.0,
    // minimum number of responses of jobs to allow
    minResponses: 1,
    // number of signatures to fetch per update
    numSignatures: 3,
  };

  const feed_hash = FeedHash.compute(queue.toBuffer(), conf.jobs);
  console.log("Feed Hash = ", feed_hash.toString("hex"));

  console.log("\n🔒 Step 4: Initialise Secret Feed");
  // Initialize the feed if needed
  let pullFeed: PullFeed;
  if (argv.feed === undefined) {
    const [pullFeed_, feedKp] = PullFeed.generate(program);
    const tx = await InstructionUtils.asV0TxWithComputeIxs(
      program,
      [await pullFeed_.initIx(conf)],
      1.2, // The compute units to cap the tx as a multiple of the simulated units consumed (e.g. 1.25x)
      75_000 // The price per compute unit in microlamports
    );
    tx.sign([keypair, feedKp]);

    // Simulate the transaction to get the price and send the tx
    await connection.simulateTransaction(tx, txOpts);
    console.log("Sending initialize transaction");
    const sig = await connection.sendTransaction(tx, txOpts);
    await connection.confirmTransaction(sig, "processed");
    console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
    pullFeed = pullFeed_;
  } else {
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  console.log("\n🔒 Step 5: Whitelist the feed hash to the secret");
  const whitelistConfirmation = await whitelistFeedHash(sbSecrets, keypair, nacl, feed_hash, secretName);

  // Send a temp update with a following user in struction every N seconds
  console.log("\n🔒 Step 6: Run the Feed Update Loop..");
  const interval = 3000; // ms
  while (true) {
    let maybePriceUpdateIx;
    try {
      maybePriceUpdateIx = await pullFeed.fetchUpdateIx(conf);
    } catch (err) {
      console.error("Failed to fetch update instruction");
      console.error(err);
      await sleep(interval);
      continue;
    }
    // Fetch the social update instruction and report the selected oracles
    const [priceUpdateIx, oracleResponses, numSuccess] = maybePriceUpdateIx!;
    if (numSuccess === 0) {
      console.log("No social update available");
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
    const tx = await InstructionUtils.asV0TxWithComputeIxs(
      program,
      [priceUpdateIx, await myProgramIx(myProgram, pullFeed.pubkey)],
      2,
      100_000,
      await Promise.all(luts)
    );
    tx.sign([keypair]);

    // Simulate the transaction to get the social metric and send the tx
    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);

    // Parse the tx logs to get the social metrics from chain
    const logs = sim.value.logs.join();
    try {
      const simPrice = +logs.match(/temperature:\s*"(\d+(\.\d+)?)/)[1];
      console.log(`${conf.name}:`, simPrice);
      console.log("\tTransaction sent: ", sig);
    } catch (err) {
      console.error("Failed to parse logs for social metric:", sim);
      console.error(err);
    }
    await sleep(interval);
  }
})();
