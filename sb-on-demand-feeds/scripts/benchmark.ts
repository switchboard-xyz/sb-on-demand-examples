process.env.NODE_NO_WARNINGS = "1";
import axios from "axios";
import * as sb from "@switchboard-xyz/on-demand";
import { Web3 } from "web3";
const path = require("path");
const supraAbiFilePath = path.join(__dirname, "../resources/supra-abi.json");
console.log("Supra ABI file path: ", supraAbiFilePath);
const OracleProofABI = require(supraAbiFilePath);

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

class SupraClient {
  client: any;
  web3: Web3;
  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL: baseURL,
    });
    this.web3 = new Web3(
      new Web3.providers.HttpProvider("https://rpc.ankr.com/eth")
    );
  }

  async getProof(request: any) {
    try {
      const response = await this.client.post("/get_proof", request);
      return this.parse(response.data);
    } catch (error) {
      throw error;
    }
  }

  async parse(response: any): Promise<any> {
    const hex = response.proof_bytes;

    let proof_data: any = this.web3.eth.abi.decodeParameters(
      OracleProofABI,
      hex
    );

    let pairId = []; // list of all the pair ids requested
    let pairPrice = []; // list of prices for the corresponding pair ids
    let pairDecimal = []; // list of pair decimals for the corresponding pair ids
    let pairTimestamp = []; // list of pair last updated timestamp for the corresponding pair ids

    const i = 0;
    for (
      let j = 0;
      j < proof_data[0].data[i].committee_data.committee_feed.length;
      j++
    ) {
      pairId.push(
        proof_data[0].data[i].committee_data.committee_feed[j].pair.toString(10)
      ); // pushing the pair ids requested in the output vector

      pairPrice.push(
        proof_data[0].data[i].committee_data.committee_feed[j].price.toString(
          10
        )
      ); // pushing the pair price for the corresponding ids

      pairDecimal.push(
        proof_data[0].data[i].committee_data.committee_feed[
          j
        ].decimals.toString(10)
      ); // pushing the pair decimals for the corresponding ids requested

      pairTimestamp.push(
        proof_data[0].data[i].committee_data.committee_feed[
          j
        ].timestamp.toString(10)
      ); // pushing the pair timestamp for the corresponding ids requested
    }

    return {
      pairId: pairId[0],
      pairPrice: pairPrice[0],
      pairDecimal: pairDecimal[0],
      pairTimestamp: new Date(+pairTimestamp[0]),
    };
  }
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

async function fetchAndCalculateSupraTimeDifference(
  sbLatency: number
): Promise<number> {
  const address = "https://rpc-mainnet-dora-2.supra.com";
  const pairIndexes = [0];
  const chainType = "evm";

  const client = new SupraClient(address);

  const request = {
    pair_indexes: pairIndexes,
    chain_type: chainType,
  };
  const resp = await client.getProof(request);
  const osTime = Date.now();
  const timeDifference = osTime - resp.pairTimestamp;
  return timeDifference / sbLatency;
}

(async () => {
  const feed = "7QJ6e57t3yM8HYVg6bAnJiCiZ3wQQ5CSVsa6GA16nJuK";
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feedAccount = new sb.PullFeed(program!, feed);
  const pythLatencies: number[] = [];
  const rsLatencies: number[] = [];
  const supraLatencies: number[] = [];
  // preheat account loads
  await feedAccount.preHeatLuts();
  await feedAccount.fetchUpdateIx();
  let samples = 0;
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
    const supraMultiple = await fetchAndCalculateSupraTimeDifference(sbLatency);
    supraLatencies.push(supraMultiple);
    const supraAverage = getAverage(supraLatencies);
    console.log(`${"=".repeat(10)} Samples (${++samples}) ${"=".repeat(10)}`);
    console.log(`Switchboard Latency: ${sbLatency} ms`);
    console.log(`Pyth Average: ${pythAverage.toFixed(2)}x Switchboard`);
    console.log(`Redstone Average: ${rsAverage.toFixed(2)}x Switchboard`);
    console.log(`Supra Average: ${supraAverage.toFixed(2)}x Switchboard`);
    // await sb.sleep(3000);
  }
})();
