import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote, ON_DEMAND_MAINNET_QUEUE, SPL_SYSVAR_SLOT_HASHES_ID, SPL_SYSVAR_INSTRUCTIONS_ID, isMainnetConnection } from "@switchboard-xyz/on-demand";
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
 * Simple Oracle Read Example
 *
 * This is the most basic example showing how to:
 * 1. Auto-detect network (mainnet/devnet) and choose appropriate queue
 * 2. Derive the canonical oracle account for a feed
 * 3. Use fetchManagedUpdateIxs to update oracle data
 * 4. Read the oracle data in your program
 *
 * Perfect for getting started with Switchboard managed updates!
 */
(async function main() {
  // Load environment
  const { program, keypair, connection, crossbar } = await sb.AnchorUtils.loadEnv();
  console.log("🚀 Starting simple oracle read example");
  console.log("RPC:", connection.rpcEndpoint);
  console.log("Feed ID:", argv.feedId);

  // Auto-detect network and load appropriate queue
  const queue = await sb.Queue.loadDefault(program!);

  // Get the canonical oracle account for this feed
  const oracleAccount = OracleQuote.getCanonicalPubkey([argv.feedId]);
  console.log("Oracle Account:", oracleAccount.toBase58());

  // Get managed update instructions
  const instructions = await queue.fetchManagedUpdateIxs(
    crossbar,
    [argv.feedId],
    {
      payer: keypair.publicKey,
    }
  );

  console.log(`✅ Got ${instructions.length} update instructions`);

  // Load the basic oracle example program
  const basicProgram = await loadBasicProgram(program!.provider);

  // Create instruction to read the oracle data
  const readOracleIx = await basicReadOracleIx(basicProgram, oracleAccount, queue.pubkey);

  // Send transaction
  const tx = await sb.asV0Tx({
    connection,
    ixs: [...instructions, readOracleIx],
    signers: [keypair],
  });

  try {
    const sig = await connection.sendTransaction(tx, TX_CONFIG);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("🎉 Success! Transaction:", sig);
    console.log("Oracle data is now updated and verified!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();

