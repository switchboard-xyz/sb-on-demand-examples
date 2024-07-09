import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { myAnchorProgram, buildDemoIx } from "./utils";
import { PublicKey } from "@solana/web3.js";

const argv = yargs(process.argv).options({ feed: { required: true } }).argv;
const DEMO_PATH = "target/deploy/sb_on_demand_solana-keypair.json";

(async function main() {
  const commitment = "processed";
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feedAccount = new sb.PullFeed(program, argv.feed);
  const demo = await myAnchorProgram(program.provider, DEMO_PATH);

  while (true) {
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx();
    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, await buildDemoIx(demo, argv.feed)],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, { commitment });
    console.log(`Simulation Success: ${sim.value.logs.join("\n")}`);
    console.log(`\tTransaction sent: ${await connection.sendTransaction(tx)}`);
    await sb.sleep(3000);
  }
})();
