import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import * as fs from "fs";
import {
  loadBasicProgram,
  loadBasicEnv,
  basicReadOracleIx,
  BASIC_IDL_PATH,
  DEFAULT_FEED_ID,
  logFeedId,
  handleSimulationError,
  normalizeFeedId,
  sendAndConfirmTx,
} from "./utils";

const argv = yargs(process.argv)
  .options({
    feedId: {
      type: "string",
      required: false,
      default: DEFAULT_FEED_ID,
      description:
        "The 64-character hex feed ID (search the asset in Switchboard Explorer and pass the bare hex value)",
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
  const { program, keypair, connection, crossbar, queue, keypairPath, rpcUrl } =
    await loadBasicEnv();
  const feedId = normalizeFeedId(argv.feedId);

  logFeedId(feedId);
  console.log("🪪 Wallet:", keypair.publicKey.toBase58());
  console.log("🔐 Keypair path:", keypairPath);
  console.log("🔗 RPC endpoint:", rpcUrl);
  console.log("🌐 Queue selected:", queue.pubkey.toBase58());
  console.log("🔧 Crossbar network:", crossbar.getNetwork());

  // Step 1: Derive the canonical oracle account from feed hashes
  // This uses the same derivation logic as the quote program
  const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [feedId]);
  console.log("📍 Quote Account (derived):", quoteAccount.toBase58());

  // Simulate the feed - automatically uses the network configured in loadEnv
  const simFeed = await crossbar.simulateFeed(feedId);
  console.log(simFeed);

  // Step 2: Create managed update instructions
  // This returns both the Ed25519 signature verification instruction
  // and the quote program instruction that stores the verified data
  const instructions = await queue.fetchManagedUpdateIxs(
    crossbar,
    [feedId],
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
  let includedConsumerInstruction = false;

  if (fs.existsSync(BASIC_IDL_PATH)) {
    try {
      const basicProgram = await loadBasicProgram(program!.provider);
      const programAccount = await connection.getAccountInfo(basicProgram.programId);
      if (programAccount?.executable) {
        const readOracleIx = await basicReadOracleIx(basicProgram, quoteAccount);
        ixs.push(readOracleIx);
        includedConsumerInstruction = true;
        console.log("  - Basic oracle program consumer instruction");
      } else {
        console.log("ℹ️  Skipping consumer step: basic_oracle_example is not deployed on-chain");
        console.log(
          "   To deploy, run: npm run build && solana program deploy --program-id target/deploy/basic_oracle_example-keypair.json target/deploy/basic_oracle_example.so"
        );
      }
    } catch (error) {
      console.log("ℹ️  Skipping consumer step:", error instanceof Error ? error.message : error);
    }
  } else {
    console.log("ℹ️  Skipping consumer step: local basic_oracle_example IDL not built");
    console.log("   To enable it, run: npm run build");
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
    const sig = await sendAndConfirmTx(connection, tx, [keypair]);
    console.log("✅ Transaction sent:", sig);
    console.log("✅ Managed update confirmed");
    if (!includedConsumerInstruction) {
      console.log("ℹ️  The quote account was updated without the example consumer instruction");
    }
  } catch (error) {
    console.error("❌ Transaction failed:", error);
  }
})().catch((error) => {
  console.error("❌ Failed to build or send the basic managed update:", error);
  console.error(
    "💡 Feed IDs for this script should be 64 hex characters. If Explorer shows a 0x prefix, remove it before passing --feedId."
  );
  process.exit(1);
});
