import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { myAnchorProgram, myProgramIx, TX_CONFIG, DEMO_PATH } from "./utils";
import { PublicKey } from "@solana/web3.js";

const argv = yargs(process.argv).options({ feed: { required: true } })
  .argv as any;

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
  const feedAccount = new sb.PullFeed(program!, argv.feed!);
  await feedAccount.preHeatLuts();
  const latencies: number[] = [];

  while (true) {
    const start = Date.now();
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx();
    const endTime = Date.now();
    for (const response of responses) {
      const shortErr = response.shortError();
      if (shortErr) {
        console.log(`Error: ${shortErr}`);
      }
    }
    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx!],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const updateEvent = new sb.PullFeedValueEvent(
      sb.AnchorUtils.loggedEvents(program!, sim.value.logs!)[0]
    ).toRows();
    console.log("Submitted Price Updates:\n", updateEvent);
    const latency = endTime - start;
    latencies.push(latency);

    const stats = calculateStatistics(latencies);
    console.log(`Min latency: ${stats.min} ms`);
    console.log(`Max latency: ${stats.max} ms`);
    console.log(`Median latency: ${stats.median} ms`);
    console.log(`Mean latency: ${stats.mean.toFixed(2)} ms`);
    console.log(`Loop count: ${stats.count}`);
    console.log(`Transaction sent: ${await connection.sendTransaction(tx)}`);
    await sb.sleep(3000);
  }
})();
