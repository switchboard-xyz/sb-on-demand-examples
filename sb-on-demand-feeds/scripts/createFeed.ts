/**
 * @fileoverview Switchboard On-Demand Feed Creation Example
 * 
 * This script demonstrates how to create and manage persistent feed accounts
 * for Switchboard oracles. While the bundle approach (runBundle.ts) is more
 * efficient for most use cases, feed accounts are useful when you need:
 * 
 * - Persistent on-chain price history
 * - Other programs to read your price data
 * - Price archives for analytics
 * - Standardized feed addresses across multiple consumers
 * 
 * The script creates a feed, stores job definitions on IPFS, and continuously
 * updates the feed with fresh price data.
 * 
 * @example
 * ```bash
 * # Create and update a BTC price feed on devnet
 * bun run scripts/createFeed.ts
 * 
 * # Use mainnet queue
 * bun run scripts/createFeed.ts --mainnet
 * ```
 * 
 * @module createFeed
 */

import { PublicKey, Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  PullFeed,
} from "@switchboard-xyz/on-demand";
import {
  buildCoinbaseJob,
  buildChainlinkJob,
  buildBinanceJob,
  buildPythJob,
  buildRedstoneJob,
  buildEdgeJob,
  buildBybitJob,
  TX_CONFIG,
  sleep
} from "./utils";
import yargs from "yargs";
import { CrossbarClient, decodeString } from "@switchboard-xyz/common";

/**
 * Command-line argument parser
 * 
 * @property {boolean} mainnet - Whether to use mainnet queue instead of devnet
 */
let argv = yargs(process.argv).options({
  mainnet: { 
    type: "boolean", 
    describe: "Use mainnet queue",
    default: false 
  },
}).argv;

/**
 * Crossbar client for storing feed configurations on IPFS
 * 
 * Crossbar provides decentralized storage for oracle job definitions,
 * allowing feeds to reference complex job configurations without
 * storing them entirely on-chain.
 */
const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

/**
 * Oracle job definitions for the BTC price feed
 * 
 * This array defines multiple data sources that will be queried
 * to calculate the aggregated BTC price. Using multiple sources
 * improves reliability and resistance to manipulation.
 * 
 * The jobs are divided into two categories:
 * 1. Oracle sources - On-chain oracle feeds (Pyth, Chainlink, etc.)
 * 2. CEX sources - Centralized exchange APIs (Binance, Coinbase, etc.)
 */
const FEED_JOBS = [
  // ORACLES - On-chain price feeds for reliability
  buildPythJob(
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // BTC/USD Pyth feed
  ),
  buildChainlinkJob("0x6ce185860a4963106506C203335A2910413708e9"), // BTC/USD Chainlink
  buildRedstoneJob("BTC"),
  buildEdgeJob("BTC/USD"),
  // CEX - Centralized exchange prices for market accuracy
  buildBinanceJob("BTCUSDC"),
  buildCoinbaseJob("BTC"),
  buildBybitJob("BTCUSDC"),
];

/**
 * Main execution function for creating and updating a feed
 * 
 * This function:
 * 1. Loads the Solana environment and connects to the network
 * 2. Creates a new feed account with specified configuration
 * 3. Stores job definitions on IPFS via Crossbar
 * 4. Continuously fetches and publishes price updates
 * 
 * @async
 * @function main
 */
(async function main() {
  // Load environment configuration
  // Expects ANCHOR_WALLET environment variable or ~/.config/solana/id.json
  const { keypair, connection, program } = await AnchorUtils.loadEnv();
  
  // Get the default oracle queue for the current network
  // The queue contains the list of oracle operators who will fulfill requests
  const queueAccount = await sb.getDefaultQueue(connection.rpcEndpoint);
  const queue = queueAccount.pubkey;

  /**
   * Feed configuration parameters
   * 
   * These settings control how the feed operates and validates data:
   * 
   * @property {string} name - Human-readable feed name (max 32 bytes)
   * @property {PublicKey} queue - Oracle queue to use for this feed
   * @property {number} maxVariance - Maximum allowed variance (1.0 = 100%)
   * @property {number} minResponses - Minimum oracle responses required
   * @property {number} numSignatures - Number of oracle signatures per update
   * @property {number} minSampleSize - Minimum samples for valid result
   * @property {number} maxStaleness - Maximum age of data in slots (~400ms each)
   */
  const conf: any = {
    name: "BTC Price Feed", // the feed name (max 32 bytes)
    queue: new PublicKey(queue), // the queue of oracles to bind to
    maxVariance: 1.0, // allow 100% variance between submissions and jobs
    minResponses: 1, // minimum number of responses of jobs to allow
    numSignatures: 3, // number of signatures to fetch per update
    minSampleSize: 1, // minimum number of responses to sample for a result
    maxStaleness: 60, // maximum stale slots of responses to sample
  };

  // Create a new feed account
  console.log("Initializing new data feed");
  const [pullFeed, feedKp] = PullFeed.generate(program!);
  
  // Store the job definitions on IPFS via Crossbar
  // This returns a hash that references the job configuration
  // The hash is stored on-chain, while the full job definitions
  // are stored on IPFS for cost efficiency
  conf.feedHash = decodeString(
    (await crossbarClient.store(queue.toString(), FEED_JOBS)).feedHash
  );
  
  // Build the initialization transaction
  const initTx = await sb.asV0Tx({
    connection,
    ixs: [await pullFeed.initIx(conf)],
    payer: keypair.publicKey,
    signers: [keypair, feedKp],
    computeUnitPrice: 75_000,      // Priority fee for faster inclusion
    computeUnitLimitMultiple: 1.3,  // 30% buffer on compute units
  });
  
  // Send and confirm the initialization transaction
  console.log("Sending initialize transaction");
  const sig = await connection.sendTransaction(initTx, TX_CONFIG);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Feed ${feedKp.publicKey} initialized: ${sig}`);

  // Main update loop - continuously fetches and publishes price updates
  while (true) {
    // Fetch the latest price data and build update instructions
    // This call:
    // 1. Queries oracle operators for fresh price data
    // 2. Collects signatures from multiple oracles
    // 3. Builds the transaction instructions
    // 4. Returns any needed lookup tables for optimization
    const [pullIx, responses, _ok, luts] = await pullFeed.fetchUpdateIx(conf);

    // Build the update transaction
    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx!],
      signers: [keypair],
      computeUnitPrice: 200_000,    // Higher priority for timely updates
      computeUnitLimitMultiple: 1.3, // 30% compute buffer
      lookupTables: luts,            // Address lookup tables for efficiency
    });

    // Simulate to verify and extract the price update event
    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const updateEvent = new sb.PullFeedValueEvent(
      sb.AnchorUtils.loggedEvents(program!, sim.value.logs!)[0]
    ).toRows();
    console.log("Submitted Price Updates:\n", updateEvent);
    
    // Send the actual transaction
    // In production, you should handle errors and retry logic
    console.log(`\tTx Signature: ${await connection.sendTransaction(tx)}`);
    
    // Wait before next update to avoid rate limits
    await sleep(3000);
  }
})();

