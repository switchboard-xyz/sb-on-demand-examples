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
  buildSecretsJob,
  ensureUserExists,
  ensureSecretExists,
  whitelistFeedHash
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
    name: "Feed Weather Temp Aspen",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [buildSecretsJob(secretNameTask, keypair)],
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
    // Generate the feed keypair
    const [pullFeed_, feedKp] = PullFeed.generate(program);
    const tx = await pullFeed_.initTx(program, conf);
    const sig = await sendAndConfirmTx(connection, tx, [keypair, feedKp]);
    console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
    pullFeed = pullFeed_;
  } else {
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  console.log("\n🔒 Step 5: Whitelist the feed hash to the secret");
  const whitelistConfirmation = await whitelistFeedHash(sbSecrets, keypair, nacl, feed_hash, secretName);

  // Send a price update with a following user in struction every N seconds
  console.log("\n🔒 Step 6: Run the Feed Update Loop..");
  const interval = 1000; // ms
  while (true) {
    try {
      // Fetch the price update instruction and report the selected oracles
      const [priceUpdateIx, oracleResponses, numSuccess] =
        await pullFeed.fetchUpdateIx(conf);
      if (numSuccess === 0) {
        // re-run the loop if no oracles responded
        continue;
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
      console.log("\n\tTransaction sent: ", sig);
      // Parse the tx logs to get the price on chain
      const simPrice = +sim.value.logs.join().match(/temperature:\s*"(\d+(\.\d+)?)/)[1];
      console.log(`\t${conf.name} Temp update:`, simPrice);

      await sleep(interval);
    } catch (error) {
      await sleep(interval);
    } finally {
      await sleep(interval);
    }
  }
})();
