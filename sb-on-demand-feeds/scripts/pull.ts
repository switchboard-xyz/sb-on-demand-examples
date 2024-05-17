import { Connection, Keypair, PublicKey, Commitment } from "@solana/web3.js";
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
import { sendTxUsingJito } from "@solworks/soltoolkit-sdk";

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
  mainnet: { type: "boolean", describe: "Use mainnet queue" },
}).argv;

async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

(async function main() {
  // Devnet default queue (cli configs must be set to devnet)
  const { keypair, connection, provider, program } =
    await AnchorUtils.loadEnv();
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
  const path = "target/deploy/sb_on_demand_solana-keypair.json";
  const myProgramKeypair = await AnchorUtils.initKeypairFromFile(path);
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
  };
  const conf = {
    // the feed name (max 32 bytes)
    name: "BTC Price Feed",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [
      buildPythnetJob(
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
      ),
      buildCoinbaseJob("BTC-USD"),
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
    console.log("Initializing new data feed");
    // Generate the feed keypair
    const [pullFeed_, feedKp] = PullFeed.generate(program);
    const tx = await InstructionUtils.asV0TxWithComputeIxs(
      program,
      [await pullFeed_.initIx(conf)],
      1.2,
      1_000_0000
    );
    tx.sign([keypair, feedKp]);

    // Simulate the transaction to get the price and send the tx
    await connection.simulateTransaction(tx, txOpts);
    console.log("Sending initialize transaction");
    const sig = await connection.sendTransaction(tx, txOpts);
    await connection.confirmTransaction(sig, "processed");
    console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
    pullFeed = pullFeed_;
    await sleep(3000);
  } else {
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  // Send a price update with a following user instruction every N seconds
  const interval = 1000; // ms
  while (true) {
    // Fetch the price update instruction and report the selected oracles
    const [priceUpdateIx, oracleResponses, numSuccess] =
      await pullFeed.fetchUpdateIx(conf);
    if (numSuccess === 0) {
      console.log("No price update available");
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

    // Simulate the transaction to get the price and send the tx
    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);

    // Parse the tx logs to get the price on chain
    const logs = sim.value.logs.join();
    try {
      const simPrice = +logs.match(/price:\s*"(\d+(\.\d+)?)/)[1];
      console.log(`${conf.name} price update:`, simPrice);
      console.log("\tTransaction sent: ", sig);
    } catch (err) {
      console.error("Failed to parse logs for price:", logs);
    }
    await sleep(interval);
  }
})();
