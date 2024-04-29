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

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
}).argv;

async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

(async function main() {
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
  const path = "../target/deploy/sb_on_demand_solana-keypair.json";
  const myProgramKeypair = await AnchorUtils.initKeypairFromFile(path);
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
  };
  const conf = {
    // the feed name (max 32 bytes)
    name: "BTC Pythnet Price Feed",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [
      buildPythnetJob(
        "0x418f26cfa5ce283bc2bcb04fafeb83764db848154756cf80a35b36a5d92cc4d80a"
      ),
      // buildSanctumFairPriceJob("jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v"),
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
