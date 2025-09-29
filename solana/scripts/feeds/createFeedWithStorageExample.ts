import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient, OracleJob, OracleFeed } from "@switchboard-xyz/common";
import yargs from "yargs";
import { TX_CONFIG, buildBinanceJob, buildCoinbaseJob } from "../utils";

const argv = yargs(process.argv)
  .options({
    name: {
      type: "string",
      default: "BTC/USD",
      description: "Name for the oracle feed",
    },
    base: {
      type: "string",
      default: "BTC",
      description: "Base currency",
    },
    quote: {
      type: "string",
      default: "USD",
      description: "Quote currency",
    },
  })
  .parseSync();

/**
 * Modern Oracle Feed Creation Example using storeOracleFeed
 *
 * This example demonstrates the modern approach to creating Switchboard feeds:
 * 1. Define oracle jobs for multiple data sources
 * 2. Create an OracleFeed object with configuration
 * 3. Store the feed on IPFS via Crossbar (using storeOracleFeed)
 * 4. Use the feed hash to fetch oracle-signed updates
 * 5. Consume the oracle data in transactions
 *
 * This approach is more efficient than legacy PullFeed accounts as it:
 * - Doesn't require on-chain feed account initialization
 * - Uses the managed update system with canonical oracle accounts
 * - Stores feed configuration on IPFS for reproducibility
 * - Works with the quote program for verified updates
 */
(async function main() {
  console.log("=== Modern Switchboard Feed Creation with storeOracleFeed ===\n");

  // Step 1: Load Solana environment
  const { program, keypair, connection } = await sb.AnchorUtils.loadEnv();
  console.log("RPC:", connection.rpcEndpoint);
  console.log("Payer:", keypair.publicKey.toBase58());

  // Step 2: Load queue (auto-detects mainnet/devnet)
  const queue = await sb.Queue.loadDefault(program!);
  const isMainnet = await sb.isMainnetConnection(connection);
  console.log("Network:", isMainnet ? "mainnet" : "devnet");
  console.log("Queue:", queue.pubkey.toBase58(), "\n");

  // Step 3: Define oracle jobs
  // Create jobs that fetch price data from multiple exchanges
  const jobs: OracleJob[] = [
    buildBinanceJob(`${argv.base}USDT`),
    buildCoinbaseJob(`${argv.base}-${argv.quote}`),
  ];

  console.log(`Creating feed "${argv.name}" with ${jobs.length} oracle jobs`);
  jobs.forEach((job, i) => {
    const taskType = job.tasks[0].httpTask ? "HTTP" : "Oracle";
    console.log(`  ${i + 1}. ${taskType} task`);
  });
  console.log();

  // Step 4: Create OracleFeed object with configuration
  // This defines how oracle data should be aggregated
  const oracleFeed = OracleFeed.fromObject({
    name: `${argv.base}/${argv.quote} Price Feed`,
    jobs: jobs,
    minOracleSamples: 1, // Minimum oracle responses required
    minJobResponses: 1, // Minimum successful job responses per oracle
    maxJobRangePct: 1, // Maximum allowed variance between job results (1%)
  });

  console.log("Feed configuration:");
  console.log(`  Name: ${oracleFeed.name}`);
  console.log(`  Symbol: ${oracleFeed.symbol}`);
  console.log(`  Min Oracle Samples: ${oracleFeed.minOracleSamples}`);
  console.log(`  Min Job Responses: ${oracleFeed.minJobResponses}`);
  console.log(`  Max Job Range: ${oracleFeed.maxJobRangePct}%\n`);

  // Step 5: Store the feed on IPFS using storeOracleFeed
  // This uploads the feed configuration and returns a feed ID
  const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

  console.log("Storing feed on IPFS via Crossbar...");
  const { feedId, cid } = await crossbar.storeOracleFeed(oracleFeed);

  console.log("Feed stored successfully!");
  console.log(`  Feed ID: ${feedId}`);
  console.log(`  IPFS CID: ${cid}\n`);

  console.log("=== Fetching Oracle Update ===\n");

  // Step 6: Use fetchManagedUpdateIxs to get oracle-signed data
  // This uses the stored feed hash to fetch fresh oracle signatures
  const instructions = await queue.fetchManagedUpdateIxs(
    crossbar,
    [feedId], // Feed hash from storage
    {
      numSignatures: 1, // Number of oracle signatures
      variableOverrides: {},
      instructionIdx: 0, // Ed25519 instruction index
      payer: keypair.publicKey,
    }
  );

  console.log(`Generated ${instructions.length} instructions:`);
  console.log("  1. Ed25519 signature verification");
  console.log("  2. Quote program verified_update\n");

  // Step 7: Derive the canonical quote account
  // This is where the verified oracle data will be stored
  const [quoteAccount] = sb.OracleQuote.getCanonicalPubkey(queue.pubkey, [
    feedId,
  ]);
  console.log("Quote account (canonical):", quoteAccount.toBase58(), "\n");

  // Step 8: Build transaction to update oracle
  const tx = await sb.asV0Tx({
    connection,
    ixs: instructions,
    signers: [keypair],
    computeUnitPrice: 20_000,
    computeUnitLimitMultiple: 1.1,
  });

  // Step 9: Send transaction
  console.log("Sending oracle update transaction...");
  try {
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      console.error("Simulation failed:", sim.value.err);
      console.log("Logs:", sim.value.logs?.join("\n"));
      return;
    }

    const sig = await connection.sendTransaction(tx, TX_CONFIG);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Transaction confirmed:", sig, "\n");
  } catch (error: any) {
    console.error("Transaction failed:", error.message);
    return;
  }

  console.log("=== Reading Oracle Data ===\n");

  // Step 10: Load and display the oracle data
  // The quote program stores the verified oracle data in the canonical account
  try {
    const quoteData = await sb.OracleQuote.load(program!, quoteAccount);
    const price = quoteData.value();

    console.log("Oracle data:");
    console.log(`  Price: $${price.toFixed(2)}`);
    console.log(`  Oracle count: ${quoteData.oracleSubmissions.length}`);
    console.log(
      `  Last update: slot ${quoteData.oracleSubmissions[0]?.slot.toString() || "N/A"}`
    );
    console.log();
  } catch (error: any) {
    console.error("Failed to load oracle data:", error.message);
  }

  console.log("✅ Successfully created and used oracle feed!\n");
  console.log("Summary:");
  console.log(`  Feed ID: ${feedId}`);
  console.log(`  IPFS CID: ${cid}`);
  console.log(`  Quote Account: ${quoteAccount.toBase58()}`);
  console.log(`  Queue: ${queue.pubkey.toBase58()}`);
  console.log("\nYou can now use this feed ID to fetch updates in your programs.");
  console.log("The quote account is deterministically derived and doesn't require initialization.");
})();
