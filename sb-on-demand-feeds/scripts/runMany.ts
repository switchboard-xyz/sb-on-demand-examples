/**
 * @fileoverview Batch Feed Update Example
 * 
 * This script demonstrates how to update multiple Switchboard feeds
 * in a single transaction, which is more efficient than updating them
 * individually. This pattern is useful for:
 * 
 * - DeFi protocols requiring multiple price feeds atomically
 * - Reducing transaction costs by batching updates
 * - Ensuring all prices are from the same update cycle
 * - Managing correlated assets that should update together
 * 
 * The script shows how to:
 * - Update multiple feeds with a single oracle request
 * - Optimize transaction size with shared signatures
 * - Handle multiple feed responses efficiently
 * 
 * @example
 * ```bash
 * # Update multiple feeds in one transaction
 * bun run scripts/runMany.ts
 * 
 * # Using environment variables
 * ANCHOR_WALLET=~/.config/solana/id.json bun run scripts/runMany.ts
 * ```
 * 
 * @module runMany
 */

import * as sb from "@switchboard-xyz/on-demand";
import { TX_CONFIG, sleep } from "./utils";
import { PublicKey } from "@solana/web3.js";
import { BorshInstructionCoder } from "@coral-xyz/anchor";

/**
 * Main execution function for batch feed updates
 * 
 * This function demonstrates efficient multi-feed updates by:
 * 1. Loading multiple feed accounts
 * 2. Pre-heating feeds for optimal performance
 * 3. Fetching updates for all feeds in one request
 * 4. Submitting a single transaction with all updates
 * 
 * @async
 * @function main
 */
(async function main() {
  // Load Solana environment configuration
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  
  // Example feed addresses on devnet
  // Replace these with your own feed addresses created using createFeed.ts
  // These are pre-deployed example feeds for demonstration
  const f1Key = new PublicKey("F8oaENnmLEqyHoiX6kqYu7WbbMGvuoB15fXfWX6SXUdZ");
  const f2Key = new PublicKey("Fmx4PXYEt3rxnabPfuQYpQjgnC6DcytFPELHaVfQHmHz");
  
  // Create PullFeed instances for each feed
  const f1 = new sb.PullFeed(program!, f1Key);
  const f2 = new sb.PullFeed(program!, f2Key);
  
  // Pre-heat feeds to cache their configurations
  // This improves performance by loading feed data upfront
  await f1.preHeatFeed();
  await f2.preHeatFeed();
  
  // Fetch the gateway URL from the first feed
  // All feeds in the same queue share the same gateway
  const gateway = await f1.fetchGatewayUrl();
  
  console.log("Using feeds:", f1.pubkey.toBase58(), f2.pubkey.toBase58());
  // Main update loop - continuously updates multiple feeds together
  while (true) {
    // Fetch update instructions for multiple feeds in one call
    // This is more efficient than individual updates because:
    // 1. Oracle signatures are shared across feeds
    // 2. Network overhead is reduced
    // 3. All prices are from the same timestamp
    const [pullIx, luts] = await sb.PullFeed.fetchUpdateManyIx(program!, {
      gateway,              // Oracle gateway URL
      feeds: [f1, f2],      // Array of feeds to update
      numSignatures: 3,     // Number of oracle signatures to collect
    });

    // Build the batch update transaction
    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx],              // Spread all update instructions
      signers: [keypair],             // Transaction signer
      computeUnitPrice: 200_000,      // Higher priority for timely updates
      computeUnitLimitMultiple: 1.3,  // 30% compute buffer
      lookupTables: luts,             // Address lookup tables for efficiency
    });

    // Simulate the transaction to verify success
    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    
    // Decode and display the instruction data for debugging
    // This shows the actual parameters being sent to the program
    const ixCoder = new BorshInstructionCoder(program!.idl);
    console.log(
      "Submitting ix:",
      JSON.stringify(ixCoder.decode(pullIx.at(-1)!.data), null, 2)
    );
    
    // Display simulation logs showing price updates
    console.log(
      "Submitted Price Updates:\n",
      JSON.stringify(sim.value.logs!, null, 2)
    );
    
    // Send the transaction
    // In production, add error handling and retry logic
    console.log(`Transaction sent: ${await connection.sendTransaction(tx)}`);
    
    // Wait before next update batch
    await sleep(3000);
  }
})();
