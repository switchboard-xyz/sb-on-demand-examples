import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient, OracleJob, OracleFeed } from "@switchboard-xyz/common";
import yargs from "yargs";
import { TX_CONFIG, buildBinanceJob, buildCoinbaseJob } from "./utils";

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
 * Create and Test a Managed Oracle Feed
 *
 * This script demonstrates how to create a Switchboard managed feed using the modern
 * storeOracleFeed approach and fetch oracle-signed price updates.
 *
 * Usage:
 *   ts-node feeds/createManagedFeed.ts [--name "BTC/USD"] [--base BTC] [--quote USD]
 *
 * What this script does:
 * 1. Defines oracle jobs that fetch price data from exchanges (e.g., Binance)
 * 2. Creates an OracleFeed object with aggregation configuration
 * 3. Stores the feed on IPFS via Crossbar API (returns a feed hash)
 * 4. Fetches oracle-signed updates using the feed hash
 * 5. Submits update to the canonical quote account on-chain
 * 6. Reads and displays the oracle price value from the quote account
 */
(async function main() {
  console.log("=== Creating Switchboard Managed Feed ===");

  // Step 1: Load Solana environment
  const { program, keypair, connection } = await sb.AnchorUtils.loadEnv();
  const queue = await sb.Queue.loadDefault(program!);
  const isMainnet = await sb.isMainnetConnection(connection);

  console.log("Network:", isMainnet ? "mainnet" : "devnet");

  // Step 3: Define oracle jobs
  // Create jobs that fetch price data from multiple exchanges
  const jobs: OracleJob[] = [
    buildBinanceJob(`${argv.base}USDT`),
  ];

  // Step 4: Create OracleFeed object with configuration
  const oracleFeed = OracleFeed.fromObject({
    name: `${argv.base}/${argv.quote} Price Feed`,
    jobs: jobs,
    minOracleSamples: 1,
    minJobResponses: 1,
    maxJobRangePct: 1,
  });


  // Step 5: Store the feed on IPFS using storeOracleFeed
  const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");
  const { feedId, cid } = await crossbar.storeOracleFeed(oracleFeed);
  const feedHash = feedId.startsWith("0x") ? feedId.slice(2) : feedId;

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 6: Fetch oracle-signed update
  console.log("Fetching oracle update...");
  let instructions;
  let oracleValue: number | null = null;

  try {
    // Fetch oracle update which contains the value
    const updateResponse = await queue.fetchManagedUpdateIxs(
      crossbar,
      [feedHash],
      {
        numSignatures: 1,
        variableOverrides: {},
        instructionIdx: 0,
        payer: keypair.publicKey,
      }
    );
    instructions = updateResponse;

    // Decode the Ed25519 instruction data to extract oracle value
    const ed25519Ix = updateResponse[0];
    if (ed25519Ix && ed25519Ix.data) {
      try {
        const decodedQuote = sb.OracleQuote.decode(ed25519Ix.data);
        console.log("📊 Decoded Oracle Quote:");
        console.log(`  Recent Slot: ${decodedQuote.slot.toString()}`);

        if (decodedQuote.feeds.length > 0) {
          const feed = decodedQuote.feeds[0];
          console.log(`  Feed Hash: ${feed.feedHash.toString("hex")}`);

          // Convert i128 to decimal (18 decimals precision)
          const DECIMALS = 18;
          const divisor = BigInt(10) ** BigInt(DECIMALS);
          const price = Number(feed.value) / Number(divisor);
          oracleValue = price;

          console.log(`  Decoded Price: $${price.toLocaleString()}\n`);
        }
      } catch (decodeError: any) {
        console.warn("Could not decode oracle quote:", decodeError.message);
      }
    }
  } catch (error: any) {
    console.error("Failed to fetch oracle update:", error.message);
    if (error.response?.data) {
      console.error("Response:", error.response.data);
    }
    return;
  }

  // Step 7: Derive the canonical quote account
  const [quoteAccount] = sb.OracleQuote.getCanonicalPubkey(queue.pubkey, [feedHash]);

  // Step 8: Send update transaction
  const tx = await sb.asV0Tx({
    connection,
    ixs: instructions,
    signers: [keypair],
    computeUnitPrice: 20_000,
    computeUnitLimitMultiple: 1.1,
  });

  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    console.error("Simulation failed:", sim.value.err);
    console.log("Logs:", sim.value.logs?.join("\n"));
    return;
  }

  console.log("Submitting oracle update...");
  const sig = await connection.sendTransaction(tx, TX_CONFIG);
  try {
    await connection.confirmTransaction(sig, "confirmed");
    console.log(`✓ Transaction: ${sig}\n`);
  } catch (error: any) {
    console.log(`⏳ Transaction sent: ${sig}`);
  }

  console.log(`  Quote Account: ${quoteAccount.toBase58()}`);
})();
