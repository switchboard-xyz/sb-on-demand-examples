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
  sendAndConfirmTx,
} from "./utils";
import yargs from "yargs";

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
}).argv;

(async function main() {
  // Devnet default queue
  const queue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
  const path = "../target/deploy/sb_on_demand_solana-keypair.json";
  const [_, myProgramKeypair] = await AnchorUtils.initWalletFromFile(path);
  const { keypair, connection, provider } = await AnchorUtils.loadEnv();
  const program = await AnchorUtils.loadProgramFromEnv();
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
  };
  const conf = {
    // the feed name (max 32 bytes)
    name: "BTC-USD (stables)",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [buildBinanceComJob("BTCUSDC")], //, buildCoinbaseJob("BTC-USD")],
    // allow 1% variance between submissions and jobs
    maxVariance: 1.0,
    // minimum number of responses of jobs to allow
    minResponses: 1,
    // number of signatures to fetch per update
    numSignatures: 1,
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
  const interval = 1_000;
  while (true) {
    const tx = await InstructionUtils.asV0Tx(program, [
      await pullFeed.solanaFetchUpdateIx(conf),
      await myProgram.methods
        .test()
        .accounts({ feed: pullFeed.pubkey })
        .instruction(),
    ]);
    tx.sign([keypair]);
    // Simulate the transaction to get the price and send the tx
    const sim = await connection.simulateTransaction(tx, txOpts);
    const log = sim.value.logs.filter((x) => x.includes("price:"))[0];
    const simPrice = +log.split(" ").at(-1).replace(/"/g, "");
    const sig = await connection.sendTransaction(tx, txOpts);
    console.log(`${conf.name} price update:`, simPrice);
    console.log("\tTransaction sent: ", sig);
    await sleep(interval);
  }
})();
