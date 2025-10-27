/**
 * Simple example of using Switchboard Surge WebSocket streaming on Sui
 *
 * Surge provides real-time price updates via WebSocket with sub-100ms latency.
 *
 * Usage:
 *   export SURGE_API_KEY="sb_live_your_api_key_here"
 *   tsx examples/surge.ts
 *   tsx examples/surge.ts --feeds BTC/USD,ETH/USD,SOL/USD
 *   tsx examples/surge.ts --sign  # Sign and send (requires SUI_PRIVATE_KEY)
 */

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { convertSurgeUpdateToQuotes, SwitchboardClient } from "@switchboard-xyz/sui-sdk";
import { Surge } from "@switchboard-xyz/on-demand";

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSign = args.includes("--sign");
const feedsArg = args.find(arg => arg.startsWith("--feeds="));
const feedSymbols = feedsArg
  ? feedsArg.split("=")[1].split(",").map(s => s.trim())
  : ["BTC/USD", "ETH/USD"];

async function main() {
  console.log("🚀 Switchboard Surge Example for Sui");
  console.log(`📊 Feeds: ${feedSymbols.join(", ")}`);
  console.log(`Mode: ${shouldSign ? "🔐 Sign and Send" : "🎯 Simulate Only"}\n`);

  // Setup clients
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl("mainnet");
  const suiClient = new SuiClient({ url: rpcUrl });
  const sb = new SwitchboardClient(suiClient);

  // Get Surge API key
  const surgeApiKey = process.env.SURGE_API_KEY;
  if (!surgeApiKey) {
    throw new Error("SURGE_API_KEY environment variable is required");
  }

  // Initialize Surge
  const surge = new Surge({
    apiKey: surgeApiKey,
    network: "mainnet",
    verbose: true,
  });

  console.log("📡 Connecting to Surge...");
  await surge.connect();
  console.log("✅ Connected to Surge!\n");

  // Subscribe to feeds
  const subscriptions = feedSymbols.map(symbol => ({
    symbol,
    source: "WEIGHTED" as const,
  }));

  console.log(`📊 Subscribing to feeds: ${feedSymbols.join(", ")}`);
  await surge.subscribe(subscriptions);
  console.log("✅ Subscribed successfully!\n");

  // Wait for first price update
  console.log("⏳ Waiting for first price update from Surge...");

  const priceUpdate = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for price update"));
    }, 30000);

    surge.on("signedPriceUpdate", (update: any) => {
      clearTimeout(timeout);
      resolve(update);
    });

    surge.on("error", (error: any) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  console.log("✅ Received price update from Surge!\n");

  // Convert Surge update to Sui quotes format
  console.log("🔄 Converting Surge update to Sui quotes...");

  // Queue ID for mainnet (use your actual queue in production)
  const QUEUE_ID = "0x6e43354b8ea2dfad98eadb33db94dcc9b1175e70ee82e42abc605f6b7de9e910";
  const quoteData = await convertSurgeUpdateToQuotes(priceUpdate, QUEUE_ID);

  console.log("✅ Converted to quote format!");
  console.log(`Feed hashes: ${quoteData.feedHashes.join(", ")}`);
  console.log(`Values: ${quoteData.values.join(", ")}`);
  console.log(`Timestamp: ${new Date(quoteData.timestampSeconds * 1000).toISOString()}\n`);

  // Display formatted prices
  console.log("💰 Price Data from Surge:");
  const formattedPrices = priceUpdate.getFormattedPrices();
  Object.entries(formattedPrices).forEach(([hash, price]) => {
    console.log(`  ${hash.substring(0, 10)}...: ${price}`);
  });

  // Create transaction
  const tx = new Transaction();

  // In a real application, you would call your Move contract here:
  // tx.moveCall({
  //   target: 'YOUR_PACKAGE::your_module::use_surge_quotes',
  //   arguments: [
  //     tx.pure(quoteData.feedHashes),
  //     tx.pure(quoteData.values),
  //     // ... other quote data
  //   ],
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
  } else {
    // Simulate transaction
    console.log("\n🎯 Simulating transaction...");

    const result = await suiClient.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: suiClient }),
    });

    if (result.effects.status.status === "success") {
      console.log("✅ Simulation successful!");
    } else {
      console.error("❌ Simulation failed:", result.effects.status);
    }
  }

  // Disconnect from Surge
  console.log("\n🔌 Disconnecting from Surge...");
  surge.disconnect();

  console.log("✅ Example completed successfully!\n");
  console.log("💡 Tip: Use --sign flag to sign and send the transaction");
  console.log("   Example: tsx examples/surge.ts --feeds=BTC/USD,SOL/USD --sign\n");
}

main().catch(console.error);
