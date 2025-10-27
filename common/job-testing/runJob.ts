import { OracleJob, CrossbarClient } from "@switchboard-xyz/common";

function buildCoinbaseJob(pair: string): OracleJob {
  const parts = pair.split("-");
  const jobConfig = {
    tasks: [
      {
        valueTask: { value: 1 },
      },
      {
        divideTask: {
          job: {
            tasks: [
              {
                httpTask: {
                  url: `https://api.coinbase.com/v2/exchange-rates?currency=${parts[1]}`,
                  headers: [
                    { key: "Accept", value: "application/json" },
                    { key: "User-Agent", value: "Mozilla/5.0" },
                  ],
                },
              },
              {
                jsonParseTask: {
                  path: `$.data.rates.${parts[0]}`,
                },
              },
            ],
          },
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

(async function main() {
  // Get pair from command line args or use default
  const pair = "BTC-USD";

  // Initialize Crossbar client (chain-agnostic)
  const crossbarUrl = "https://crossbar.switchboard.xyz";
  const crossbarClient = new CrossbarClient(crossbarUrl);

  console.log(`\n📊 Fetching ${pair} price from Coinbase...\n`);

  // Create an OracleFeed with the job
  const feed = {
    name: `${pair} Price - Coinbase`,
    jobs: [buildCoinbaseJob(pair)],
  };

  // Simulate feed with Crossbar
  const result = await crossbarClient.simulateFeed(
    feed,
    false, // includeReceipts
  );

  // Display results
  const price = result.results?.[0];

  console.log(`✅ ${pair} Price: $${Number(price).toLocaleString()}`);
  console.log(JSON.stringify(result, null, 2));
})();
