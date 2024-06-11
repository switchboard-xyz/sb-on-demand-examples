import { PublicKey, Commitment } from "@solana/web3.js";
import {
  AnchorUtils,
  InstructionUtils,
  PullFeed,
  Queue,
} from "@switchboard-xyz/on-demand";
import { myAnchorProgram, buildCoinbaseJob, buildPythnetJob } from "./utils";
import yargs from "yargs";
import { Program } from "@coral-xyz/anchor";
import { CrossbarClient, decodeString, sleep } from "@switchboard-xyz/common";

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
  mainnet: { type: "boolean", describe: "Use mainnet queue" },
}).argv;

async function myProgramIx(program: Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

(async function main() {
  // Devnet default queue (cli configs must be set to devnet)
  const { keypair, connection, provider, program } =
    await AnchorUtils.loadEnv();
  console.log("provdier", provider);
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

  let idl;
  try {
    console.log("Fetching IDL for program:", myProgramKeypair.publicKey.toBase58());
    idl = await Program.fetchIdl(myProgramKeypair.publicKey, provider);
    if (!idl) {
      throw new Error("Failed to fetch IDL. IDL is undefined.");
    }
    console.log("Successfully fetched IDL");
  } catch (error) {
    console.error("Error fetching IDL:", error);
    return;
  }

  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  // const myProgram = await myAnchorProgram(
  //   provider,
  //   new PublicKey("4Qt5WN3J79Fi5jwuoaav9iS5ZfnRJxcsskrLMAzNikBQ")
  // );
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
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

    const tx = await InstructionUtils.asV0TxWithComputeIxs(
      program,
      [await pullFeed_.initIx({ ...conf, feedHash: decodedFeedHash })],
      1.2,
      75_000
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
    console.log("Using existing data feed with address:", argv.feed);
    pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  }

  // Send a price update with a following user instruction every N seconds
  const interval = 3000; // ms
  while (true) {
    let maybePriceUpdateIx;
    try {
      maybePriceUpdateIx = await pullFeed.fetchUpdateIx({
        ...conf,
        // A Switchboard "Crossbar" client, used to store and retrieve jobs in this example.
        crossbarClient,
      });
    } catch (err) {
      console.error("Failed to fetch price update instruction");
      console.error(err);
      await sleep(interval);
      continue;
    }
    // Fetch the price update instruction and report the selected oracles
    const [priceUpdateIx, oracleResponses, numSuccess] = maybePriceUpdateIx!;
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
      console.error("Failed to parse logs for price:", sim);
      console.error(err);
    }
    await sleep(interval);
  }
})();
