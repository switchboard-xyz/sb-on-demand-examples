import { OracleJob, CrossbarClient } from "@switchboard-xyz/common";
import * as sb from "@switchboard-xyz/on-demand";

function getPolygonJob(): OracleJob {
  const job = OracleJob.fromObject({
    tasks: [
      {
        httpTask: {
          url: "https://api.polygon.io/v2/last/trade/AAPL?apiKey=${POLYGON_API_KEY}",
          method: "GET",
          headers: [],
          body: undefined,
        }
      },
      {
        jsonParseTask: {
          path: "$.results.p",
        }
      }
    ]
  });
  return job;
}

(async function main() {
  const { crossbar, queue, gateway } = await sb.AnchorUtils.loadEnv();
  const res = await queue.fetchSignaturesConsensus({
    gateway,
    useEd25519: true,
    feedConfigs: [{
      feed: {
        jobs: [getPolygonJob()],
      },
    }],
    variableOverrides: {
      "POLYGON_API_KEY": process.env.POLYGON_API_KEY!,
    },
  });
  console.log(res.median_responses);
})();
