import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote, isMainnetConnection } from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import yargs from "yargs";
import {
  TX_CONFIG,
  sleep,
  loadAdvancedProgram,
  advancedProcessOracleIx,
  advancedCrankOracleIx,
  advancedInitStateIx,
  advancedInitOracleIx,
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
 * Advanced Oracle Update Example with Performance Monitoring
 *
 * This example demonstrates production-ready oracle integration with:
 * 1. Auto-detection of network (mainnet/devnet) and queue selection
 * 2. Managed oracle updates using the quote program
 * 3. Advanced oracle data parsing and display (multiple feeds)
 * 4. Address Lookup Tables for transaction optimization
 * 5. Performance monitoring and metrics tracking
 * 6. Continuous processing loop with comprehensive error handling
 *
 * What makes this "advanced" compared to the basic example:
 * - Performance metrics tracking and statistics
 * - Continuous loop with proper timing
 * - Address lookup table optimization
 * - More sophisticated error handling
 * - The advanced program can parse and display multiple feeds with detailed info
 */
(async function main() {
  // Load Solana environment configuration from standard locations
  // Expects ANCHOR_WALLET environment variable or ~/.config/solana/id.json
  const { program, keypair, connection, crossbar } =
    await sb.AnchorUtils.loadEnv();
  console.log("RPC:", connection.rpcEndpoint);

  // Auto-detect network and load appropriate queue
  console.log("🔍 Auto-detecting network and selecting optimal queue...");
  const queue = await sb.Queue.loadDefault(program!);

  // Display network detection results using proper method
  const isMainnet = await isMainnetConnection(connection);
  console.log("🌐 Network detected:", isMainnet ? "mainnet" : "devnet");
  console.log("🌐 Queue selected:", queue.pubkey.toBase58());

  // Load the advanced oracle example program ID (Pinocchio version)
  const advancedProgramId = await loadAdvancedProgram();

  // No initialization needed for the simplified advanced program
  console.log("👍 Advanced program ID loaded:", advancedProgramId.toBase58());

  // Load the address lookup table for transaction size optimization
  // This significantly reduces transaction size by using indices instead of full addresses
  const lut = await queue.loadLookupTable();

  // Step 1: Derive the canonical quote account from feed hashes
  // This uses the same derivation logic as the quote program
  // Both fetchQuoteIx and quote account derivation use the advanced program ID
  const [quoteAccount] = OracleQuote.getCanonicalPubkey(
    queue.pubkey,
    [argv.feedId],
    advancedProgramId
  );
  console.log("📍 Quote Account (derived):", quoteAccount.toBase58());

  // Track latency measurements for performance monitoring
  const latencies: number[] = [];

  // Main execution loop - continuously fetches and processes oracle updates
  // Measure quote fetch latency for performance monitoring
  const start = Date.now();

  console.log("\n🔄 Processing oracle update for feed:", argv.feedId);

  // Step 2: Fetch managed update instructions
  // This gets both Ed25519 verification and quote program instructions
  const instruction = await queue.fetchQuoteIx(crossbar, [argv.feedId], {
    numSignatures: 1, // Use single signature for fastest updates
    variableOverrides: {},
    instructionIdx: 0, // Ed25519 instruction index
  });

  // Calculate and track fetch latency
  const endTime = Date.now();
  const latency = endTime - start;
  latencies.push(latency);

  // Decode the oracle quote data from the Ed25519 instruction
  const decodedQuote = OracleQuote.decode(instruction.data);
  console.log("\n📊 Decoded Oracle Quote:");
  console.log("  Discriminator:", decodedQuote.discriminator);
  console.log("  Version:", decodedQuote.version);
  console.log("  Recent Slot:", decodedQuote.recentSlot.toString());
  console.log("  Signed Slothash:", decodedQuote.signedSlothash.toString("hex"));
  console.log("  Oracle Indexes:", decodedQuote.oracleIndexes);
  console.log("\n  Feed Infos:");
  decodedQuote.feedInfos.forEach((feed, idx) => {
    console.log(`    Feed ${idx}:`);
    console.log(`      Feed Hash: ${feed.feedHash.toString("hex")}`);
    console.log(`      Value: ${feed.value}`);
    console.log(`      Min Oracle Samples: ${feed.minOracleSamples}`);
  });

  // Step 3: Check if state account is initialized and create init instruction if needed
  const [stateAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    advancedProgramId
  );

  let initStateIx: TransactionInstruction | null = null;

  console.log("🔍 Debug Info:");
  console.log("Advanced Program ID:", advancedProgramId.toBase58());
  console.log("State Account (derived):", stateAccount.toBase58());
  console.log("Payer:", keypair.publicKey.toBase58());

  try {
    const stateAccountInfo = await connection.getAccountInfo(stateAccount);
    if (!stateAccountInfo || stateAccountInfo.lamports === 0) {
      console.log(
        "🔧 State account not initialized, creating init instruction..."
      );
      initStateIx = await advancedInitStateIx(
        advancedProgramId,
        keypair.publicKey
      );

      // Log the accounts in the init instruction
      console.log("📋 Init State Instruction Accounts:");
      initStateIx.keys.forEach((key, index) => {
        console.log(
          `  Account ${index}: ${key.pubkey.toBase58()} (signer: ${
            key.isSigner
          }, writable: ${key.isWritable})`
        );
      });
    } else {
      console.log("✅ State account already initialized");
    }
  } catch (error) {
    console.log("🔧 State account not found, creating init instruction...");
    initStateIx = await advancedInitStateIx(
      advancedProgramId,
      keypair.publicKey
    );

    // Log the accounts in the init instruction
    console.log("📋 Init State Instruction Accounts:");
    initStateIx.keys.forEach((key, index) => {
      console.log(
        `  Account ${index}: ${key.pubkey.toBase58()} (signer: ${
          key.isSigner
        }, writable: ${key.isWritable})`
      );
    });
  }

  // Step 4: Check if quote account is initialized and create init instruction if needed
  let initOracleIx: TransactionInstruction | null = null;
  try {
    const quoteAccountInfo = await connection.getAccountInfo(quoteAccount);
    if (!quoteAccountInfo || quoteAccountInfo.lamports === 0) {
      console.log(
        "🔧 Quote account not initialized, creating init instruction..."
      );
      initOracleIx = await advancedInitOracleIx(
        advancedProgramId,
        quoteAccount,
        queue.pubkey,
        keypair.publicKey
      );

      // Log the accounts in the init oracle instruction
      console.log("📋 Init Oracle Instruction Accounts:");
      initOracleIx.keys.forEach((key, index) => {
        console.log(
          `  Account ${index}: ${key.pubkey.toBase58()} (signer: ${
            key.isSigner
          }, writable: ${key.isWritable})`
        );
      });
    } else {
      console.log("✅ Quote account already initialized");
    }
  } catch (error) {
    console.log("🔧 Quote account not found, creating init instruction...");
    initOracleIx = await advancedInitOracleIx(
      advancedProgramId,
      quoteAccount,
      queue.pubkey,
      keypair.publicKey
    );

    // Log the accounts in the init oracle instruction
    console.log("📋 Init Oracle Instruction Accounts:");
    initOracleIx.keys.forEach((key, index) => {
      console.log(
        `  Account ${index}: ${key.pubkey.toBase58()} (signer: ${
          key.isSigner
        }, writable: ${key.isWritable})`
      );
    });
  }

  // Step 5: Create the crank instruction to update the quote account
  const crankOracleIx = await advancedCrankOracleIx(
    advancedProgramId,
    quoteAccount,
    queue.pubkey,
    keypair.publicKey
  );

  // Log the accounts in the crank instruction
  console.log("📋 Crank Instruction Accounts:");
  crankOracleIx.keys.forEach((key, index) => {
    console.log(
      `  Account ${index}: ${key.pubkey.toBase58()} (signer: ${
        key.isSigner
      }, writable: ${key.isWritable})`
    );
  });

  // Step 6: Create the advanced program instruction to read and display quote data
  const parseOracleIx = await advancedProcessOracleIx(
    advancedProgramId,
    quoteAccount,
    queue.pubkey
  );

  // Display performance statistics for monitoring
  const stats = calculateStatistics(latencies);
  console.log(
    `📊 Performance Stats - Min: ${stats.min}ms | Median: ${
      stats.median
    }ms | Mean: ${stats.mean.toFixed(2)}ms | Count: ${stats.count}`
  );

  // Step 7: Build instruction list conditionally including init instructions if needed
  const instructions = [instruction];
  if (initStateIx) {
    instructions.push(initStateIx);
    console.log("📦 Transaction will include init_state instruction");
  }
  if (initOracleIx) {
    instructions.push(initOracleIx);
    console.log("📦 Transaction will include init_oracle instruction");
  }
  instructions.push(crankOracleIx, parseOracleIx);

  console.log("📦 Final transaction instruction count:", instructions.length);
  console.log(
    "📦 Instruction order:",
    instructions.map((ix, i) => {
      if (i === 0) return "Ed25519 verification";
      if (ix === initStateIx) return "init_state";
      if (ix === initOracleIx) return "init_oracle";
      if (ix === crankOracleIx) return "crank";
      if (ix === parseOracleIx) return "read";
      return "unknown";
    })
  );

  // Step 8: Build and send the transaction with lookup table optimization
  // V0 transactions support address lookup tables and are more efficient
  const tx = await sb.asV0Tx({
    connection,
    ixs: instructions,
    signers: [keypair],
    computeUnitPrice: 10_000, // Priority fee
    computeUnitLimitMultiple: 1.3, // 10% buffer
  });

  // Send the transaction
  try {
    const sim = await connection.simulateTransaction(tx);
    console.log(sim.value.logs?.join("\n"));
    if (sim.value.err) {
      console.error("❌ Simulation failed:", sim.value.err);
      return;
    }
    const sig = await connection.sendTransaction(tx, TX_CONFIG);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("✅ Transaction successful:", sig);
  } catch (error) {
    console.error("❌ Transaction failed:", error);
  }
})();
