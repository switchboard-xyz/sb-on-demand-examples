import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import { TX_CONFIG, myAnchorProgram, myProgramIx, DEMO_PATH, calculateStatistics } from "../utils";

(async function main() {
  console.log("🚀 Starting Surge streaming demo...");

  const crossbar = CrossbarClient.default();
  const apiKey = process.env.SURGE_API_KEY!;

  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const testProgram = await myAnchorProgram(program!.provider, DEMO_PATH);
  const queue = await sb.Queue.loadDefault(program!);
  const gateway = await queue.fetchGatewayByLatestVersion(crossbar);
  const lut = await queue.loadLookupTable();
  const latencies: number[] = [];
  let hasRunSimulation = false;

  const surge = new sb.Surge({
    apiKey,
    gatewayUrl: gateway.gatewayUrl,
    verbose: false,
  });

  await surge.connectAndSubscribe([
    { symbol: 'BTC/USD' },
  ]);

  // Run simulation after 10 seconds
  setTimeout(async () => {
    hasRunSimulation = true;
    console.log("\n⏰ 10 seconds elapsed - running simulation with latest data...");
  }, 10_000);

  // Listen for price updates
  surge.on('signedPriceUpdate', async (response: sb.SurgeUpdate) => {
    latencies.push(Date.now() - response.data.source_ts_ms);
    let sigVerifyIx = response.toIx();

    const testIx = await myProgramIx(testProgram, queue.pubkey, keypair.publicKey);

    const stats = calculateStatistics(latencies);
    const formattedPrices = response.getFormattedPrices();
    const currentPrice = Object.values(formattedPrices)[0] || 'N/A';
    console.log(`📊 Update #${stats.count} | Price: ${currentPrice} | Latency: ${latency}ms | Avg: ${stats.mean.toFixed(1)}ms`);

    // Only run simulation once after 10 seconds
    if (!hasRunSimulation) return;

    const result = response.toBundleIx();
    const sigVerifyIx = Array.isArray(result) ? result[0] : result;
    const testIx = await myProgramIx(testProgram, queue.pubkey, keypair.publicKey);

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
        commitment: "confirmed"
      });

      if (sim.value.err) {
        console.error('❌ Simulation failed:', sim.value.err);
        return;
      }

      console.log('✅ Simulation succeeded!');

      // Display program logs that show feed values
      if (sim.value.logs) {
        console.log('\n📋 Program logs:');
        sim.value.logs.forEach((log: string) => {
          if (log.includes('Feed hash:') || log.includes('Feed value:') || log.includes('Bundle verified slot:')) {
            console.log(`   ${log}`);
          }
        });
      }

      console.log(`\n📈 Final stats: ${stats.count} updates, ${stats.mean.toFixed(1)}ms avg latency`);
      process.exit(0);
    } catch (error) {
      console.error('💥 Transaction error:', error);
      process.exit(1);
    }
  });

  console.log('📡 Listening for price updates (will simulate after 10 seconds)...');
})();
