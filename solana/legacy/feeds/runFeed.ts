import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import { TX_CONFIG, sleep } from "./utils";
import { DisplayState, render, initScreen, setupCleanupHandlers } from "./view";

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
  // Setup screen and cleanup handlers
  setupCleanupHandlers();
  initScreen();

  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const queue = await sb.Queue.loadDefault(program!);
  const feedAccount = new sb.PullFeed(program!, argv.feed!);
  const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");
  await feedAccount.preHeatLuts();
  const latencies: number[] = [];

  const state: DisplayState = {
    feedKey: argv.feed!,
    feedValue: null,
    slot: null,
    error: null,
    logs: [],
    stats: null,
    lastUpdate: new Date(),
    status: "fetching",
  };

  // Initial render
  render(state);

  while (true) {
    state.status = "fetching";
    state.lastUpdate = new Date();
    render(state);

    const start = Date.now();
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx({
      crossbarClient: crossbar,
    });
    const endTime = Date.now();

    // Check for oracle errors
    for (const response of responses) {
      const shortErr = response.shortError();
      if (shortErr) {
        state.error = shortErr;
        state.status = "error";
        render(state);
      }
    }

    state.status = "simulating";
    render(state);

    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx!],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);

    if (sim.value.err) {
      state.error = JSON.stringify(sim.value.err);
      state.logs = sim.value.logs || [];
      state.status = "error";
    } else {
      state.error = null;
      state.feedValue = responses[0]?.value?.toString() || "N/A";
      state.slot = sim.context.slot;
      state.logs = (sim.value.logs || []).filter(
        (l) => l.includes("Program log:") || l.includes("Program data:")
      );
      state.status = "success";
    }

    const latency = endTime - start;
    latencies.push(latency);
    state.stats = calculateStatistics(latencies);
    state.lastUpdate = new Date();

    render(state);

    await sleep(3000);
  }
})();
