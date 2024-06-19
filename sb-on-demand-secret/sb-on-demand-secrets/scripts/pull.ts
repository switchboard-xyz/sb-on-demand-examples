import { PublicKey, Commitment } from "@solana/web3.js";
import {
  AnchorUtils,
  PullFeed,
  Queue,
} from "@switchboard-xyz/on-demand";
import { SwitchboardSecrets, FeedHash} from "@switchboard-xyz/common";
import {
  myAnchorProgram,
  buildSecretsJob,
  ensureUserExists,
  ensureSecretExists,
  whitelistFeedHash
} from "./utils";
import yargs from "yargs";
import * as anchor from "@coral-xyz/anchor";
import dotenv from "dotenv";
import nacl from "tweetnacl";
import * as sb from "@switchboard-xyz/on-demand";


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
    const tx = await sb.asV0Tx({
      connection: program.provider.connection,
      ixs: [await pullFeed_.initIx({ ...conf, feedHash: feed_hash })],
      payer: keypair.publicKey,
      signers: [keypair, feedKp],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });;
    tx.sign([keypair, feedKp]);

    console.log("Sending initialize transaction");
    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);
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
    const [pullIx, responses, success] = await pullFeed.fetchUpdateIx(conf);
    if (!success) throw new Error(`Errors: ${responses.map((x) => x.error)}`);

    const lutOwners = [...responses.map((x) => x.oracle), pullFeed.pubkey];
    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, await myProgramIx(myProgram, pullFeed.pubkey)],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: await sb.loadLookupTables(lutOwners),
    });

    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);
    const simPrice = +sim.value.logs.join().match(/temperature: "(\d+(\.\d+)?)/)[1];
    console.log(`Temperature update of Aspen in Degrees Celcius: ${simPrice}\n\tTransaction sent: ${sig}`);
    await sb.sleep(3000);
  }
})();
