import * as sb from "@switchboard-xyz/on-demand";
import { PullFeed, isMainnetConnection } from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import {
  TX_CONFIG,
  sleep,
  loadAdvancedProgram,
  advancedProcessOracleIx,
  calculateStatistics,
} from "../../utils";

const argv = yargs(process.argv)
  .options({
    feedId: {
      type: "string",
      required: true,
      description: "The hexadecimal ID of the price feed (e.g., BTC/USD)",
      example: "0x1234567890abcdef...",
    },
  })
  .parseSync();

/**
 * Advanced Managed Oracle Update Example with State Management
 *
 * This example demonstrates production-ready oracle integration with:
 * 1. Auto-detection of network (mainnet/devnet) and queue selection
 * 2. Managed oracle updates using the quote program
 * 3. Program state initialization and authority management
 * 4. Address Lookup Tables for transaction optimization
 * 5. Performance monitoring and metrics tracking
 * 6. Continuous processing loop with error handling
 *
 * The advanced program includes features like:
 * - State management with initialization
 * - Authority validation
 * - Performance metrics tracking
 * - Comprehensive error handling
 */
(async function main() {
  // Load Solana environment configuration from standard locations
  // Expects ANCHOR_WALLET environment variable or ~/.config/solana/id.json
  const { program, keypair, connection, crossbar } = await sb.AnchorUtils.loadEnv();
  console.log("RPC:", connection.rpcEndpoint);

  // Auto-detect network and load appropriate queue
  console.log("🔍 Auto-detecting network and selecting optimal queue...");
  const queue = await sb.Queue.loadDefault(program!);
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar!);

  // Display network detection results using proper method
  const isMainnet = await isMainnetConnection(connection);
  console.log("🌐 Network detected:", isMainnet ? 'mainnet' : 'devnet');
  console.log("🌐 Queue selected:", queue.pubkey.toBase58());

  // Load the advanced oracle example program
  const advancedProgram = await loadAdvancedProgram(program!.provider);

  // No initialization needed for the simplified advanced program
  console.log("👍 Advanced program loaded and ready");

  // Load the address lookup table for transaction size optimization
  // This significantly reduces transaction size by using indices instead of full addresses
  const lut = await queue.loadLookupTable();

  // Get the canonical oracle account for this feed
  const oracleAccount = PullFeed.getCanonicalPubkey([argv.feedId]);
  console.log("📍 Oracle Account (derived):", oracleAccount.toBase58());

  // Track latency measurements for performance monitoring
  const latencies: number[] = [];

  // Main execution loop - continuously fetches and processes oracle updates
  while (true) {
    // Measure quote fetch latency for performance monitoring
    const start = Date.now();

    console.log("\n🔄 Processing oracle update for feed:", argv.feedId);

    // Create managed update instructions
    // This returns both the Ed25519 signature verification instruction
    // and the quote program instruction that stores the verified data
    const instructions = await queue.fetchManagedUpdateIxs(
      gateway,
      crossbar,
      [argv.feedId],
      oracleAccount,
      {
        numSignatures: 1, // Use single signature for fastest updates
        variableOverrides: {},
        instructionIdx: 0, // Ed25519 instruction index
        payer: keypair.publicKey,
      }
    );

    // Calculate and track fetch latency
    const endTime = Date.now();
    const latency = endTime - start;
    latencies.push(latency);

    // Create the advanced program instruction to parse oracle data
    const parseOracleIx = await advancedProcessOracleIx(
      advancedProgram,
      oracleAccount,
      queue.pubkey
    );

    console.log("✨ Generated instructions:", instructions.length + 1);
    console.log("  - Ed25519 signature verification");
    console.log("  - Quote program verified_update");
    console.log("  - Advanced program parse_oracle_data");

    // Display performance statistics for monitoring
    const stats = calculateStatistics(latencies);
    console.log(`📊 Performance Stats - Min: ${stats.min}ms | Median: ${stats.median}ms | Mean: ${stats.mean.toFixed(2)}ms | Count: ${stats.count}`);

    // Construct a versioned transaction (v0) for optimal performance
    // V0 transactions support address lookup tables and are more efficient
    const tx = await sb.asV0Tx({
      connection,
      ixs: [
        ...instructions,    // Managed update instructions
        parseOracleIx,     // Advanced program instruction to parse the data
      ],
      signers: [keypair],
      computeUnitPrice: 20_000, // Priority fee in micro-lamports per compute unit
      computeUnitLimitMultiple: 1.3, // Add 30% buffer to estimated compute units
      lookupTables: [lut], // Include lookup table for size optimization
    });

    // Send transaction with error handling
    try {
      const sig = await connection.sendTransaction(tx, TX_CONFIG);
      await connection.confirmTransaction(sig, "confirmed");
      console.log("✅ Transaction successful:", sig);
      console.log(`   View on explorer: https://solscan.io/tx/${sig}`);
      console.log("   Oracle data processed by advanced program!");
    } catch (error) {
      console.error("❌ Transaction failed:", (error as Error).message);
      // Continue the loop even if one transaction fails
    }

    // Wait before next iteration to avoid rate limits and allow for monitoring
    console.log("⏳ Waiting 5 seconds before next update...");
    await sleep(5_000);
  }
})();
