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
  buildPythnetJob,
  DEMO_PATH,
  TX_CONFIG,
} from "./utils";
import yargs from "yargs";
import * as anchor from "@coral-xyz/anchor";
import { CrossbarClient, decodeString } from "@switchboard-xyz/common";

let argv = yargs(process.argv).options({
  mainnet: { type: "boolean", describe: "Use mainnet queue" },
}).argv;

async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

const FEED_JOBS = [
  buildPythnetJob(
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
  ),
  buildCoinbaseJob("BTC-USD"),
];

(async function main() {
  // Devnet default queue (cli configs must be set to devnet)
  const { keypair, connection, program } = await AnchorUtils.loadEnv();
  let queue = "FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di";
  if (argv.mainnet) {
    queue = "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w";
  }
  const queueAccount = new Queue(program, new PublicKey(queue));
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  const myProgram = await myAnchorProgram(program.provider, DEMO_PATH);

  const conf: any = {
    name: "BTC Price Feed", // the feed name (max 32 bytes)
    queue: new PublicKey(queue), // the queue of oracles to bind to
    maxVariance: 1.0, // allow 1% variance between submissions and jobs
    minResponses: 1, // minimum number of responses of jobs to allow
    numSignatures: 3, // number of signatures to fetch per update
    minSampleSize: 1, // minimum number of responses to sample for a result
    maxStaleness: 60, // maximum stale slots of responses to sample
  };

  // Initialize the feed if needed
  console.log("Initializing new data feed");
  const [pullFeed, feedKp] = PullFeed.generate(program);
  // Store the feed configs on IPFS
  conf.feedHash = decodeString(
    (await crossbarClient.store(queue, FEED_JOBS)).feedHash
  );
  const initTx = await sb.asV0Tx({
    connection,
    ixs: [await pullFeed.initIx(conf)],
    payer: keypair.publicKey,
    signers: [keypair, feedKp],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });
  console.log("Sending initialize transaction");
  const sig = await connection.sendTransaction(initTx, TX_CONFIG);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);

  // Send a price update with a following user instruction every N seconds
  while (true) {
    const [pullIx, responses, _ok, luts] = await pullFeed.fetchUpdateIx(conf);

    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, await myProgramIx(myProgram, pullFeed.pubkey)],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const simPrice = sim.value.logs.join("\n").match(/price: (.*)/)[1];
    console.log(`Price update for feed "${conf.name}": ${simPrice}`);
    console.log(`\tTx Signature: ${await connection.sendTransaction(tx)}`);
    await sb.sleep(3000);
  }
})();
