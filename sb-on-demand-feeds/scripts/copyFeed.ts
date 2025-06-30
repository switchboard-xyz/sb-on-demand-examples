/**
 * @fileoverview Switchboard Feed Copy Utility
 * 
 * This script demonstrates how to copy an existing Switchboard feed's
 * configuration to create a new feed with identical job definitions.
 * This is useful when you need to:
 * 
 * - Create multiple feeds with the same data sources
 * - Clone a feed for testing or development
 * - Migrate feeds between different accounts
 * - Create backup feeds with identical configurations
 * 
 * The script preserves the original feed's job definitions (stored on IPFS)
 * while creating a new on-chain feed account.
 * 
 * @example
 * ```bash
 * # Copy an existing feed to a new account
 * bun run scripts/copyFeed.ts --feed GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR
 * 
 * # Using environment variables
 * ANCHOR_WALLET=~/.config/solana/id.json bun run scripts/copyFeed.ts --feed <FEED_PUBKEY>
 * ```
 * 
 * @module copyFeed
 */

import { PublicKey, Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  PullFeed,
} from "@switchboard-xyz/on-demand";
import { myAnchorProgram, sleep, TX_CONFIG } from "./utils";
import yargs from "yargs";
import * as anchor from "@coral-xyz/anchor";
import { CrossbarClient } from "@switchboard-xyz/common";

/**
 * Command-line argument parser
 * 
 * @property {string} feed - Public key of the existing feed to copy
 *                          The feed must exist on the current network
 */
const argv = yargs(process.argv).options({ 
  feed: { 
    type: 'string',
    required: true,
    description: 'Public key of the existing feed to copy',
    example: 'GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR'
  } 
}).argv as any;

/**
 * Creates an instruction for your program to interact with the feed
 * 
 * This is an example of how you might use the copied feed in your
 * own program. Replace this with your actual program logic.
 * 
 * @param {anchor.Program} program - Your Anchor program instance
 * @param {PublicKey} feed - The feed account public key
 * @returns {Promise<TransactionInstruction>} Instruction to add to transaction
 */
async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

/**
 * Crossbar client for accessing feed configurations
 * 
 * Used to retrieve the original feed's job definitions from IPFS
 * and store them for the new feed.
 */
const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

/**
 * Main execution function for copying a feed
 * 
 * This function:
 * 1. Loads the source feed's configuration
 * 2. Retrieves the feed's job definitions from IPFS
 * 3. Creates a new feed with identical configuration
 * 4. Continuously updates the new feed with fresh data
 * 
 * @async
 * @function main
 * @throws {Error} If the source feed doesn't exist or is invalid
 */
(async function main() {
  // Load Solana environment configuration
  const { keypair, connection, program } = await AnchorUtils.loadEnv();
  
  // Load your program that will consume the feed data
  const myProgramPath = "target/deploy/sb_on_demand_solana-keypair.json";
  const myProgram = await myAnchorProgram(program!.provider, myProgramPath);
  
  // Get the default oracle queue for the current network
  const queueAccount = await sb.getDefaultQueue(connection.rpcEndpoint);
  const queue = queueAccount.pubkey;
  
  // Verify the queue exists on this network
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  /**
   * Transaction options for faster processing
   */
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };
  
  /**
   * Configuration for the new feed
   * 
   * These settings will override the source feed's configuration
   * while preserving its job definitions. Adjust as needed:
   * 
   * @property {string} name - Display name for the new feed
   * @property {PublicKey} queue - Oracle queue (usually same as source)
   * @property {number} maxVariance - Max allowed price variance (1.0 = 100%)
   * @property {number} minResponses - Min oracle responses required
   * @property {number} numSignatures - Oracle signatures per update
   * @property {number} minSampleSize - Min samples for valid result
   * @property {number} maxStaleness - Max data age in slots
   */
  const conf = {
    name: "BTC Price Feed", // the feed name (max 32 bytes)
    queue, // the queue of oracles to bind to
    maxVariance: 1.0, // allow 100% variance between submissions and jobs
    minResponses: 1, // minimum number of responses of jobs to allow
    numSignatures: 3, // number of signatures to fetch per update
    minSampleSize: 1, // minimum number of responses to sample
    maxStaleness: 60,// maximum staleness of responses in seconds to sample
  };

  // Load the source feed to copy
  let pullFeed: PullFeed;
  console.log("Copy existing data feed with address:", argv.feed);
  
  // Create a PullFeed instance for the source feed
  pullFeed = new PullFeed(program!, new PublicKey(argv.feed));
  
  // Load the source feed's data, including its job definitions hash
  let feedData = await pullFeed.loadData();
  
  // Extract the feed hash that points to job definitions on IPFS
  // This preserves the exact data sources from the original feed
  let decodedFeedHash = Buffer.from(feedData.feedHash);

  // Create a new feed with the copied configuration
  const [pullFeed_, feedKp] = PullFeed.generate(program!);
  
  // Build initialization transaction with copied feed hash
  const tx = await sb.asV0Tx({
    connection: program!.provider.connection,
    ixs: [await pullFeed_.initIx({ 
      ...conf,                    // Use our configuration
      feedHash: decodedFeedHash   // But preserve original job definitions
    })],
    payer: keypair.publicKey,
    signers: [keypair, feedKp],
    computeUnitPrice: 75_000,      // Priority fee for faster inclusion
    computeUnitLimitMultiple: 1.3,  // 30% compute buffer
  });
  
  // Sign with both payer and new feed keypair
  tx.sign([keypair, feedKp]);
  
  // Send the initialization transaction
  console.log("Sending initialize transaction");
  const sim = await connection.simulateTransaction(tx, txOpts);
  const sig = await connection.sendTransaction(tx, txOpts);
  console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);
  
  // Update our reference to use the new feed
  pullFeed = pullFeed_;
  
  // Wait for confirmation
  await sleep(5000);

  // Main update loop - continuously updates the new feed
  while (true) {
    // Fetch update instructions using the same oracle sources
    // as the original feed (via the copied feedHash)
    const [pullIx, responses, _ok, luts] = await pullFeed.fetchUpdateIx(conf);
    
    // Build the update transaction
    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx!],            // Update instructions
      signers: [keypair],            // Transaction signer
      computeUnitPrice: 200_000,     // Higher priority for updates
      computeUnitLimitMultiple: 1.3, // 30% compute buffer
      lookupTables: luts,            // Address lookup tables
    });
    
    // Simulate to verify and extract price data
    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const updateEvent = new sb.PullFeedValueEvent(
      sb.AnchorUtils.loggedEvents(program!, sim.value.logs!)[0]
    ).toRows();
    
    // Display results and send transaction
    console.log("Submitted Price Updates:\n", updateEvent);
    console.log(`\tTx Signature: ${await connection.sendTransaction(tx)}`);
    
    // Wait before next update
    await sleep(3000);
  }
})();
