import { Transaction } from "@mysten/sui/transactions";
import { convertSurgeUpdateToQuotes } from "@switchboard-xyz/sui-sdk";
import { Surge } from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { loadConfig, validateConfig } from "./config";
import { initializeClients, initializeKeypair } from "./clients";
import { createTransaction, executeOrSimulate, logGasCosts } from "./transaction";

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
  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config, {
    requireSurgeApiKey: true,
    requirePrivateKey: argv.signAndSend,
  });

  // Parse feed symbols
  let FEED_SYMBOLS: string[] = [];
  if (argv.feeds) {
    FEED_SYMBOLS = argv.feeds.split(",").map(s => s.trim());
  }

  if (FEED_SYMBOLS.length === 0) {
    // Default to BTC/USD and ETH/USD
    FEED_SYMBOLS = ["BTC/USD", "ETH/USD"];
  }

  console.log(`🚀 Switchboard Surge Example for Sui`);
  console.log(`Feeds: ${FEED_SYMBOLS.join(", ")}`);
  console.log(`Mode: ${argv.signAndSend ? "🔐 Sign and Send" : "🎯 Simulate Only"}`);

  // Initialize clients
  const { suiClient, sb } = initializeClients(config.rpcUrl);

  // Initialize Surge
  const surge = new Surge({
    apiKey: config.surgeApiKey!,
    network: "mainnet",
    verbose: true,
  });

  // Initialize keypair if signing
  let keypair = null;
  let senderAddress = undefined;

  if (argv.signAndSend && config.privateKey) {
    const keypairInfo = initializeKeypair(config.privateKey);
    keypair = keypairInfo.keypair;
    senderAddress = keypairInfo.address;
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
    const tx = createTransaction(argv.signAndSend, senderAddress);

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

    // Execute or simulate the transaction
    await executeOrSimulate(suiClient, tx, argv.signAndSend, keypair);

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
