import { OracleJob, CrossbarClient } from "@switchboard-xyz/common";
import * as sb from "@switchboard-xyz/on-demand";

function getValueJob(): OracleJob {
  const job = OracleJob.fromObject({
    tasks: [
      {
        valueTask: {
          big: "${VALUE}",
        },
      },
    ],
  });
  return job;
}

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
  const { program } = await sb.AnchorUtils.loadEnv();
  const queue = await sb.Queue.loadDefault(program!);
  const crossbar = new CrossbarClient("http://crossbar.switchboard.xyz");
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar);
  const res = await queue.fetchSignaturesConsensus({
    gateway: "http://localhost:8082",
    feedConfigs: [{
      feed: {
        jobs: [getPolygonJob()],
      },
    }],
    numSignatures: 1,
    useEd25519: true,
    variableOverrides: {
      "POLYGON_API_KEY": process.env.POLYGON_API_KEY!,
    },
  });
  console.log(res.median_responses);
})();
