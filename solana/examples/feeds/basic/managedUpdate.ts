import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote, isMainnetConnection } from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import * as fs from "fs";
import {
  TX_CONFIG,
  loadBasicProgram,
  basicReadOracleIx,
  BASIC_PROGRAM_PATH,
  DEFAULT_FEED_ID,
  logFeedId,
  handleSimulationError,
} from "@/utils";

const argv = yargs(process.argv)
  .options({
    feedId: {
      type: "string",
      required: false,
      default: DEFAULT_FEED_ID,
      description: "The hexadecimal ID of the price feed (get from Switchboard Explorer)",
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
  // Note: loadEnv automatically sets the crossbar network based on the detected RPC connection
  const { program, keypair, connection, crossbar, queue, isMainnet } =
    await sb.AnchorUtils.loadEnv();

  logFeedId(argv.feedId);
  console.log("🌐 Queue selected:", queue.pubkey.toBase58());
  console.log("🔧 Crossbar network:", crossbar.getNetwork());

  // Step 1: Derive the canonical oracle account from feed hashes
  // This uses the same derivation logic as the quote program
  const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [argv.feedId]);
  console.log("📍 Quote Account (derived):", quoteAccount.toBase58());

  // Simulate the feed - automatically uses the network configured in loadEnv
  const simFeed = await crossbar.simulateFeed(argv.feedId);
  console.log(simFeed);

  // Step 2: Create managed update instructions
  // This returns both the Ed25519 signature verification instruction
  // and the quote program instruction that stores the verified data
  const instructions = await queue.fetchManagedUpdateIxs(
    crossbar,
    [argv.feedId],
    {
      variableOverrides: {},
      instructionIdx: 0, // Ed25519 instruction index
      payer: keypair.publicKey,
    }
  );

  console.log("✨ Generated instructions:", instructions.length);
  console.log("  - Ed25519 signature verification");
  console.log("  - Quote program verified_update");

  // Step 3: Create your program instruction to read the oracle data
  // This instruction will read from the quote account that was just updated
  // Load the basic oracle example program
  const ixs = [...instructions];

  if (fs.existsSync(BASIC_PROGRAM_PATH)) {
    const basicProgram = await loadBasicProgram(program!.provider);
    const readOracleIx = await basicReadOracleIx(
      basicProgram,
      quoteAccount,
      queue.pubkey,
      keypair.publicKey
    );
    ixs.push(readOracleIx);
    console.log("  - Basic oracle program crank instruction");
  } else {
    console.log("ℹ️  Skipping crank: basic_oracle_example program not deployed");
    console.log("   To deploy, run: anchor build && anchor deploy");
  }

  // Step 4: Build and send the transaction
  const tx = await sb.asV0Tx({
    connection,
    ixs,
    signers: [keypair],
    computeUnitPrice: 20_000, // Priority fee
    computeUnitLimitMultiple: 1.1, // 10% buffer
  });

  // Send the transaction
  try {
    const sim = await connection.simulateTransaction(tx);
    console.log(sim.value.logs?.join("\n"));
    if (sim.value.err) {
      await handleSimulationError(sim.value.err, connection, keypair.publicKey);
      return;
    }
  } catch (error) {
    console.error("❌ Transaction failed:", error);
  }
})();
