import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { myAnchorProgram } from "./utils";
import { PublicKey } from "@solana/web3.js";

const argv = yargs(process.argv).options({ feed: { required: true } }).argv;
const DEMO_PATH = "target/deploy/sb_on_demand_solana-keypair.json";

(async function main() {
  const commitment = "processed";
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feed = new PublicKey(argv.feed);
  const feedAccount = new sb.PullFeed(program, feed);
  const demo = await myAnchorProgram(program.provider, DEMO_PATH);
  const myIx = await demo.methods.test().accounts({ feed }).instruction();

  while (true) {
    const [pullIx, responses, ok, luts] = await feedAccount.fetchUpdateIx();
    if (!ok) throw new Error(`Failure: ${responses.map((x) => x.error)}`);

    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, myIx],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, { commitment });
    // const sig = await connection.sendTransaction(tx);
    const simPrice = sim.value.logs.join("\n");
    console.log(`Price update: ${simPrice}`);
    await sb.sleep(3000);
  }
})();
