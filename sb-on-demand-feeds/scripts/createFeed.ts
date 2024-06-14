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
  const myPid = myProgram.programId;
  const idl = await anchor.Program.fetchIdl(myPid, program.provider);

  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };

  const conf = {
    // the feed name (max 32 bytes)
    name: "BTC Price Feed",
    // the queue of oracles to bind to
    queue,
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

    // Simulate the transaction to get the price and send the tx
    console.log("Sending initialize transaction");
    await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);
    await connection.confirmTransaction(sig, "processed");
    console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
    pullFeed = pullFeed_;
    await sleep(3000);
  } else {
    console.log("Using existing data feed with address:", argv.feed);
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  // Send a price update with a following user instruction every N seconds
  while (true) {
    const sbResponse = await pullFeed.fetchUpdateIx({
      ...conf,
      // A Switchboard "Crossbar" client, used to store and retrieve jobs in this example.
      crossbarClient,
    });
    // Fetch the price update instruction and report the selected oracles
    const [priceUpdateIx, oracleResponses, success] = sbResponse;
    if (!success) {
      console.log("No price update available");
      console.log(`\tErrors: ${oracleResponses.map((x) => x.error)}`);
      return;
    }

    // Load the lookup tables
    const luts = oracleResponses.map((x) => x.oracle.loadLookupTable());
    luts.push(pullFeed.loadLookupTable());

    // Construct the transaction
    const tx = await sb.asV0Tx({
      connection: program.provider.connection,
      ixs: [priceUpdateIx, await myProgramIx(myProgram, pullFeed.pubkey)],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      signers: [keypair],
      lookupTables: await Promise.all(luts),
    });

    // Simulate the transaction to get the price and send the tx
    const sim = await connection.simulateTransaction(tx, txOpts);
    const sig = await connection.sendTransaction(tx, txOpts);

    // Parse the tx logs to get the price on chain
    const simPrice = +sim.value.logs.join().match(/price: "(\d+(\.\d+)?)/)[1];
    console.log(`${conf.name} Price update: ${simPrice}`);
    console.log("\tTransaction sent: ", sig);
    await sleep(3000);
  }
})();
