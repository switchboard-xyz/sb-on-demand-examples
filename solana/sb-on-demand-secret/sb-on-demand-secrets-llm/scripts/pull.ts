import { PublicKey } from "@solana/web3.js";
import { SwitchboardSecrets, CrossbarClient, decodeString } from "@switchboard-xyz/common";
import {
  myAnchorProgram,
  buildLLMJob,
  ensureUserSecretProfileExists,
  ensureSecretExists,
  whitelistFeedHash,
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

    // secrets start
    const secretNameExpansionTask = "${GROK_X_AI_API_KEY}";
    const secretName = "GROK_X_AI_API_KEY";
    // Pull in API Key from .env file
    const API_KEY = process.env.GROK_X_AI_API_KEY;
    const secretValue = API_KEY ?? "API_KEY_NOT_FOUND";
    console.log("\n🔒 Step 1: Checking the User profile exists or creating it to store secrets");

    // start of secrets
    const sbSecrets = new SwitchboardSecrets();
    const user = await ensureUserSecretProfileExists(sbSecrets, keypair);

    console.log("\n🔒 Step 2: Checking and Creating the Secret");
    const secret = await ensureSecretExists(
      sbSecrets,
      keypair,
      secretName,
      secretValue
    );

    console.log("\n🔒 Step 3: Building Feed Configuration");
    const secretFeedJob = [
      buildLLMJob(secretNameExpansionTask, keypair),
    ];
    const conf: any = {
      name: "Groq_X_AI buy ethUSD.", // the feed name (max 32 bytes)
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
      (await crossbarClient.store(queue.toString(), secretFeedJob)).feedHash
    );

    // Whitelist the feed hash
    await whitelistFeedHash(
      sbSecrets,
      keypair,
      conf.feedHash,
      secretName
    );

    // Initialize the Secret Feed
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

