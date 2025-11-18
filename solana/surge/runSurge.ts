import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import * as fs from "fs";
import {
  TX_CONFIG,
  myAnchorProgram,
  oracleUpdateIx,
  ADVANCED_PROGRAM_PATH,
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
  const latencies: number[] = [];
  let hasRunSimulation = false;

  const surge = new sb.Surge({
    apiKey,
    gatewayUrl: gateway.gatewayUrl,
    verbose: false,
  });

  await surge.connectAndSubscribe([{ symbol: "BTC/USD" }], 10);

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
    const currentLatency = seenAt - response.data.source_ts_ms;
    latencies.push(currentLatency);

    const stats = calculateStatistics(latencies);
    const formattedPrices = response.getFormattedPrices();
    const currentPrice = Object.values(formattedPrices)[0] || "N/A";
    console.log(
      `Update #${stats.count} | Seen at: ${new Date(seenAt).toISOString()} | Price: ${currentPrice}`
    );

    // Only run simulation once after 10 seconds
    if (!hasRunSimulation) return;

    // Check if advanced program is deployed
    if (!fs.existsSync(ADVANCED_PROGRAM_PATH)) {
      console.log("\n✅ Streaming demo completed!");
      console.log("ℹ️  Skipping program simulation: advanced_oracle_example not deployed");
      console.log("   To deploy and test the full simulation, run: anchor build && anchor deploy\n");
      console.log(`📈 Final streaming stats: ${stats.count} updates received`);
      console.log(`   Average latency: ${stats.mean.toFixed(1)}ms`);
      console.log(`   Min latency: ${stats.min}ms`);
      console.log(`   Max latency: ${stats.max}ms`);
      console.log(`   Latest price: ${currentPrice}`);
      console.log("\n🎉 Surge streaming works perfectly! Oracle data is being delivered in real-time.");
      surge.disconnect();
      process.exit(0);
    }

    const result = response.toQuoteIx();
    const sigVerifyIx = Array.isArray(result) ? result[0] : result;
    const testProgram = await myAnchorProgram(
      program!.provider,
      ADVANCED_PROGRAM_PATH
    );
    const testIx = await oracleUpdateIx(
      testProgram,
      queue.pubkey,
      keypair.publicKey
    );

    const tx = await sb.asV0Tx({
      connection,
      ixs: [sigVerifyIx, testIx],
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

      console.log(
        `\n📈 Final stats: ${stats.count} updates, ${stats.mean.toFixed(
          1
        )}ms avg latency`
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
