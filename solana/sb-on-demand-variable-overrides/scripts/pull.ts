import { PublicKey } from "@solana/web3.js";
import { CrossbarClient, decodeString } from "@switchboard-xyz/common";
import {
  myAnchorProgram,
  buildVariableOverrideJob,
  DEMO_PATH,
  TX_CONFIG,
  myProgramIx,
} from "./utils";
import dotenv from "dotenv";
import * as sb from "@switchboard-xyz/on-demand";

const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

(async function main() {
  try {
    dotenv.config();
    // Devnet default queue (cli configs must be set to devnet)
    const { keypair, connection, provider, program } =
      await sb.AnchorUtils.loadEnv();
    const queueAccount = await sb.getDefaultQueue(connection.rpcEndpoint);
    const queue = queueAccount.pubkey;
    const myProgram = await myAnchorProgram(program.provider, DEMO_PATH);

    // Variable overrides approach - no secrets management needed
    const API_KEY = process.env.OPEN_WEATHER_API_KEY;
    if (!API_KEY) {
      throw new Error("OPEN_WEATHER_API_KEY environment variable is required");
    }

    console.log("\n🔧 Building Feed Configuration with Variable Overrides");
    const variableOverrideFeedJob = [buildVariableOverrideJob()];
    const conf: any = {
      name: "Weather Temperature(C) in Aspen, CO.", // the feed name (max 32 bytes)
      queue: new PublicKey(queue), // the queue of oracles to bind to
      maxVariance: 1.0, // allow 1% variance between submissions and jobs
      minResponses: 1, // minimum number of responses of jobs to allow
      numSignatures: 2, // number of signatures to fetch per update
      minSampleSize: 1, // minimum number of responses to sample for a result
      maxStaleness: 60, // maximum stale slots of responses to sample
    };

    // Initialize the feed if needed
    console.log("Initializing new data feed");
    const [pullFeed, feedKp] = sb.PullFeed.generate(program);

    // Store the feed configs on IPFS
    conf.feedHash = decodeString(
      (await crossbarClient.store(queue.toString(), variableOverrideFeedJob)).feedHash
    );

    // Initialize the Feed with Variable Overrides
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

    // Use variable overrides when fetching updates
    const [pullIx, responses, _ok, luts] = await pullFeed.fetchUpdateIx({
      ...conf,
      variableOverrides: {
        "OPEN_WEATHER_API_KEY": API_KEY, // Only API key as variable
      },
    });

    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, await myProgramIx(myProgram, pullFeed.pubkey)],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const updateEvent = new sb.PullFeedValueEvent(
      sb.AnchorUtils.loggedEvents(program, sim.value.logs)[0]
    ).toRows();
    console.log("Submitted Feed Update:\n", updateEvent);
    console.log(`\tTx Signature: ${await connection.sendTransaction(tx)}`);
  } catch (error) {
    console.error("Error during execution:", error);
    process.exit(1);
  }

  process.exit(0);
})();