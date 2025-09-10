import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import {
  TX_CONFIG,
  sleep,
  myAnchorProgram,
  oracleUpdateIx,
  verifyIx,
  DEMO_PATH,
  calculateStatistics,
} from "../utils";

const argv = yargs(process.argv)
  .options({
    feedHash: {
      type: "string",
      required: true,
      description: "The hexadecimal hash of the price feed (e.g., BTC/USD)",
      example: "0x1234567890abcdef...",
    },
  })
  .parseSync();

/**
 * Main execution function demonstrating quote-based oracle integration
 *
 * This function implements a continuous loop that:
 * 1. Fetches the latest oracle quote from Switchboard's Crossbar network
 * 2. Creates verification and program instructions
 * 3. Submits transactions to consume the oracle data
 * 4. Tracks performance metrics for monitoring
 *
 * @async
 * @function main
 *
 * @throws {Error} If environment setup fails or oracle network is unreachable
 */
(async function main() {
  // Load Solana environment configuration from standard locations
  // Expects ANCHOR_WALLET environment variable or ~/.config/solana/id.json
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  console.log("RPC:", connection.rpcEndpoint);

  // Initialize your program that will consume the oracle data
  const testProgram = await myAnchorProgram(program!.provider, DEMO_PATH);

  // Create Crossbar client for fetching oracle quotes
  // Crossbar is Switchboard's high-performance oracle data delivery network
  // For local development, create a dummy crossbar instance
  const crossbar = new CrossbarClient("https://crossbar.switchboardlabs.xyz");

  // Load the default Switchboard queue for your network (mainnet/devnet)
  // The queue contains the list of authorized oracle signers
  const queue = await sb.Queue.loadDefault(program!);

  // Fetch the gateway URL for this queue from Crossbar
  // This endpoint will provide signed oracle quotes
  // const gateway = new sb.Gateway(program!, "http://localhost:8082"); // Local development
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar as any);

  // Load the address lookup table for transaction size optimization
  // This significantly reduces transaction size by using indices instead of full addresses
  const lut = await queue.loadLookupTable();

  // Track latency measurements for performance monitoring
  const latencies: number[] = [];

  // Main execution loop - continuously fetches and processes oracle updates
  while (true) {
    // Measure quote fetch latency for performance monitoring
    const start = Date.now();

    // Debug: Log the input feedHash
    console.log("Input feedHash:", argv.feedHash);

    // Fetch the oracle quote and signature verification instruction
    // This single call:
    // 1. Requests the latest price data from oracle operators
    // 2. Receives signed quote with oracle signatures
    // 3. Creates the Ed25519 signature verification instruction
    const sbIx = await queue.fetchUpdateBundleIx(
      gateway, // Gateway URL for this oracle queue
      crossbar as any, // Crossbar client instance (for local development)
      [argv.feedHash] // Array of feed hashes to fetch (can request multiple)
    );

    // Calculate and track fetch latency
    const endTime = Date.now();
    const latency = endTime - start;
    latencies.push(latency);

    // Create your program's instruction to consume the oracle data
    // This instruction will verify and use the quote in your business logic
    const updateIx = await oracleUpdateIx(
      testProgram,
      queue.pubkey,
      keypair.publicKey
    );
    const verifyInstruction = await verifyIx(
      testProgram,
      queue.pubkey,
      keypair.publicKey
    );

    // Display performance statistics for monitoring
    const stats = calculateStatistics(latencies);
    console.log(`Min latency: ${stats.min} ms`);
    console.log(`Median latency: ${stats.median} ms`);
    console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
    console.log(`Loop count: ${stats.count}`);

    // Construct a versioned transaction (v0) for optimal performance
    // V0 transactions support address lookup tables and are more efficient
    const tx = await sb.asV0Tx({
      connection,
      ixs: [sbIx, updateIx, verifyInstruction], // Include all necessary instructions
      signers: [keypair],
      computeUnitPrice: 20_000, // Priority fee in micro-lamports per compute unit
      computeUnitLimitMultiple: 1.3, // Add 30% buffer to estimated compute units
      lookupTables: [lut], // Include lookup table for size optimization
    });

    // Simulate the transaction to verify it will succeed
    // This helps catch errors before spending transaction fees
    try {
      const sim = await connection.simulateTransaction(tx, {
        ...TX_CONFIG,
        commitment: "confirmed", // Use confirmed for simulation too
      });
      console.log(`Simulation result: ${JSON.stringify(sim.value, null, 2)}`);
      const sig = await connection.sendTransaction(tx);
      await connection.confirmTransaction(sig, "confirmed");
      console.log("✅ Transaction submitted:", sig);

      // Check simulation results for errors
      if (sim.value.err) {
        console.error("❌ Simulation failed:", sim.value.err);
        return;
      }
    } catch (error) {
      console.error("💥 Transaction error:", error);
    }

    // Wait before next iteration to avoid rate limits
    await sleep(3_000);
  }
})();
