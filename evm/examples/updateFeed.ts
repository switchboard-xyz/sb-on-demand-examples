/**
 * @fileoverview Example demonstrating how to fetch and update Switchboard oracle prices on EVM chains
 *
 * This script shows:
 * - Fetching signed price data from Crossbar
 * - Submitting oracle updates to your contract
 * - Reading and parsing updated feed values
 * - Event parsing and logging
 *
 * Run with: bun run examples/updateFeed.ts
 */

import * as ethers from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";

(async function main() {
  // Parse the response as JSON
  const secret = process.env.PRIVATE_KEY as string;
  if (!secret) {
    throw new Error("No private key provided");
  }

  // Create a provider
  const provider = new ethers.JsonRpcProvider(
    "https://rpc.hyperliquid.xyz/evm"
  );

  // Create a signer
  const signerWithProvider = new ethers.Wallet(secret, provider);

  // Target contract address (your deployed Example contract)
  const exampleAddress = process.env.EXAMPLE_ADDRESS as string;
  if (!exampleAddress) {
    throw new Error("No example contract address provided");
  }

  // for tokens (this is the Human-Readable ABI format)
  const abi = [
    "function getFeedData(bytes[] calldata updates) public payable",
    "function aggregatorId() public view returns (bytes32)",
    "function latestPrice() public view returns (int256)",
    "function lastUpdateTimestamp() public view returns (uint256)",
    "function lastOracleId() public view returns (bytes32)",
    "function getLatestUpdate() external view returns (int128 result, uint256 timestamp, bytes32 oracleId)",
    "event FeedData(int128 price, uint256 timestamp, bytes32 oracleId)",
  ];

  const crossbar = new CrossbarClient(`https://crossbar.switchboard.xyz`);

  // The Contract object
  const exampleContract = new ethers.Contract(
    exampleAddress,
    abi,
    signerWithProvider
  );

  // Get the aggregator ID from the contract
  const aggregatorId = await exampleContract.aggregatorId();
  console.log("Aggregator ID:", aggregatorId);

  // Get the encoded updates
  const { encoded } = await crossbar.fetchEVMResults({
    chainId: 999, // Use the correct chain ID for your network
    aggregatorIds: [aggregatorId],
  });

  console.log("Encoded updates length:", encoded.length);

  // Update the contract + do some business logic
  const tx = await exampleContract.getFeedData(encoded);

  console.log("Transaction hash:", tx.hash);

  // Wait for transaction confirmation
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);

  // Parse events from the transaction
  if (receipt.logs) {
    const iface = new ethers.Interface(abi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === "FeedData") {
          console.log("\n=== Feed Update Event ===");
          console.log("Price:", parsed.args.price.toString());
          console.log("Timestamp:", new Date(Number(parsed.args.timestamp) * 1000).toISOString());
          console.log("Oracle ID:", parsed.args.oracleId);
        }
      } catch (e) {
        // Skip logs that don't match our interface
      }
    }
  }

  // Get detailed update information
  const [result, timestamp, oracleId] = await exampleContract.getLatestUpdate();
  console.log("\n=== Latest Update Details ===");
  console.log("Result:", result.toString());
  console.log("Timestamp:", new Date(Number(timestamp) * 1000).toISOString());
  console.log("Oracle ID:", oracleId);

  // Also log the individual values for backwards compatibility
  console.log("\n=== Individual Contract Values ===");
  console.log("Latest Price:", await exampleContract.latestPrice());
  console.log("Last Update Timestamp:", await exampleContract.lastUpdateTimestamp());
  console.log("Last Oracle ID:", await exampleContract.lastOracleId());
}();
