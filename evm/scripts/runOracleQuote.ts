/**
 * @fileoverview Switchboard On-Demand Oracle Quote Example for EVM
 *
 * This script demonstrates the recommended approach for fetching and using
 * Switchboard oracle price feeds on EVM chains using the Oracle Quote-based method.
 * This offers:
 *
 * - Lower transaction costs compared to traditional oracle methods
 * - Sub-second latency for price updates
 * - No need for centralized keepers or feed maintenance
 * - Multiple price feeds in a single transaction
 *
 * @example
 * ```bash
 * # With an aggregator ID and private key
 * AGGREGATOR_ID=0x... PRIVATE_KEY=0x... EXAMPLE_ADDRESS=0x... bun run scripts/runOracleQuote.ts
 * ```
 *
 * @module runOracleQuote
 */

import * as ethers from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";

/**
 * Command-line argument parser for the script
 */
const argv = yargs(process.argv)
  .options({
    rpcUrl: {
      type: "string",
      default: "https://rpc.hyperliquid.xyz/evm",
      description: "RPC URL for the EVM network",
    },
    chainId: {
      type: "number",
      default: 999, // Hyperliquid
      description: "Chain ID for the EVM network",
    },
  })
  .parseSync();

/**
 * Calculates statistical metrics for latency measurements
 *
 * @param {number[]} latencies - Array of latency measurements in milliseconds
 * @returns {Object} Statistical summary including min, max, median, mean, count
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
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Main execution function demonstrating Oracle Quote-based oracle integration for EVM
 *
 * This function implements a continuous loop that:
 * 1. Fetches the latest Oracle Quote from Switchboard's Crossbar network
 * 2. Submits transactions to update the on-chain price
 * 3. Reads the updated price from the contract
 * 4. Tracks performance metrics for monitoring
 *
 * @async
 * @function main
 */
(async function main() {
  // Validate environment variables
  const secret = process.env.PRIVATE_KEY as string;
  if (!secret) {
    throw new Error("No private key provided. Set PRIVATE_KEY environment variable.");
  }

  const exampleAddress = process.env.EXAMPLE_ADDRESS as string;
  if (!exampleAddress) {
    throw new Error("No contract address provided. Set EXAMPLE_ADDRESS environment variable.");
  }

  // Create provider and signer
  const provider = new ethers.JsonRpcProvider(argv.rpcUrl);
  const signerWithProvider = new ethers.Wallet(secret, provider);

  // Contract ABI (Human-Readable format)
  const abi = [
    "function getFeedData(bytes[] calldata updates) public payable",
    "function aggregatorId() public view returns (bytes32)",
    "function latestPrice() public view returns (int256)",
    "function lastUpdateTimestamp() public view returns (uint256)",
    "function lastOracleId() public view returns (bytes32)",
    "function getLatestUpdate() external view returns (int128 result, uint256 timestamp, bytes32 oracleId)",
    "event FeedData(int128 price, uint256 timestamp, bytes32 oracleId)",
  ];

  // Initialize Crossbar client for fetching Oracle Quotes
  const crossbar = new CrossbarClient(`https://crossbar.switchboard.xyz`);

  // Create contract instance
  const exampleContract = new ethers.Contract(
    exampleAddress,
    abi,
    signerWithProvider
  );

  // Get the aggregator ID from the contract
  const aggregatorId = await exampleContract.aggregatorId();
  console.log(`Using Aggregator ID: ${aggregatorId}`);

  // Track latency measurements for performance monitoring
  const latencies: number[] = [];

  // Main execution loop - continuously fetches and processes oracle updates
  while (true) {
    try {
      // Measure Oracle Quote fetch latency
      const start = Date.now();

      // Fetch the Oracle Quote from Crossbar
      // This gets the latest signed price data from oracle operators
      const { encoded } = await crossbar.fetchEVMResults({
        chainId: argv.chainId,
        aggregatorIds: [aggregatorId],
      });

      // Calculate fetch latency
      const fetchEnd = Date.now();
      const fetchLatency = fetchEnd - start;
      latencies.push(fetchLatency);

      // Display performance statistics
      if (latencies.length > 0) {
        const stats = calculateStatistics(latencies);
        console.log(`\n--- Performance Stats ---`);
        console.log(`Min latency: ${stats.min} ms`);
        console.log(`Max latency: ${stats.max} ms`);
        console.log(`Median latency: ${stats.median} ms`);
        console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
        console.log(`Updates processed: ${stats.count}`);
      }

      // Estimate gas and get fee
      const gasEstimate = await exampleContract.getFeedData.estimateGas(
        encoded,
        { value: ethers.parseEther("0.01") } // Overestimate for safety
      );

      // Submit transaction to update the contract
      console.log("\nSubmitting price update transaction...");
      const tx = await exampleContract.getFeedData(encoded, {
        value: ethers.parseEther("0.001"), // Send some ETH for the oracle fee
        gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
      });

      // Wait for confirmation
      console.log(`Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Parse events from the transaction
      if (receipt.logs) {
        const iface = new ethers.Interface(abi);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "FeedData") {
              console.log(`\nFeed updated by oracle: ${parsed.args.oracleId.slice(0, 10)}...`);
              console.log(`Update timestamp: ${new Date(Number(parsed.args.timestamp) * 1000).toISOString()}`);
            }
          } catch (e) {
            // Skip logs that don't match our interface
          }
        }
      }

      // Read the updated price using the enhanced method
      const [result, timestamp, oracleId] = await exampleContract.getLatestUpdate();
      const formattedPrice = ethers.formatUnits(result, 18);
      console.log(`Latest price: $${formattedPrice}`);
      console.log(`Data age: ${Math.floor((Date.now() / 1000) - Number(timestamp))} seconds`);

      // Calculate total latency (fetch + transaction)
      const totalLatency = Date.now() - start;
      console.log(`Total update latency: ${totalLatency} ms`);

    } catch (error) {
      console.error("Error in update loop:", error);
      // In production, implement proper error handling and retry logic
    }

    // Wait before next iteration
    console.log("\nWaiting 5 seconds before next update...");
    await sleep(5000);
  }
})();