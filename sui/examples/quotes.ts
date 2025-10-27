/**
 * Simple example of fetching and using Oracle Quotes on Sui
 *
 * Oracle Quotes provide zero-setup, on-demand oracle data without managing feed state.
 *
 * Usage:
 *   tsx examples/quotes.ts
 *   tsx examples/quotes.ts --sign  # Sign and send transaction (requires SUI_PRIVATE_KEY)
 */

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, fetchQuoteUpdate } from "@switchboard-xyz/sui-sdk";

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSign = args.includes("--sign");

async function main() {
  console.log("🔮 Switchboard Oracle Quotes Example for Sui\n");

  // Setup clients
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl("mainnet");
  const suiClient = new SuiClient({ url: rpcUrl });
  const sb = new SwitchboardClient(suiClient);

  // Example feed hash (BTC/USD)
  const feedHash = "0x7418dc6408f5e0eb4724dabd81922ee7b0814a43abc2b30ea7a08222cd1e23ee";

  console.log(`📊 Fetching oracle quote for feed: ${feedHash.substring(0, 20)}...\n`);

  // Create transaction
  const tx = new Transaction();

  // Fetch quotes for the feed
  const quotes = await fetchQuoteUpdate(
    sb,
    [feedHash],
    tx,
    {
      numOracles: 3,  // Request data from 3 oracles
    }
  );

  console.log("✅ Successfully fetched oracle quotes!");

  // In a real application, you would call your Move contract here:
  // tx.moveCall({
  //   target: 'YOUR_PACKAGE::your_module::use_quotes',
  //   arguments: [quotes],
  // });

  if (shouldSign) {
    // Sign and send transaction
    const privateKey = process.env.SUI_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("SUI_PRIVATE_KEY environment variable required for signing");
    }

    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    console.log(`\n🔐 Signing with address: ${keypair.getPublicKey().toSuiAddress()}`);

    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    await suiClient.waitForTransaction({ digest: result.digest });

    console.log(`\n✅ Transaction successful!`);
    console.log(`Transaction digest: ${result.digest}`);
    console.log(`Gas used: ${JSON.stringify(result.effects?.gasUsed, null, 2)}`);
  } else {
    // Simulate transaction
    console.log("\n🎯 Simulating transaction...");

    const result = await suiClient.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: suiClient }),
    });

    if (result.effects.status.status === "success") {
      console.log("✅ Simulation successful!");
      console.log(`Gas cost: ${JSON.stringify(result.effects.gasUsed, null, 2)}`);
    } else {
      console.error("❌ Simulation failed:", result.effects.status);
    }
  }

  console.log("\n💡 Tip: Use --sign flag to sign and send the transaction");
  console.log("   Example: tsx examples/quotes.ts --sign\n");
}

main().catch(console.error);
