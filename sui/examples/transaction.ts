/**
 * Shared transaction utilities for Sui examples
 */

import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

export interface GasUsed {
  computation: string;
  storage: string;
  storageRebate: string;
}

/**
 * Create a transaction with appropriate sender
 */
export function createTransaction(
  signAndSend: boolean,
  senderAddress?: string
): Transaction {
  const tx = new Transaction();

  if (signAndSend && senderAddress) {
    tx.setSender(senderAddress);
  } else {
    tx.setSender("0x0000000000000000000000000000000000000000000000000000000000000000");
  }

  return tx;
}

/**
 * Format gas costs for display
 */
export function formatGasCosts(gasUsed: GasUsed): string {
  return JSON.stringify({
    computation: gasUsed.computation,
    storage: gasUsed.storage,
    storageRebate: gasUsed.storageRebate,
  }, null, 2);
}

/**
 * Log gas costs in a consistent format
 */
export function logGasCosts(gasUsed: GasUsed, label: string = "Gas costs"): void {
  console.log(`${label}:`, {
    computation: gasUsed.computation,
    storage: gasUsed.storage,
    storageRebate: gasUsed.storageRebate,
  });
}

/**
 * Simulate a transaction
 */
export async function simulateTransaction(
  suiClient: SuiClient,
  tx: Transaction,
  options: {
    showLogs?: boolean;
  } = {}
): Promise<boolean> {
  console.log("\n🎯 Simulating transaction...");

  try {
    const dryRunResult = await suiClient.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: suiClient }),
    });

    console.log(`Simulation result: ${dryRunResult.effects.status.status}`);

    if (dryRunResult.effects.status.status === "success") {
      console.log("✅ Transaction simulation successful!");
      logGasCosts(dryRunResult.effects.gasUsed);
      return true;
    } else {
      console.log("❌ Transaction simulation failed:", dryRunResult.effects.status);
      return false;
    }
  } catch (simError) {
    console.log("❌ Could not simulate transaction:", simError);
    return false;
  }
}

/**
 * Sign and execute a transaction
 */
export async function signAndExecuteTransaction(
  suiClient: SuiClient,
  tx: Transaction,
  keypair: Ed25519Keypair,
  options: {
    showDetails?: boolean;
  } = {}
): Promise<boolean> {
  console.log("\n🔐 Signing and sending transaction...");

  try {
    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
    });

    console.log(`Transaction result: ${result.effects?.status?.status}`);

    if (result.effects?.status?.status === "success") {
      console.log("✅ Transaction executed successfully!");
      console.log(`Transaction digest: ${result.digest}`);
      logGasCosts(result.effects.gasUsed, "Gas used");

      // Show events if requested and available
      if (options.showDetails && result.events && result.events.length > 0) {
        console.log(`\nEvents emitted (${result.events.length}):`);
        result.events.forEach((event, index) => {
          console.log(`  Event ${index + 1}:`, {
            type: event.type,
            sender: event.sender,
            packageId: event.packageId,
          });
        });
      }

      // Show object changes if requested
      if (options.showDetails && result.effects.mutated && result.effects.mutated.length > 0) {
        console.log(`\nObjects updated (${result.effects.mutated.length}):`);
        result.effects.mutated.forEach((obj, index) => {
          console.log(`  Object ${index + 1}: ${obj.reference.objectId}`);
        });
      }

      return true;
    } else {
      console.log("❌ Transaction execution failed:", result.effects?.status);
      return false;
    }
  } catch (txError) {
    console.log("❌ Transaction execution error:", txError);
    return false;
  }
}

/**
 * Execute or simulate transaction based on flags
 */
export async function executeOrSimulate(
  suiClient: SuiClient,
  tx: Transaction,
  signAndSend: boolean,
  keypair: Ed25519Keypair | null,
  options: {
    showDetails?: boolean;
  } = {}
): Promise<boolean> {
  if (signAndSend && keypair) {
    return await signAndExecuteTransaction(suiClient, tx, keypair, options);
  } else {
    return await simulateTransaction(suiClient, tx);
  }
}
