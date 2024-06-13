import { PublicKey, Commitment } from "@solana/web3.js";
import { AnchorUtils, InstructionUtils, PullFeed, Queue, sleep } from "@switchboard-xyz/on-demand";
import { myAnchorProgram } from "./utils";
import yargs from "yargs";
import * as anchor from "@coral-xyz/anchor";
import { CrossbarClient } from "@switchboard-xyz/common";

const argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
  mainnet: { type: "boolean", describe: "Use mainnet queue" },
}).argv;

const crossbarClient = new CrossbarClient("https://crossbar.switchboard.xyz", true);

const config = {
  mainnetQueue: new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"),
  devnetQueue: new PublicKey("FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di"),
  txOpts: {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  },
  interval: 3000, // ms
};

async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

async function initializeProgram() {
  const { keypair, connection, provider, program } = await AnchorUtils.loadEnv();
  const queue = argv.mainnet ? config.mainnetQueue : config.devnetQueue;
  await new Queue(program, queue).loadData();
  const myProgramKeypair = await AnchorUtils.initKeypairFromFile("target/deploy/sb_on_demand_solana-keypair.json");
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  return { keypair, connection, provider, program, myProgram, queue };
}

(async function main() {
  const { keypair, connection, program, myProgram, queue } = await initializeProgram();
  const pullFeed = new PullFeed(program, new PublicKey(argv.feed));
  
  // set your configuration here for the feed update
  const conf = { 
    queue, 
    maxVariance: 1.0, 
    minResponses: 1, 
    numSignatures: 3 
  };

  console.log("Using existing data feed with address:", argv.feed);

  while (true) {
    try {
      const [priceUpdateIx, oracleResponses, numSuccess] = await pullFeed.fetchUpdateIx({ ...conf, crossbarClient }) || [];
      if (numSuccess === 0) {
        console.log("No price update available");
        console.log("\tErrors:", oracleResponses.map((x) => x.error));
        return;
      }

      const luts = oracleResponses.map((x) => x.oracle.loadLookupTable());
      luts.push(pullFeed.loadLookupTable());

      const tx = await InstructionUtils.asV0TxWithComputeIxs(
        program,
        [priceUpdateIx, await myProgramIx(myProgram, pullFeed.pubkey)],
        1.3,
        200_000,
        await Promise.all(luts)
      );

      tx.sign([keypair]);

      const sim = await connection.simulateTransaction(tx, config.txOpts);
      const sig = await connection.sendTransaction(tx, config.txOpts);

      const logs = sim.value.logs.join();
      try {
        const simPrice = +logs.match(/price:\s*"(\d+(\.\d+)?)/)[1];
        console.log(`price update: ${simPrice}`);
        console.log("\tTransaction sent: ", sig);
      } catch (err) {
        console.error("Failed to parse logs for price:", sim);
        console.error(err);
      }
    } catch (err) {
      console.error("Failed to fetch or process price update instruction", err);
    }
    await sleep(config.interval);
  }
})();
