#!/usr/bin/env npx tsx

import { Connection, PublicKey } from "@solana/web3.js";
import { TX_CONFIG } from "./scripts/utils";

async function getTransactionLogs(signature: string) {
  // Use the RPC endpoint from environment or default to devnet
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
    TX_CONFIG.commitment
  );

  try {
    console.log(`🔍 Fetching transaction logs for: ${signature}`);
    console.log(`   View on explorer: https://solscan.io/tx/${signature}`);
    console.log("=".repeat(80));

    // Get transaction with logs
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      console.log("❌ Transaction not found or not confirmed yet");
      return;
    }

    console.log("✅ Transaction found!");
    console.log(`   Slot: ${tx.slot}`);
    console.log(`   Block Time: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'Unknown'}`);
    console.log(`   Success: ${tx.meta?.err ? '❌ Failed' : '✅ Success'}`);

    if (tx.meta?.err) {
      console.log(`   Error Details: ${JSON.stringify(tx.meta.err, null, 2)}`);
    }

    console.log("");

    // Display transaction logs with better formatting
    if (tx.meta?.logMessages && tx.meta.logMessages.length > 0) {
      console.log("📋 Transaction Logs:");
      console.log("-".repeat(80));
      tx.meta.logMessages.forEach((log, index) => {
        // Color-code different log types
        const prefix = log.includes("failed") || log.includes("error") || log.includes("Error") ? "❌" :
                      log.includes("success") || log.includes("Success") || log.includes("invoke") ? "✅" :
                      log.includes("Program log:") ? "📝" : "ℹ️";
        console.log(`${String(index + 1).padStart(3, ' ')}: ${prefix} ${log}`);
      });
    } else {
      console.log("❌ No logs found in transaction");
    }

    console.log("");
    console.log("📊 Resource Usage:");
    console.log("-".repeat(50));

    // Show compute units used
    if (tx.meta?.computeUnitsConsumed !== undefined) {
      console.log(`   Compute Units: ${tx.meta.computeUnitsConsumed.toLocaleString()}`);
    }

    // Show fee
    if (tx.meta?.fee !== undefined) {
      console.log(`   Fee: ${tx.meta.fee} lamports (${(tx.meta.fee / 1e9).toFixed(9)} SOL)`);
    }

    // Show account changes
    if (tx.meta?.preBalances && tx.meta?.postBalances && tx.transaction.message.staticAccountKeys) {
      console.log("");
      console.log("💰 Balance Changes:");
      console.log("-".repeat(50));
      let hasChanges = false;
      tx.transaction.message.staticAccountKeys.forEach((account, index) => {
        const preBalance = tx.meta!.preBalances[index];
        const postBalance = tx.meta!.postBalances[index];
        const diff = postBalance - preBalance;
        if (diff !== 0) {
          hasChanges = true;
          const formattedDiff = diff > 0 ? `+${diff}` : `${diff}`;
          console.log(`   ${account.toBase58()}: ${formattedDiff} lamports`);
        }
      });
      if (!hasChanges) {
        console.log("   No balance changes detected");
      }
    }

  } catch (error) {
    console.error("❌ Error fetching transaction:", error);
    if (error instanceof Error) {
      console.error("   Details:", error.message);
    }
  }
}

async function findRecentFailedTransactions() {
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
    TX_CONFIG.commitment
  );

  try {
    console.log("🔍 Searching for recent failed transactions...");

    // Get recent signatures from the connection
    const recentSignatures = await connection.getSignaturesForAddress(
      connection.rpcEndpoint.includes("devnet")
        ? new PublicKey("11111111111111111111111111111111") // System program to catch many transactions
        : new PublicKey("Vote111111111111111111111111111111111111111"), // Vote program for mainnet
      { limit: 100 }
    );

    const failedTxs = recentSignatures.filter(sig => sig.err !== null);

    if (failedTxs.length === 0) {
      console.log("✅ No failed transactions found in recent history");
      return;
    }

    console.log(`\n❌ Found ${failedTxs.length} failed transactions in recent history:`);
    console.log("-".repeat(80));

    failedTxs.slice(0, 10).forEach((sig, index) => {
      console.log(`${index + 1}. ${sig.signature}`);
      console.log(`   Slot: ${sig.slot}, Error: ${JSON.stringify(sig.err)}`);
      console.log(`   Explorer: https://solscan.io/tx/${sig.signature}`);
      console.log("");
    });

    if (failedTxs.length > 0) {
      console.log(`\n📋 Getting detailed logs for most recent failure:`);
      console.log("=".repeat(80));
      await getTransactionLogs(failedTxs[0].signature);
    }

  } catch (error) {
    console.error("❌ Error searching for failed transactions:", error);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🚀 Solana Transaction Log Debugger

Usage:
  npx tsx get_transaction_logs.ts <signature>     # Get logs for specific transaction
  npx tsx get_transaction_logs.ts --recent        # Find recent failed transactions

Examples:
  npx tsx get_transaction_logs.ts 4FUFtaaXeTvb9pY5RCSzVNBKw4ZrGAHfFJVp2xLnzAgoDru8BNsJSobcDt961Pp9SSYxLjJnfLkEuZdwf6zq7eqZ
  npx tsx get_transaction_logs.ts --recent

Environment Variables:
  ANCHOR_PROVIDER_URL     # RPC endpoint (defaults to devnet)
`);
    process.exit(1);
  }

  if (args[0] === "--recent") {
    await findRecentFailedTransactions();
  } else {
    const signature = args[0];
    await getTransactionLogs(signature);
  }
}

main().catch(console.error);