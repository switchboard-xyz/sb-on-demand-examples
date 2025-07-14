/**
 * @fileoverview Compute Unit Benchmark Tool
 * 
 * This script measures the compute units (CU) consumed by Switchboard
 * oracle updates with varying configurations. It helps developers:
 * 
 * - Optimize transaction compute budgets
 * - Understand scaling characteristics
 * - Plan for multi-feed implementations
 * - Estimate transaction costs
 * 
 * The benchmark tests different combinations of:
 * - Number of feeds (1-5)
 * - Number of oracle signatures (1-5)
 * 
 * Results show how compute usage scales with complexity, helping
 * you choose the optimal configuration for your use case.
 * 
 * @example
 * ```bash
 * # Run the compute unit benchmark
 * bun run scripts/benchmarkCU.ts
 * 
 * # Output example:
 * # Running test with 2 feed(s) and 3 signature(s)...
 * # Time to fetch update: 387ms
 * # Compute units used: 145,230
 * # Transaction sent: 5xY9Z...
 * ```
 * 
 * @module benchmarkCU
 */

import * as sb from "@switchboard-xyz/on-demand";
import { TX_CONFIG, sleep} from "../utils";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorUtils } from "@switchboard-xyz/on-demand";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

/**
 * Main benchmark execution
 * 
 * Systematically tests different feed and signature combinations
 * to measure compute unit consumption. This helps understand:
 * 
 * - Base CU cost for oracle verification
 * - Incremental cost per additional feed
 * - Incremental cost per additional signature
 * - Optimal configurations for different use cases
 * 
 * @async
 * @function main
 */
(async function main() {
  // Initialize connection to Solana devnet
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  
  // Load keypair - update this path to your keypair location
  const keypair = await AnchorUtils.initKeypairFromFile("/Users/alexstewart/.config/solana/switchboard_work.json");
  const wallet = new NodeWallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet);
  
  // Connect to Switchboard program on devnet
  const pid = sb.ON_DEMAND_DEVNET_PID;
  const program = await anchor.Program.at(pid, provider);

  /**
   * Test feed accounts on devnet
   * 
   * These are pre-deployed example feeds used for benchmarking.
   * Replace with your own feed addresses if testing specific
   * configurations or job definitions.
   */
  const feeds = [
    new PublicKey("CmZjMhReYDmUZnwCLGhuE6Q5UyjUvAxSSEZNLAehMuY9"),
    new PublicKey("ceuXtwYhAd3hs9xFfcrZZq6byY1s9b1NfsPckVkVyuC"),
    new PublicKey("J9nrFWjDUeDVZ4BhhxsbQXWgLcLEgQyNBrCbwSADmJdr"),
    new PublicKey("F8oaENnmLEqyHoiX6kqYu7WbbMGvuoB15fXfWX6SXUdZ"),
    new PublicKey("69XisEUvgWYoKd9TiBWnqgZbFvW7jKTsAitjhjhZ19K"),
  ];

  // Test matrix: vary both number of feeds and signatures
  for (let numFeeds = 1; numFeeds <= 5; numFeeds++) {
    for (let numSignatures = 1; numSignatures <= 5; numSignatures++) {
      console.log(`Running test with ${numFeeds} feed(s) and ${numSignatures} signature(s)...`);
      
      // Select subset of feeds for this test iteration
      const selectedFeeds = feeds.slice(0, numFeeds);
      
      // Measure oracle fetch time
      const timestart = Date.now();
      try {
        // Fetch update instructions for multiple feeds
        // More signatures = higher security but more compute
        const [pullIx, luts] = await sb.PullFeed.fetchUpdateManyIx(program, {
          feeds: selectedFeeds,
          numSignatures: numSignatures,
        });
        const timeEnd = Date.now();
        console.log(`Time to fetch update: ${timeEnd - timestart}ms`);
        
        // Build transaction with fetched instructions
        const tx = await sb.asV0Tx({
          connection,
          ixs: [pullIx[0], pullIx[1]], // Signature verification + update instructions
          signers: [keypair],
          computeUnitPrice: 200_000,    // Priority fee for consistent inclusion
          computeUnitLimitMultiple: 1.3, // 30% buffer on compute units
          lookupTables: luts,           // Address lookup tables for efficiency
        });
        
        // Simulate to measure compute units
        const sim = await connection.simulateTransaction(tx, TX_CONFIG);
        const computeUnits = sim.value.unitsConsumed;
        console.log(`Compute units used: ${computeUnits}`);
        
        // Send actual transaction to verify real-world behavior
        const sentTx = await connection.sendTransaction(tx);
        console.log(`Transaction sent: ${sentTx}`);
      } catch (error) {
        console.error(`Error with ${numFeeds} feeds and ${numSignatures} signatures:`, error);
      }
      
      // Delay between tests to avoid rate limits
      await sleep(3000);
    }
  }
  
  console.log("All test cases completed.");
})();
