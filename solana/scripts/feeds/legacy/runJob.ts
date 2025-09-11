import { OracleJob, CrossbarClient } from "@switchboard-xyz/common";
import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { sleep, calculateStatistics } from "../../utils";
import { buildBinanceJob } from "../../utils";

interface JobConfig {
  name: string;
  builder: (param: string) => OracleJob;
  paramName: string;
  description: string;
}

const JOB_CONFIGS: JobConfig[] = [
  {
    name: "binance",
    builder: buildBinanceJob,
    paramName: "pair",
    description: "Binance price feed (e.g., BTCUSDT)"
  }
];

const argv = yargs(process.argv)
  .options({
    job: {
      required: true,
      type: 'string',
      describe: 'Job type to run',
      choices: JOB_CONFIGS.map(config => config.name)
    },
    param: {
      required: true,
      type: 'string',
      describe: 'Parameter for the job (pair, ID, etc.)'
    },
    interval: {
      type: 'number',
      default: 3000,
      describe: 'Interval between job executions in milliseconds'
    },
    count: {
      type: 'number',
      describe: 'Number of times to run the job (omit for infinite loop)'
    },
    numSignatures: {
      type: 'number',
      default: 3,
      describe: 'Number of oracle signatures to request for consensus'
    },
    gateway: {
      type: 'string',
      default: 'https://92.222.100.184.xip.switchboard-oracles.xyz/mainnet',
      describe: 'Crossbar gateway URL'
    }
  })
  .help()
  .example('$0 --job binance --param BTCUSDT', 'Fetch Binance BTC/USDT via consensus')
  .example('$0 --job binance --param BTCUSDT --numSignatures 5', 'Use 5 oracle signatures')
  .example('$0 --job binance --param BTCUSDT --count 10', 'Run 10 times then stop')
  .argv as any;

function printJobList() {
  console.log('\nAvailable Jobs:');
  console.log('===============');
  JOB_CONFIGS.forEach(config => {
    console.log(`${config.name.padEnd(12)} - ${config.description}`);
  });
  console.log('');
}


(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const queue = await sb.Queue.loadDefault(program!);
  // const crossbar = new CrossbarClient("http://localhost:8080");
  const crossbar = new CrossbarClient("http://crossbar.switchboard.xyz");
  const gateway = await queue.fetchGatewayFromCrossbar(crossbar as any);
  const res = await queue.fetchSignaturesConsensus({
    gateway: "http://localhost:8082",
    feedConfigs: [{
      feed: {
        name: "binance",
        jobs: [{
          tasks: [{
            valueTask: {
              value: 1,
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
    },
  });
})();
