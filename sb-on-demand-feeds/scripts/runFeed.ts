import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { myAnchorProgram, myProgramIx, TX_CONFIG, DEMO_PATH } from "./utils";
import { PublicKey } from "@solana/web3.js";

const argv = yargs(process.argv).options({ feed: { required: true } }).argv;

(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feedAccount = new sb.PullFeed(program, argv.feed);
  const demo = await myAnchorProgram(program.provider, DEMO_PATH);

  while (true) {
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx();
    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, await myProgramIx(demo, argv.feed)],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const updateEvent = new sb.PullFeedValueEvent(
      sb.AnchorUtils.loggedEvents(program, sim.value.logs)[0]
    ).toRows();
    console.log("Submitted Price Updates:\n", updateEvent);
    console.log(`Transaction sent: ${await connection.sendTransaction(tx)}`);
    await sb.sleep(3000);
  }
})();
