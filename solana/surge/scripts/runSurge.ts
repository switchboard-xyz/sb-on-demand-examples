import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import * as fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  TX_CONFIG,
  loadBasicProgram,
  basicReadOracleIx,
  BASIC_PROGRAM_PATH,
  DEFAULT_FEED_ID,
} from "@/utils";

(async function main() {
  console.log("🚀 Starting Surge streaming demo...");

  // Parse command line arguments
  const argv = await yargs(hideBin(process.argv))
    .option('ticker', {
      alias: 't',
      type: 'string',
      description: 'Trading pair symbol (USD quote assumed)',
      default: 'BTC'
    })
    .option('withProgram', {
      alias: 'p',
      type: 'boolean',
      description: 'Include program read instruction in simulation',
      default: false
    })
    .help()
    .argv;

  // Always assume USD quote if not specified
  const ticker = argv.ticker.includes('/') ? argv.ticker : `${argv.ticker}/USD`;
  console.log(`📊 Using ticker: ${ticker}`);

  const { keypair, connection, program, crossbar, gateway, queue } =
    await sb.AnchorUtils.loadEnv();
  console.log(`🔑 Loaded keypair: ${keypair.publicKey.toBase58()}`);
  console.log(`🌐 Connected to cluster: ${connection.rpcEndpoint}`);
  const lut = await queue.loadLookupTable();
  let hasRunSimulation = false;
  let updateCount = 0;

  // Initialize Surge client
  // Authentication options:
  //   - API key: { apiKey: process.env.SURGE_API_KEY }
  //   - Keypair/connection: { connection, keypair }
  const surgeConfig = {
    // apiKey: process.env.SURGE_API_KEY,
    connection,
    keypair,
    verbose: false,
  };

  // Only validate API key if the config uses apiKey authentication
  if ('apiKey' in surgeConfig && !surgeConfig.apiKey) {
    console.error("❌ Error: SURGE_API_KEY environment variable is not set");
    console.error("Please set SURGE_API_KEY before running this script");
    process.exit(1);
  }

  const surge = new sb.Surge(surgeConfig);
  
  await surge.connectAndSubscribe([{ symbol: ticker }]);

  // Run simulation after 10 seconds
  setTimeout(async () => {
    hasRunSimulation = true;
    console.log(
      "\n⏰ 10 seconds elapsed - running simulation with latest data..."
    );
  }, 10_000);

//   
  // Listen for price updates
  surge.on("signedPriceUpdate", async (response: sb.SurgeUpdate) => {
    updateCount++;
    
    const formattedPrices = response.getFormattedPrices();
    const metrics = response.getLatencyMetrics();
    
    const updateType = metrics.isHeartbeat ? "⏰ HEARTBEAT" : "📈 PRICE CHANGE";
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`${updateType} | Update #${updateCount}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`Bundle Metrics:`);
    console.log(`  • Emit Latency:              ${metrics.emitLatencyMs}ms (price source change → oracle broadcast)`);
    console.log(`  • Change Detection to Bcast: ${metrics.swInternalLatencyMs}ms (price change detection → broadcast)`);
    console.log(`  • Oracle → Client:           ${metrics.oracleBroadcastToClientMs}ms (network latency to your client)`);
    console.log(`${'─'.repeat(70)}`);
    
    metrics.perFeedMetrics.forEach((feed) => {
      const price = formattedPrices[feed.feed_hash];
      console.log(`\n  ${feed.symbol} - ${price}`);
      console.log(`    • Source → Oracle:  ${feed.sourceToOracleMs}ms (exchange to oracle reception)`);
      console.log(`    • Emit Latency:     ${feed.emitLatencyMs}ms (price source change → oracle broadcast)`);
    });
    
    console.log(`\n${'═'.repeat(70)}`);

    // Only run simulation once after 10 seconds
    if (!hasRunSimulation) return;

    // Check if basic program is deployed
    if (!fs.existsSync(BASIC_PROGRAM_PATH)) {
      console.log("\n✅ Streaming demo completed!");
      console.log("ℹ️  Skipping program simulation: basic_oracle_example not deployed");
      console.log("   To deploy and test the full simulation, run: anchor build && anchor deploy\n");
      console.log(`📈 Final streaming stats: ${updateCount} updates received`);
      console.log("\n🎉 Surge streaming works perfectly! Oracle data is being delivered in real-time.");
      surge.disconnect();
      process.exit(0);
    }

    // Derive the canonical oracle account for managed updates
    const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [DEFAULT_FEED_ID]);

    // Build transaction: oracle quote update + optional program read
    const crankIxs = response.toQuoteIx(queue.pubkey, keypair.publicKey);
    const ixs = [...crankIxs];

    if (argv.withProgram) {
      const basicProgram = await loadBasicProgram(program!.provider);
      ixs.push(await basicReadOracleIx(basicProgram, quoteAccount, queue.pubkey, keypair.publicKey));
    }

    const tx = await sb.asV0Tx({
      connection,
      ixs,
      signers: [keypair],
      computeUnitPrice: 20_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: [lut],
    });

    try {
      const sim = await connection.simulateTransaction(tx, {
        ...TX_CONFIG,
        commitment: "confirmed",
      });

      if (sim.value.err) {
        console.error("❌ Simulation failed:", sim.value.err);
        surge.disconnect();
        process.exit(1);
      }

      console.log("\n✅ Simulation succeeded!");

      // Display program logs that show feed values
      if (sim.value.logs) {
        console.log("\n📋 Program logs:");
        sim.value.logs.forEach((log: string) => {
          if (
            log.includes("Feed hash:") ||
            log.includes("Feed value:") ||
            log.includes("Oracle Quote verified slot:")
          ) {
            console.log(`   ${log}`);
          }
        });
      }

      console.log(`\n📈 Final stats: ${updateCount} updates received`);
      console.log("🎉 Demo completed successfully!");
      surge.disconnect();
      process.exit(0);
    } catch (error) {
      console.error("💥 Transaction error:", error);
      surge.disconnect();
      process.exit(1);
    }
  });

  console.log(
    "📡 Listening for price updates (will simulate after 10 seconds)..."
  );
})();
