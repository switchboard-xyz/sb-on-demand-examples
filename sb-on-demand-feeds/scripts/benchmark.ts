/**
 * @fileoverview Oracle Latency Benchmark Tool
 * 
 * This script compares the latency of Switchboard On-Demand oracles against
 * other major oracle providers (Pyth, Redstone, Supra). It measures the time
 * from when price data is published to when it's available for use.
 * 
 * The benchmark helps demonstrate Switchboard's performance advantages:
 * - Sub-second latency for price updates
 * - Direct oracle-to-consumer model
 * - No intermediate crank or relay requirements
 * 
 * Results show how many times slower other oracles are compared to Switchboard.
 * 
 * @example
 * ```bash
 * # Run the latency benchmark
 * bun run scripts/benchmark.ts
 * 
 * # Output shows comparative latencies:
 * # Switchboard Latency: 245 ms
 * # Pyth Average: 4.52x Switchboard
 * # Redstone Average: 3.21x Switchboard
 * # Supra Average: 2.87x Switchboard
 * ```
 * 
 * @module benchmark
 */

process.env.NODE_NO_WARNINGS = "1";
import axios from "axios";
import * as sb from "@switchboard-xyz/on-demand";
import { Web3 } from "web3";
const path = require("path");
const supraAbiFilePath = path.join(__dirname, "../resources/supra-abi.json");
console.log("Supra ABI file path: ", supraAbiFilePath);
const OracleProofABI = require(supraAbiFilePath);

/**
 * Oracle API endpoints for comparison
 * 
 * These URLs fetch the latest price data from each oracle provider:
 * - Pyth: BTC/USD price feed via Hermes API
 * - Redstone: Primary production data feed
 */
const pythUrl =
  "https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const redstoneUrl =
  "https://oracle-gateway-1.a.redstone.vip/data-packages/latest/redstone-primary-prod";

/**
 * Calculates the arithmetic mean of an array of numbers
 * 
 * @param {number[]} numbers - Array of numeric values
 * @returns {number} The average value
 * @throws {Error} If the array is empty
 */
function getAverage(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Array is empty. Cannot calculate the average.");
  }
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return sum / numbers.length;
}

/**
 * Client for interacting with Supra oracle network
 * 
 * Supra uses a proof-based system where price data is fetched
 * along with cryptographic proofs that must be verified on-chain.
 * This client handles the proof fetching and parsing.
 */
class SupraClient {
  client: any;
  web3: Web3;
  
  /**
   * @param {string} baseURL - Supra RPC endpoint URL
   */
  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL: baseURL,
    });
    this.web3 = new Web3(
      new Web3.providers.HttpProvider("https://rpc.ankr.com/eth")
    );
  }

  /**
   * Fetches price proof from Supra oracle
   * 
   * @param {Object} request - Request containing pair indexes and chain type
   * @returns {Promise<Object>} Parsed price data with timestamp
   */
  async getProof(request: any) {
    try {
      const response = await this.client.post("/get_proof", request);
      return this.parse(response.data);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parses Supra proof data to extract price information
   * 
   * The proof contains committee-signed price data that needs
   * to be decoded from the ABI-encoded format.
   * 
   * @param {Object} response - Raw response containing proof bytes
   * @returns {Promise<Object>} Parsed data with price and timestamp
   */
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

/**
 * Measures Pyth oracle latency relative to Switchboard
 * 
 * Fetches the latest Pyth price and calculates how old the data is
 * compared to Switchboard's latency. Pyth publish times are in seconds,
 * so we multiply by 1000 to convert to milliseconds.
 * 
 * @param {number} sbLatency - Switchboard's latency in milliseconds
 * @returns {Promise<number>} Multiple of how much slower Pyth is
 */
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

/**
 * Measures Redstone oracle latency relative to Switchboard
 * 
 * Fetches the latest Redstone price and calculates data staleness.
 * Redstone provides timestamps in milliseconds directly.
 * 
 * @param {number} sbLatency - Switchboard's latency in milliseconds
 * @returns {Promise<number>} Multiple of how much slower Redstone is
 */
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

/**
 * Measures Switchboard oracle latency
 * 
 * Times how long it takes to fetch fresh price data from Switchboard
 * oracles. This includes network round-trip and signature collection.
 * 
 * @param {sb.PullFeed} feedAccount - Switchboard feed instance
 * @returns {Promise<number>} Latency in milliseconds
 */
async function fetchAndCalculateSwitchboardTimeDifference(
  feedAccount: sb.PullFeed
) {
  const start = Date.now();
  const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx();
  const endTime = Date.now();
  const timeDifference = endTime - start;
  return timeDifference;
}

/**
 * Measures Supra oracle latency relative to Switchboard
 * 
 * Fetches price proof from Supra and calculates data age.
 * Pair index 0 corresponds to BTC/USD on Supra.
 * 
 * @param {number} sbLatency - Switchboard's latency in milliseconds
 * @returns {Promise<number>} Multiple of how much slower Supra is
 */
async function fetchAndCalculateSupraTimeDifference(
  sbLatency: number
): Promise<number> {
  const address = "https://rpc-mainnet-dora-2.supra.com";
  const pairIndexes = [0]; // BTC/USD pair
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

/**
 * Main benchmark execution
 * 
 * Continuously measures and compares oracle latencies:
 * 1. Fetches fresh data from Switchboard (baseline)
 * 2. Fetches data from other oracles and measures staleness
 * 3. Calculates relative performance (how many times slower)
 * 4. Maintains running averages for accurate comparison
 * 
 * The benchmark demonstrates Switchboard's superior latency
 * due to its direct oracle-to-consumer architecture.
 */
(async () => {
  // Example BTC/USD feed on Switchboard
  const feed = "7QJ6e57t3yM8HYVg6bAnJiCiZ3wQQ5CSVsa6GA16nJuK";
  
  // Load Solana environment
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feedAccount = new sb.PullFeed(program!, feed);
  
  // Track latency multiples for running averages
  const pythLatencies: number[] = [];
  const rsLatencies: number[] = [];
  const supraLatencies: number[] = [];
  
  // Pre-heat caches for consistent measurements
  await feedAccount.preHeatLuts();
  await feedAccount.fetchUpdateIx();
  
  let samples = 0;
  
  // Main benchmark loop
  while (true) {
    // Measure Switchboard baseline latency
    const sbLatency = await fetchAndCalculateSwitchboardTimeDifference(
      feedAccount
    );
    
    // Measure other oracles relative to Switchboard
    const pythMultiple = await fetchAndCalculatePythTimeDifference(sbLatency);
    pythLatencies.push(pythMultiple);
    const pythAverage = getAverage(pythLatencies);
    
    const rsMultiple = await fetchAndCalculateRedstoneTimeDifference(sbLatency);
    rsLatencies.push(rsMultiple);
    const rsAverage = getAverage(rsLatencies);
    
    const supraMultiple = await fetchAndCalculateSupraTimeDifference(sbLatency);
    supraLatencies.push(supraMultiple);
    const supraAverage = getAverage(supraLatencies);
    
    // Display results
    console.log(`${"=".repeat(10)} Samples (${++samples}) ${"=".repeat(10)}`);
    console.log(`Switchboard Latency: ${sbLatency} ms`);
    console.log(`Pyth Average: ${pythAverage.toFixed(2)}x Switchboard`);
    console.log(`Redstone Average: ${rsAverage.toFixed(2)}x Switchboard`);
    console.log(`Supra Average: ${supraAverage.toFixed(2)}x Switchboard`);
    
    // Continuous loop - uncomment sleep for periodic sampling
    // await sb.sleep(3000);
  }
})();
