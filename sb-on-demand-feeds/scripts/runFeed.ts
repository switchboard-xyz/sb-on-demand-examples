import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { myAnchorProgram } from "./utils";
import { PublicKey } from "@solana/web3.js";

const argv = yargs(process.argv).options({ feed: { required: true } }).argv;

(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  //const feed = new PublicKey(argv.feed);
  const feed = new PublicKey("AXRydnjDeWUgR5VGFFqtzYv52u2MHqFCYcsHsnEgCD15");
  const feedAccount = new sb.PullFeed(program, feed);
  const commitment = "processed";
  const demoPath = "target/deploy/sb_on_demand_solana-keypair.json";
  const demo = await myAnchorProgram(program.provider, demoPath);
  const myIx = await demo.methods.test().accounts({ feed }).instruction();
  const conf = { numSignatures: 3 };

  while (true) {
    const [pullIx, responses, success] = await feedAccount.fetchUpdateIx(conf);
    if (!success) throw new Error(`Errors: ${responses.map((x) => x.error)}`);

    const lutOwners = [...responses.map((x) => x.oracle), feedAccount];
    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, myIx],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: await sb.loadLookupTables(lutOwners),
    });

    const sim = await connection.simulateTransaction(tx, { commitment });
    const sig = await connection.sendTransaction(tx);
    const simPrice = +sim.value.logs.join().match(/price: "(\d+(\.\d+)?)/)[1];
    console.log(`Price update: ${simPrice}\n\tTransaction sent: ${sig}`);
    await sb.sleep(3000);
  }
})();
