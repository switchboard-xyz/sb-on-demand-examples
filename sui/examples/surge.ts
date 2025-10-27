/**
 * Simple example of using Switchboard Surge WebSocket streaming
 *
 * Surge provides real-time price updates via WebSocket with sub-100ms latency.
 * This example demonstrates connecting to Surge and streaming live price data.
 *
 * Note: For Sui oracle integration, use the quotes.ts example instead.
 * Surge is primarily designed for streaming price data and viewing real-time updates.
 *
 * Usage:
 *   export SURGE_API_KEY="sb_live_your_api_key_here"
 *   tsx examples/surge.ts
 *   tsx examples/surge.ts --feeds BTC/USD,ETH/USD,SOL/USD
 *   tsx examples/surge.ts --duration 30  # Stream for 30 seconds
 */

import { Surge } from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .options({
    feeds: {
      type: "string",
      description: "Comma-separated list of feed symbols (e.g., BTC/USD,ETH/USD)",
      default: "BTC/USD,ETH/USD",
      coerce: (arg) => arg.split(",").map((s) => s.trim()),
    },
    duration: {
      type: "number",
      description: "How long to stream prices (in seconds, 0 = forever)",
      default: 10,
    },
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function main() {
  console.log("🚀 Switchboard Surge Streaming Example");
  console.log(`📊 Feeds: ${argv.feeds.join(", ")}`);
  console.log(`⏱️  Duration: ${argv.duration === 0 ? "continuous" : `${argv.duration}s`}\n`);

  // Get Surge API key
  const surgeApiKey = process.env.SURGE_API_KEY;
  if (!surgeApiKey) {
    throw new Error("SURGE_API_KEY environment variable is required");
  }

  // Initialize Surge
  const surge = new Surge({
    apiKey: surgeApiKey,
    network: "mainnet",
    verbose: false,
  });

  console.log("📡 Connecting to Surge...");
  await surge.connect();
  console.log("✅ Connected to Surge!\n");

  // Subscribe to feeds
  const subscriptions = argv.feeds.map((symbol) => ({
    symbol,
    source: "WEIGHTED" as const,
  }));

  console.log(`📊 Subscribing to feeds: ${argv.feeds.join(", ")}`);
  await surge.subscribe(subscriptions);
  console.log("✅ Subscribed successfully!\n");

  console.log("⏳ Streaming real-time price updates...\n");
  console.log("─".repeat(80));

  let updateCount = 0;

  // Set up update handler
  surge.on("signedPriceUpdate", (update: any) => {
    updateCount++;
    const timestamp = new Date().toISOString();

    console.log(`\n📈 Update #${updateCount} at ${timestamp}`);

    // Display formatted prices
    const formattedPrices = update.getFormattedPrices();
    Object.entries(formattedPrices).forEach(([hash, price]) => {
      console.log(`   ${hash.substring(0, 16)}...: ${price}`);
    });

    // Display latency metrics
    const latency = update.getLatencyMetrics();
    console.log(`   ⚡ End-to-end latency: ${latency.endToEnd}`);

    if (update.isTriggeredByPriceChange()) {
      console.log(`   📊 Triggered by price change`);
    }
  });

  // Set up error handler
  surge.on("error", (error: any) => {
    console.error("❌ Surge error:", error);
  });

  // Stream for specified duration
  if (argv.duration > 0) {
    await new Promise((resolve) => setTimeout(resolve, argv.duration * 1000));
  } else {
    // Stream indefinitely (until Ctrl+C)
    await new Promise(() => {});
  }

  // Disconnect from Surge
  console.log("\n\n─".repeat(80));
  console.log(`\n📊 Received ${updateCount} total updates`);
  console.log("\n🔌 Disconnecting from Surge...");
  surge.disconnect();

  console.log("✅ Example completed successfully!\n");
  console.log("💡 Tips:");
  console.log("   - Use --duration 0 to stream continuously");
  console.log("   - For Sui oracle integration, see examples/quotes.ts");
  console.log("   - Example: tsx examples/surge.ts --feeds BTC/USD,SOL/USD --duration 30\n");
}

main().catch(console.error);
