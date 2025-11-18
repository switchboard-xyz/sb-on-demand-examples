import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import * as fs from "fs";
import {
  TX_CONFIG,
  loadBasicProgram,
  basicReadOracleIx,
  BASIC_PROGRAM_PATH,
  DEFAULT_FEED_ID,
  calculateStatistics,
} from "@/utils";

(async function main() {
  console.log("🚀 Starting Surge streaming demo...");

  const apiKey = process.env.SURGE_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: SURGE_API_KEY environment variable is not set");
    console.error("Please set SURGE_API_KEY before running this script");
    process.exit(1);
  }

  const { keypair, connection, program, crossbar, gateway, queue } =
    await sb.AnchorUtils.loadEnv();
  const lut = await queue.loadLookupTable();
  const stalenessValues: number[] = [];
  let hasRunSimulation = false;
  let clockOffset: number | null = null;
  let firstUpdateTime: number | null = null;

  const surge = new sb.Surge({
    apiKey,
    gatewayUrl: gateway.gatewayUrl,
    verbose: false,
  });

  await surge.connectAndSubscribe([{ symbol: "ZEC/USD" }], 10);

  // Run simulation after 10 seconds
  setTimeout(async () => {
    hasRunSimulation = true;
    console.log(
      "\n⏰ 10 seconds elapsed - running simulation with latest data..."
    );
  }, 10_000);

  // Listen for price updates
  surge.on("signedPriceUpdate", async (response: sb.SurgeUpdate) => {
    const seenAt = Date.now();
    const rawStaleness = seenAt - response.data.source_ts_ms;

    // Track first update time for accurate samples/min calculation
    if (firstUpdateTime === null) {
      firstUpdateTime = seenAt;
    }

    // Calculate clock offset from first update (assume network latency ~50ms)
    if (clockOffset === null) {
      clockOffset = rawStaleness < 0 ? rawStaleness - 50 : 0;
      if (clockOffset !== 0) {
        console.log(`🕐 Detected clock skew: ${Math.abs(clockOffset).toFixed(0)}ms (adjusting all staleness values)`);
      }
    }

    // Adjust staleness for clock offset
    const currentStaleness = rawStaleness - clockOffset;
    stalenessValues.push(currentStaleness);

    const stats = calculateStatistics(stalenessValues);
    const formattedPrices = response.getFormattedPrices();
    const currentPrice = Object.values(formattedPrices)[0] || "N/A";
    console.log(
      `Update #${stats.count} | Seen at: ${new Date(seenAt).toISOString()} | Staleness: ${currentStaleness.toFixed(0)}ms | Price: ${currentPrice}`
    );

    // Only run simulation once after 10 seconds
    if (!hasRunSimulation) return;

    // Check if basic program is deployed
    if (!fs.existsSync(BASIC_PROGRAM_PATH)) {
      const elapsedSeconds = firstUpdateTime ? (Date.now() - firstUpdateTime) / 1000 : 0;
      const samplesPerMin = elapsedSeconds > 0 ? (stats.count / elapsedSeconds) * 60 : 0;

      console.log("\n✅ Streaming demo completed!");
      console.log("ℹ️  Skipping program simulation: basic_oracle_example not deployed");
      console.log("   To deploy and test the full simulation, run: anchor build && anchor deploy\n");
      console.log(`📈 Final streaming stats: ${stats.count} updates received`);
      console.log(`   Average staleness: ${stats.mean.toFixed(1)}ms`);
      console.log(`   Min staleness: ${stats.min}ms`);
      console.log(`   Max staleness: ${stats.max}ms`);
      console.log(`   Est. samples/min: ${samplesPerMin.toFixed(1)}`);
      console.log(`   Latest price: ${currentPrice}`);
      console.log("\n🎉 Surge streaming works perfectly! Oracle data is being delivered in real-time.");
      surge.disconnect();
      process.exit(0);
    }

    // Derive the canonical oracle account for managed updates
    const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [DEFAULT_FEED_ID]);

    // Use managed update instructions instead of direct quote instruction
    const managedUpdateIxs = await queue.fetchManagedUpdateIxs(
      crossbar,
      [DEFAULT_FEED_ID],
      {
        variableOverrides: {},
        instructionIdx: 0,
        payer: keypair.publicKey,
      }
    );

    const basicProgram = await loadBasicProgram(program!.provider);
    const readOracleIx = await basicReadOracleIx(
      basicProgram,
      quoteAccount,
      queue.pubkey,
      keypair.publicKey
    );

    const tx = await sb.asV0Tx({
      connection,
      ixs: [...managedUpdateIxs, readOracleIx],
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

      const elapsedSeconds = firstUpdateTime ? (Date.now() - firstUpdateTime) / 1000 : 0;
      const samplesPerMin = elapsedSeconds > 0 ? (stats.count / elapsedSeconds) * 60 : 0;

      console.log(
        `\n📈 Final stats: ${stats.count} updates, ${stats.mean.toFixed(
          1
        )}ms avg staleness, ${samplesPerMin.toFixed(1)} samples/min`
      );
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
