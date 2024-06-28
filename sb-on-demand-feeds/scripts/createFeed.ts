import { PublicKey, Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  InstructionUtils,
  PullFeed,
  Queue,
  sleep,
} from "@switchboard-xyz/on-demand";
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
import { CrossbarClient, decodeString } from "@switchboard-xyz/common";

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
  mainnet: { type: "boolean", describe: "Use mainnet queue" },
}).argv;

async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

(async function main() {
  // Devnet default queue (cli configs must be set to devnet)
  const { keypair, connection, program } = await AnchorUtils.loadEnv();
  let queue = new PublicKey("FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di");
  if (argv.mainnet) {
    queue = new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w");
  }
  const queueAccount = new Queue(program, queue);
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  const myProgramPath = "target/deploy/sb_on_demand_solana-keypair.json";
  const myProgram = await myAnchorProgram(program.provider, myProgramPath);

  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };
  const conf = {
    name: "BTC Price Feed", // the feed name (max 32 bytes)
    queue, // the queue of oracles to bind to
    maxVariance: 1.0, // allow 1% variance between submissions and jobs
    minResponses: 1, // minimum number of responses of jobs to allow
    numSignatures: 3, // number of signatures to fetch per update
    minSampleSize: 1, // minimum number of responses to sample
    maxStaleness: 60, // maximum staleness of responses in seconds to sample
  };

  // Initialize the feed if needed
  let pullFeed: PullFeed;
  if (argv.feed === undefined) {
    console.log("Initializing new data feed");
    // Generate the feed keypair
    const [pullFeed_, feedKp] = PullFeed.generate(program);
    const jobs = [
      buildPythnetJob(
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
      ),
      buildCoinbaseJob("BTC-USD"),
    ];
    const decodedFeedHash = await crossbarClient
      .store(queue.toBase58(), jobs)
      .then((resp) => decodeString(resp.feedHash));
    console.log("Feed hash:", decodedFeedHash);

    const tx = await sb.asV0Tx({
      connection: program.provider.connection,
      ixs: [await pullFeed_.initIx({ ...conf, feedHash: decodedFeedHash })],
      payer: keypair.publicKey,
      signers: [keypair, feedKp],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });
    console.log("Sending initialize transaction");
    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);
    await connection.confirmTransaction(sig, "confirmed");
    console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
    pullFeed = pullFeed_;
  } else {
    console.log("Using existing data feed with address:", argv.feed);
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  // Send a price update with a following user instruction every N seconds
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
    const simPrice = sim.value.logs.join("\n").match(/price: (.*)/)[1];
    console.log(`Price update: ${simPrice}\n\tTransaction sent: ${sig}`);
    await sb.sleep(3000);
  }
})();
