import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, convertSurgeUpdateToQuotes } from "@switchboard-xyz/sui-sdk";
import { Surge } from "@switchboard-xyz/on-demand";
import yargs from "yargs";

const argv = yargs(process.argv)
  .options({
    feeds: {
      type: "string",
      description: "Comma-separated list of feed symbols (e.g., BTC/USD,ETH/USD)",
    },
    signAndSend: {
      type: "boolean",
      default: false,
      description: "Sign and send the transaction (requires SUI_PRIVATE_KEY)",
    },
  })
  .parseSync();

async function surgeExample() {
  // Configuration
  const RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
  const API_KEY = process.env.SURGE_API_KEY;
  const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
  const SIGN_AND_SEND = argv.signAndSend;

  // Parse feed symbols
  let FEED_SYMBOLS: string[] = [];
  if (argv.feeds) {
    FEED_SYMBOLS = argv.feeds.split(",").map(s => s.trim());
  }

  if (!API_KEY) {
    throw new Error("SURGE_API_KEY environment variable is required");
  }

  if (SIGN_AND_SEND && !PRIVATE_KEY) {
    throw new Error("SUI_PRIVATE_KEY environment variable is required when using --signAndSend");
  }

  if (FEED_SYMBOLS.length === 0) {
    // Default to BTC/USD and ETH/USD
    FEED_SYMBOLS = ["BTC/USD", "ETH/USD"];
  }

  console.log(`🚀 Switchboard Surge Example for Sui`);
  console.log(`Feeds: ${FEED_SYMBOLS.join(", ")}`);
  console.log(`Mode: ${SIGN_AND_SEND ? "🔐 Sign and Send" : "🎯 Simulate Only"}`);

  // Initialize clients
  const suiClient = new SuiClient({ url: RPC_URL });
  const sb = new SwitchboardClient(suiClient);

  // Initialize Surge
  const surge = new Surge({
    apiKey: API_KEY,
    network: "mainnet",
    verbose: true,
  });

  let keypair: Ed25519Keypair | null = null;
  let senderAddress: string | null = null;

  if (SIGN_AND_SEND && PRIVATE_KEY) {
    keypair = Ed25519Keypair.fromSecretKey(PRIVATE_KEY);
    senderAddress = keypair.getPublicKey().toSuiAddress();
    console.log(`Signing address: ${senderAddress}`);
  }

  try {
    console.log("\n📡 Connecting to Surge...");
    await surge.connect();

    console.log("✅ Connected to Surge!");

    // Subscribe to the feeds
    const subscriptions = FEED_SYMBOLS.map(symbol => ({
      symbol,
      source: "WEIGHTED" as const,
    }));

    console.log(`\n📊 Subscribing to feeds: ${FEED_SYMBOLS.join(", ")}`);
    await surge.subscribe(subscriptions);

    // Wait for the first update
    console.log("\n⏳ Waiting for first price update from Surge...");

    const priceUpdate = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for price update"));
      }, 30000); // 30 second timeout

      surge.on("signedPriceUpdate", (update: any) => {
        clearTimeout(timeout);
        resolve(update);
      });

      surge.on("error", (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log("✅ Received price update from Surge!");

    // Convert Surge update to Sui quotes format
    console.log("\n🔄 Converting Surge update to Sui quotes...");

    // Get a dummy queue ID for this example (in production, use your actual queue)
    const QUEUE_ID = "0x6e43354b8ea2dfad98eadb33db94dcc9b1175e70ee82e42abc605f6b7de9e910";

    const quoteData = await convertSurgeUpdateToQuotes(priceUpdate, QUEUE_ID);

    console.log("✅ Converted to quote format!");
    console.log(`Feed hashes: ${quoteData.feedHashes.join(", ")}`);
    console.log(`Values: ${quoteData.values.join(", ")}`);
    console.log(`Timestamp (seconds): ${quoteData.timestampSeconds}`);

    // Create a transaction with the quote data
    const tx = new Transaction();
    if (SIGN_AND_SEND && senderAddress) {
      tx.setSender(senderAddress);
    } else {
      tx.setSender("0x0000000000000000000000000000000000000000000000000000000000000000");
    }

    // This is a simple example showing how to use the quote data
    // In a real scenario, you would call your Move contract with these quotes
    console.log("\n📝 Built transaction with quote data");
    console.log(`- Feed hashes: ${quoteData.feedHashes.length}`);
    console.log(`- Values (18-decimal): ${quoteData.values.length}`);
    console.log(`- Timestamp: ${new Date(quoteData.timestampSeconds * 1000).toISOString()}`);

    // Display price information
    console.log("\n💰 Price Data from Surge:");
    const formattedPrices = priceUpdate.getFormattedPrices();
    Object.entries(formattedPrices).forEach(([hash, price]) => {
      console.log(`  ${hash.substring(0, 10)}...: ${price}`);
    });

    // Simulate the transaction
    console.log("\n🎯 Simulating transaction...");
    try {
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
      });

      if (dryRunResult.effects.status.status === "success") {
        console.log("✅ Transaction simulation successful!");
        console.log("Gas costs:", {
          computation: dryRunResult.effects.gasUsed.computationCost,
          storage: dryRunResult.effects.gasUsed.storageCost,
          storageRebate: dryRunResult.effects.gasUsed.storageRebate,
        });
      } else {
        console.log("❌ Transaction simulation failed:", dryRunResult.effects.status);
      }
    } catch (simError) {
      console.log("⚠️ Could not simulate transaction (expected if no contract):", simError);
    }

    // Disconnect from Surge
    console.log("\n🔌 Disconnecting from Surge...");
    surge.disconnect();

    console.log("✅ Example completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    surge.disconnect();
    process.exit(1);
  }
}

// Run the example
surgeExample().catch(console.error);
