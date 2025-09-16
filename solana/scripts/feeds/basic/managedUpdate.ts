import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote, isMainnetConnection } from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import {
  TX_CONFIG,
  loadBasicProgram,
  basicReadOracleIx,
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
 * Basic Managed Oracle Update Example
 *
 * This example demonstrates the simplest way to use Switchboard's new managed update system
 * with the quote program. It shows how to:
 *
 * 1. Auto-detect network (mainnet/devnet) and choose appropriate queue
 * 2. Derive the canonical oracle account from feed hashes
 * 3. Use fetchManagedUpdateIxs to get both Ed25519 and quote program instructions
 * 4. Create a program instruction that reads from the managed oracle account
 * 5. Execute the transaction to update and consume oracle data
 *
 * The managed update system handles:
 * - Automatic network detection and queue selection
 * - Oracle account creation (if needed)
 * - Quote verification and storage
 * - Automatic account derivation
 * - Optimized instruction generation
 */
(async function main() {
  // Load Solana environment configuration
  const { program, keypair, connection, crossbar } = await sb.AnchorUtils.loadEnv();
  console.log("RPC:", connection.rpcEndpoint);
  console.log("Using feed ID:", argv.feedId);

  // Auto-detect network and load appropriate queue
  const queue = await sb.Queue.loadDefault(program!);
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar!);

  // Display network detection results using proper method
  const isMainnet = await isMainnetConnection(connection);
  console.log("🌐 Network detected:", isMainnet ? 'mainnet' : 'devnet');
  console.log("🌐 Queue selected:", queue.pubkey.toBase58());

  // Load the basic oracle example program
  const basicProgram = await loadBasicProgram(program!.provider);

  // Step 1: Derive the canonical oracle account from feed hashes
  // This uses the same derivation logic as the quote program
  const oracleAccount = OracleQuote.getCanonicalPubkey([argv.feedId]);
  console.log("📍 Oracle Account (derived):", oracleAccount.toBase58());

  // Step 2: Create managed update instructions
  // This returns both the Ed25519 signature verification instruction
  // and the quote program instruction that stores the verified data
  const instructions = await queue.fetchManagedUpdateIxs(
    gateway,
    crossbar,
    [argv.feedId],
    {
      numSignatures: 1, // Use single signature for fastest updates
      variableOverrides: {},
      instructionIdx: 0, // Ed25519 instruction index
      payer: keypair.publicKey,
    }
  );

  console.log("✨ Generated instructions:", instructions.length);
  console.log("  - Ed25519 signature verification");
  console.log("  - Quote program verified_update");

  // Step 3: Create your program instruction to read the oracle data
  // This instruction will read from the oracle account that was just updated
  const readOracleIx = await basicReadOracleIx(basicProgram, oracleAccount, queue.pubkey);

  // Step 4: Build and send the transaction
  const tx = await sb.asV0Tx({
    connection,
    ixs: [
      ...instructions,  // Managed update instructions
      readOracleIx,    // Your program instruction to consume the data
    ],
    signers: [keypair],
    computeUnitPrice: 20_000, // Priority fee
    computeUnitLimitMultiple: 1.3, // 30% buffer
  });

  // Send the transaction
  try {
    const sig = await connection.sendTransaction(tx, TX_CONFIG);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("✅ Transaction successful:", sig);
    console.log(`   View on explorer: https://solscan.io/tx/${sig}`);
  } catch (error) {
    console.error("❌ Transaction failed:", error);
  }

  console.log("\n🎯 Example completed!");
  console.log("The oracle data is now available in your program at:");
  console.log(`   Oracle Account: ${oracleAccount.toBase58()}`);
})();
