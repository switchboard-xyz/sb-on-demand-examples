process.env.NODE_NO_WARNINGS = "1";
import axios from "axios";
import * as sb from "@switchboard-xyz/on-demand";

// Define the URL
const pythUrl =
  "https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const redstoneUrl =
  "https://oracle-gateway-1.a.redstone.vip/data-packages/latest/redstone-primary-prod";

function getAverage(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Array is empty. Cannot calculate the average.");
  }
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return sum / numbers.length;
}

// Function to fetch data, parse it, and calculate the time difference
async function fetchAndCalculatePythTimeDifference(
  sbLatency: number
): Promise<number> {
  const response = await axios.get(pythUrl);
  const data = response.data;
  const parsed = data.parsed;
  const publishTime = parsed[0]?.price?.publish_time;
  const osTime = Date.now();
  const timeDifference = osTime - publishTime * 1000;
  return timeDifference / sbLatency;
}

async function fetchAndCalculateRedstoneTimeDifference(
  sbLatency: number
): Promise<number> {
  const response = await axios.get(redstoneUrl);
  const data = response.data;
  const parsed = data;
  const publishTime = parsed["BTC"][0]?.timestampMilliseconds;
  const osTime = Date.now();
  const timeDifference = osTime - publishTime;
  return timeDifference / sbLatency;
}

async function fetchAndCalculateSwitchboardTimeDifference(
  feedAccount: sb.PullFeed
) {
  const start = Date.now();
  const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx();
  const endTime = Date.now();
  const timeDifference = endTime - start;
  return timeDifference;
}

(async () => {
  const feed = "7QJ6e57t3yM8HYVg6bAnJiCiZ3wQQ5CSVsa6GA16nJuK";
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feedAccount = new sb.PullFeed(program!, feed);
  const pythLatencies: number[] = [];
  const rsLatencies: number[] = [];
  // preheat account loads
  await feedAccount.preHeatLuts();
  await feedAccount.fetchUpdateIx();
  while (true) {
    const sbLatency = await fetchAndCalculateSwitchboardTimeDifference(
      feedAccount
    );
    const pythMultiple = await fetchAndCalculatePythTimeDifference(sbLatency);
    pythLatencies.push(pythMultiple);
    const pythAverage = getAverage(pythLatencies);
    const rsMultiple = await fetchAndCalculateRedstoneTimeDifference(sbLatency);
    rsLatencies.push(rsMultiple);
    const rsAverage = getAverage(rsLatencies);
    console.log("====================================");
    console.log(`Switchboard Latency: ${sbLatency} ms`);
    console.log(`Pyth Average: ${pythAverage.toFixed(2)}x Switchboard`);
    console.log(`Redstone Average: ${rsAverage.toFixed(2)}x Switchboard`);
    await sb.sleep(3000);
  }
})();
