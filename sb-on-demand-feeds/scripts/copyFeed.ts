import { PublicKey, Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  PullFeed,
} from "@switchboard-xyz/on-demand";
import { myAnchorProgram, sleep, TX_CONFIG } from "./utils";
import yargs from "yargs";
import * as anchor from "@coral-xyz/anchor";
import { CrossbarClient } from "@switchboard-xyz/common";

const argv = yargs(process.argv).options({ feed: { required: true } })
  .argv as any;

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
  const myProgramPath = "target/deploy/sb_on_demand_solana-keypair.json";
  const myProgram = await myAnchorProgram(program!.provider, myProgramPath);
  const queueAccount = await sb.getDefaultQueue(connection.rpcEndpoint);
  const queue = queueAccount.pubkey;
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };
  // set your configs
  const conf = {
    name: "BTC Price Feed", // the feed name (max 32 bytes)
    queue, // the queue of oracles to bind to
    maxVariance: 1.0, // allow 1% variance between submissions and jobs
    minResponses: 1, // minimum number of responses of jobs to allow
    numSignatures: 3, // number of signatures to fetch per update
    minSampleSize: 1, // minimum number of responses to sample
    maxStaleness: 60,// maximum staleness of responses in seconds to sample
  };

  // Initialize the feed
  let pullFeed: PullFeed;
  console.log("Copy existing data feed with address:", argv.feed);
  pullFeed = new PullFeed(program!, new PublicKey(argv.feed));
  let feedData = await pullFeed.loadData();
  let decodedFeedHash = Buffer.from(feedData.feedHash);

  const [pullFeed_, feedKp] = PullFeed.generate(program!);
  const tx = await sb.asV0Tx({
    connection: program!.provider.connection,
    ixs: [await pullFeed_.initIx({ ...conf, feedHash: decodedFeedHash })],
    payer: keypair.publicKey,
    signers: [keypair, feedKp],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });
  tx.sign([keypair, feedKp]);
  console.log("Sending initialize transaction");
  const sim = await connection.simulateTransaction(tx, txOpts);
  const sig = await connection.sendTransaction(tx, txOpts);
  console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
  pullFeed = pullFeed_;
  await sleep(5000);

  // Send a price update with a following user instruction every N seconds
  while (true) {
    const [pullIx, responses, _ok, luts] = await pullFeed.fetchUpdateIx(conf);
    
    const tx = await sb.asV0Tx({
        connection,
        ixs: [...pullIx!],
        signers: [keypair],
        computeUnitPrice: 200_000,
        computeUnitLimitMultiple: 1.3,
        lookupTables: luts,
      });
    
      const sim = await connection.simulateTransaction(tx, TX_CONFIG);
      const updateEvent = new sb.PullFeedValueEvent(
        sb.AnchorUtils.loggedEvents(program!, sim.value.logs!)[0]
      ).toRows();
      console.log("Submitted Price Updates:\n", updateEvent);
      console.log(`\tTx Signature: ${await connection.sendTransaction(tx)}`);
      await sleep(3000);
  }
})();
