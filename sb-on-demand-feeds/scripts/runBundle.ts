import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import { TX_CONFIG, sleep, myAnchorProgram, myProgramIx, DEMO_PATH } from "./utils";
import { PublicKey } from "@solana/web3.js";
import { Connection, Keypair, SYSVAR_SLOT_HASHES_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";

const argv = yargs(process.argv).options({ feedHash: {
    type: 'string',
    required: true
  }
}).parseSync();

function calculateStatistics(latencies: number[]) {
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const min = sortedLatencies[0];
  const max = sortedLatencies[sortedLatencies.length - 1];
  const median =
    sortedLatencies.length % 2 === 0
      ? (sortedLatencies[sortedLatencies.length / 2 - 1] +
          sortedLatencies[sortedLatencies.length / 2]) /
        2
      : sortedLatencies[Math.floor(sortedLatencies.length / 2)];
  const sum = sortedLatencies.reduce((a, b) => a + b, 0);
  const mean = sum / sortedLatencies.length;

  return {
    min,
    max,
    median,
    mean,
    count: latencies.length,
  };
}

(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const testProgram = await myAnchorProgram(program!.provider, DEMO_PATH);
  const crossbar = CrossbarClient.default();
  const queue = await sb.Queue.loadDefault(program!);
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar);
  const lut = await queue.loadLookupTable();
  const latencies: number[] = [];

  while (true) {
    const start = Date.now();
    console.log(`Fetching update for feed: ${argv.feedHash}`);
    const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(gateway, crossbar, [
      argv.feedHash,
    ], 3);
    console.log('done fetching update bundle');
    const endTime = Date.now();
    const latency = endTime - start;
    latencies.push(latency);
    const testIx = await myProgramIx(testProgram, queue.pubkey, bundle);

    const stats = calculateStatistics(latencies);
    console.log(`Min latency: ${stats.min} ms`);
    console.log(`Max latency: ${stats.max} ms`);
    console.log(`Median latency: ${stats.median} ms`);
    console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
    console.log(`Loop count: ${stats.count}`);
    const tx = await sb.asV0Tx({
      connection,
      ixs: [sigVerifyIx, testIx],
      signers: [keypair],
      computeUnitPrice: 20_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: [lut],
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    console.log(`Simulation result: ${JSON.stringify(sim.value, null, 2)}`);
    console.log(`Transaction sent: ${await connection.sendTransaction(tx)}`);
    await sleep(3_000);
  }
})();
