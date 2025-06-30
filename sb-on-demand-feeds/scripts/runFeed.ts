/**
 * @fileoverview Switchboard On-Demand Feed Update Example
 * 
 * This script demonstrates how to update an existing Switchboard feed account
 * with fresh oracle data. Use this when you have already created a feed
 * (using createFeed.ts) and need to continuously update it with new prices.
 * 
 * This approach is useful when:
 * - You need persistent price history on-chain
 * - Multiple programs need to read from a consistent feed address
 * - You're building price archives or analytics systems
 * 
 * For most use cases, the bundle approach (runBundle.ts) is more efficient.
 * 
 * @example
 * ```bash
 * # Update an existing feed with fresh prices
 * bun run scripts/runFeed.ts --feed GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR
 * 
 * # Using environment variables
 * ANCHOR_WALLET=~/.config/solana/id.json bun run scripts/runFeed.ts --feed <FEED_PUBKEY>
 * ```
 * 
 * @module runFeed
 */

import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { TX_CONFIG, sleep } from "./utils";
import { PublicKey } from "@solana/web3.js";

/**
 * Command-line argument parser
 * 
 * @property {string} feed - The public key of the feed account to update
 *                          This should be a feed created with createFeed.ts
 */
const argv = yargs(process.argv).options({ 
  feed: { 
    type: 'string',
    required: true,
    description: 'Public key of the feed account to update',
    example: 'GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR'
  } 
}).argv as any;

/**
 * Calculates statistical metrics for latency measurements
 * 
 * Tracks performance metrics to monitor oracle response times
 * and identify potential network or performance issues.
 * 
 * @param {number[]} latencies - Array of latency measurements in milliseconds
 * @returns {Object} Statistical summary including:
 *   - min: Minimum latency observed
 *   - max: Maximum latency observed
 *   - median: Middle value when sorted
 *   - mean: Average latency
 *   - count: Total number of measurements
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
 * Main execution function for updating an existing feed
 * 
 * This function:
 * 1. Loads the feed account from the provided address
 * 2. Fetches the gateway URL for oracle communication
 * 3. Continuously fetches and publishes price updates
 * 4. Tracks performance metrics for monitoring
 * 
 * @async
 * @function main
 * @throws {Error} If the feed account doesn't exist or is invalid
 */
(async function main() {
  // Load Solana environment configuration
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  
  // Load the existing feed account
  // This will fail if the provided address is not a valid feed
  const feedAccount = new sb.PullFeed(program!, argv.feed!);
  
  // Fetch the gateway URL associated with this feed
  // The gateway provides access to oracle operators
  const gateway = await feedAccount.fetchGatewayUrl();
  
  // Track latency metrics for performance monitoring
  const latencies: number[] = [];

  // Main update loop - continuously fetches and publishes price updates
  while (true) {
    // Start timing for latency measurement
    const start = Date.now();
    
    // Fetch update instructions from oracle operators
    // This call:
    // 1. Queries oracles based on the feed's job definitions
    // 2. Collects price data and signatures
    // 3. Builds the update instructions
    // 4. Returns lookup tables for transaction optimization
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx({
      gateway,
    });
    
    // Calculate fetch latency
    const endTime = Date.now();
    
    // Check for any errors in oracle responses
    // This helps identify issues with specific data sources
    for (const response of responses) {
      const shortErr = response.shortError();
      if (shortErr) {
        console.log(`Error: ${shortErr}`);
      }
    }
    
    // Build the update transaction
    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx!],           // Spread the update instructions
      signers: [keypair],           // Transaction signer
      computeUnitPrice: 20_000,     // Priority fee for inclusion
      computeUnitLimitMultiple: 1.3, // 30% compute buffer
      lookupTables: luts,           // Address lookup tables
    });

    // Simulate the transaction to verify it will succeed
    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    
    // Extract and parse the price update event from logs
    // This shows the actual price values that would be written
    const updateEvent = new sb.PullFeedValueEvent(
      sb.AnchorUtils.loggedEvents(program!, sim.value.logs!)[0]
    ).toRows();
    
    // Display simulation results
    console.log("Simulated Price Updates:\n", JSON.stringify(sim.value.logs));
    console.log("Submitted Price Updates:\n", updateEvent);
    
    // Track fetch latency
    const latency = endTime - start;
    latencies.push(latency);

    // Display performance statistics
    const stats = calculateStatistics(latencies);
    console.log(`Min latency: ${stats.min} ms`);
    console.log(`Max latency: ${stats.max} ms`);
    console.log(`Median latency: ${stats.median} ms`);
    console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
    console.log(`Loop count: ${stats.count}`);
    
    // To actually send the transaction, uncomment these lines:
    // console.log(`Transaction sent: ${await connection.sendTransaction(tx)}`);
    // await sleep(3_000); // Wait 3 seconds before next update
    
    // Note: This example only simulates transactions
    // In production, you would send the transaction and handle errors
  }
})();
