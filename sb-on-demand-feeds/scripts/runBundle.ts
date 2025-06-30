/**
 * @fileoverview Switchboard On-Demand Bundle Example
 *
 * This script demonstrates the recommended approach for fetching and using
 * Switchboard oracle price feeds using the bundle-based method. This is the
 * most efficient way to integrate Switchboard oracles, offering:
 *
 * - ~90% lower transaction costs compared to traditional feed accounts
 * - Sub-second latency for price updates
 * - No need for crank turners or feed maintenance
 * - Multiple price feeds in a single transaction
 *
 * @example
 * ```bash
 * # Fetch and verify BTC/USD price
 * bun run scripts/runBundle.ts --feedHash 0xabc123...
 *
 * # Using environment variables
 * ANCHOR_WALLET=~/.config/solana/id.json bun run scripts/runBundle.ts --feedHash 0xabc123...
 * ```
 *
 * @module runBundle
 */

import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import {
  TX_CONFIG,
  sleep,
  myAnchorProgram,
  myProgramIx,
  DEMO_PATH,
} from "./utils";

/**
 * Command-line argument parser for the script
 *
 * @property {string} feedHash - The hexadecimal hash of the price feed to fetch
 *                               This should match one of the available feeds from
 *                               the Switchboard oracle network
 */
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
 * Calculates statistical metrics for latency measurements
 *
 * This function computes key performance metrics to help monitor
 * the oracle response times and identify potential issues.
 *
 * @param {number[]} latencies - Array of latency measurements in milliseconds
 * @returns {Object} Statistical summary including:
 *   - min: Minimum latency observed
 *   - max: Maximum latency observed
 *   - median: Middle value when sorted
 *   - mean: Average latency
 *   - count: Total number of measurements
 *
 * @example
 * ```typescript
 * const stats = calculateStatistics([100, 150, 200, 175, 125]);
 * console.log(`Average latency: ${stats.mean}ms`);
 * ```
 */
function calculateStatistics(latencies: number[]) {
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const min = sortedLatencies[0];
  const max = sortedLatencies[sortedLatencies.length - 1];
  const median =
    sortedLatencies.length % 2 === 0
      ? (sortedLatencies[sortedLatencies.length / 2 - 1] +
          sortedLatencies[sortedLatencies.length / 2]) /
        2
      : sortedLatencies[Math.floor(sortedLatencies.length / 2)];
  const sum = sortedLatencies.reduce((a, b) => a + b, 0);
  const mean = sum / sortedLatencies.length;

  return {
    min,
    max,
    median,
    mean,
    count: latencies.length,
  };
}

/**
 * Main execution function demonstrating bundle-based oracle integration
 *
 * This function implements a continuous loop that:
 * 1. Fetches the latest oracle bundle from Switchboard's Crossbar network
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

  // Initialize your program that will consume the oracle data
  const testProgram = await myAnchorProgram(program!.provider, DEMO_PATH);

  // Create Crossbar client for fetching oracle bundles
  // Crossbar is Switchboard's high-performance oracle data delivery network
  const crossbar = CrossbarClient.default();

  // Load the default Switchboard queue for your network (mainnet/devnet)
  // The queue contains the list of authorized oracle signers
  const queue = await sb.Queue.loadDefault(program!);

  // Fetch the gateway URL for this queue from Crossbar
  // This endpoint will provide signed oracle bundles
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar);

  // Load the address lookup table for transaction size optimization
  // This significantly reduces transaction size by using indices instead of full addresses
  const lut = await queue.loadLookupTable();

  // Track latency measurements for performance monitoring
  const latencies: number[] = [];

  // Main execution loop - continuously fetches and processes oracle updates
  while (true) {
    // Measure bundle fetch latency for performance monitoring
    const start = Date.now();

    // Fetch the oracle bundle and signature verification instruction
    // This single call:
    // 1. Requests the latest price data from oracle operators
    // 2. Receives signed bundle with oracle signatures
    // 3. Creates the Ed25519 signature verification instruction
    const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(
      gateway, // Gateway URL for this oracle queue
      crossbar, // Crossbar client instance
      [argv.feedHash] // Array of feed hashes to fetch (can request multiple)
    );

    // Calculate and track fetch latency
    const endTime = Date.now();
    const latency = endTime - start;
    latencies.push(latency);

    // Create your program's instruction to consume the oracle data
    // This instruction will verify and use the bundle in your business logic
    const testIx = await myProgramIx(testProgram, queue.pubkey, bundle);

    // Display performance statistics for monitoring
    const stats = calculateStatistics(latencies);
    console.log(`Min latency: ${stats.min} ms`);
    console.log(`Max latency: ${stats.max} ms`);
    console.log(`Median latency: ${stats.median} ms`);
    console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
    console.log(`Loop count: ${stats.count}`);

    // Construct a versioned transaction (v0) for optimal performance
    // V0 transactions support address lookup tables and are more efficient
    const tx = await sb.asV0Tx({
      connection,
      ixs: [sigVerifyIx, testIx], // Order matters: verify signatures first
      signers: [keypair],
      computeUnitPrice: 20_000, // Priority fee in micro-lamports per compute unit
      computeUnitLimitMultiple: 1.3, // Add 30% buffer to estimated compute units
      lookupTables: [lut], // Include lookup table for size optimization
    });

    // Simulate the transaction to verify it will succeed
    // This helps catch errors before spending transaction fees
    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    console.log(`Simulation result: ${JSON.stringify(sim.value, null, 2)}`);

    // In production, you would:
    // 1. Check simulation results for errors
    // 2. Send the transaction if simulation succeeds
    // 3. Handle any transaction errors appropriately
    // Example:
    // if (sim.value.err) {
    //   console.error('Simulation failed:', sim.value.err);
    //   continue;
    // }
    // const signature = await connection.sendTransaction(tx, TX_CONFIG);
    // await connection.confirmTransaction(signature);

    // Wait before next iteration to avoid rate limits
    await sleep(3_000);
  }
})();
