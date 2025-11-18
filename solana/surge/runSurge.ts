import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import {
  TX_CONFIG,
  myAnchorProgram,
  oracleUpdateIx,
  ADVANCED_PROGRAM_PATH,
  calculateStatistics,
} from "@/utils";

(async function main() {
  console.log("🚀 Starting Surge streaming demo...");
  console.log("\n⏰ IMPORTANT: If you experience clock-related issues, sync your system clock:");
  console.log("   macOS:  sudo sntp -sS time.apple.com");
  console.log("   Linux:  sudo ntpdate -s time.nist.gov");
  console.log("   (or):   sudo timedatectl set-ntp true\n");

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

  await surge.connectAndSubscribe([{ symbol: "BTC/USD" }]);

  // Run simulation after 10 seconds
  setTimeout(async () => {
    hasRunSimulation = true;
    console.log(
      "\n⏰ 10 seconds elapsed - running simulation with latest data..."
    );
  }, 10_000);

  // Listen for price updates
  surge.on("signedPriceUpdate", async (response: sb.SurgeUpdate) => {
    const currentLatency = Date.now() - response.data.source_ts_ms;
    latencies.push(currentLatency);

    const stats = calculateStatistics(latencies);
    const formattedPrices = response.getFormattedPrices();
    const currentPrice = Object.values(formattedPrices)[0] || "N/A";
    console.log(
      `📊 Update #${
        stats.count
      } | Price: ${currentPrice} | Latency: ${currentLatency}ms | Avg: ${stats.mean.toFixed(
        1
      )}ms`
    );

    // Only run simulation once after 10 seconds
    if (!hasRunSimulation) return;

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
        return;
      }

      console.log("✅ Simulation succeeded!");

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
      process.exit(0);
    } catch (error) {
      console.error("💥 Transaction error:", error);
      process.exit(1);
    }
  });

  console.log(
    "📡 Listening for price updates (will simulate after 10 seconds)..."
  );
})();
