import * as sb from "@switchboard-xyz/on-demand";
import { Connection, Keypair, SYSVAR_SLOT_HASHES_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import { CrossbarClient } from "@switchboard-xyz/common";
import { TX_CONFIG, sleep, myAnchorProgram, myProgramIx, DEMO_PATH, calculateStatistics } from "../utils";

(async function main() {
  const crossbar = CrossbarClient.default();
  const apiKey = process.env.SURGE_API_KEY!;

  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const testProgram = await myAnchorProgram(program!.provider, DEMO_PATH);
  const queue = await sb.Queue.loadDefault(program!);
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar);
  const lut = await queue.loadLookupTable();
  const latencies: number[] = [];

  const surge = new sb.Surge({
    apiKey,
    gatewayUrl: 'https://92.222.100.185.xip.switchboard-oracles.xyz/devnet',
    verbose: true,
  });

  await surge.connectAndSubscribe([
    { symbol: 'BTC/USD', source: 'WEIGHTED' },
  ]);

  // Listen for price updates
  surge.on('update', async (response: sb.SurgeUpdate) => {
    latencies.push(Date.now() - response.data.source_ts_ms);
    let [sigVerifyIx, bundle] = response.toBundleIx();

    const testIx = await myProgramIx(testProgram, queue.pubkey, bundle, keypair.publicKey);

    const stats = calculateStatistics(latencies);
    console.log(`Min latency: ${stats.min} ms`);
    console.log(`Max latency: ${stats.max} ms`);
    console.log(`Median latency: ${stats.median} ms`);
    console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
    console.log(`Loop count: ${stats.count}`);
    console.log(`testIx: ${testIx.toString()}`);
    const tx = await sb.asV0Tx({
      connection,
      ixs: [sigVerifyIx, testIx],
      signers: [keypair],
      computeUnitPrice: 20_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: [lut],
    });

    try {
      const sim = await connection.simulateTransaction(tx, TX_CONFIG);
      console.log(`Simulation result: ${JSON.stringify(sim.value, null, 2)}`);

    } catch (error) {
      console.error('Error executing transaction:', error);
    }
  });

  console.log('🚀 Listening for price updates...');
})();
