import { OracleJob, CrossbarClient } from "@switchboard-xyz/common";
import * as sb from "@switchboard-xyz/on-demand";


(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const queue = await sb.Queue.loadDefault(program!);
  const crossbar = new CrossbarClient("http://crossbar.switchboard.xyz");
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar);
  const res = await queue.fetchSignaturesConsensus({
    gateway: "http://localhost:8082",
    feedConfigs: [{
      feed: {
        name: "binance",
        jobs: [{
          tasks: [{
            valueTask: {
              big: "${VALUE}",
            },
          }],
        }],
        minOracleSamples: 1,
        maxJobRangePct: 1000000000,
      },
    }],
    numSignatures: 1,
    useEd25519: true,
    variableOverrides: {
      "VALUE": "99999",
    },
  });
  console.log("res", res);
})();
