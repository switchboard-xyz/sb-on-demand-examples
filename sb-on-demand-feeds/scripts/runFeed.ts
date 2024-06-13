import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { Provider } from "@coral-xyz/anchor";
import { PublicKey, Commitment } from "@solana/web3.js";
import { myAnchorProgram } from "./utils";

const argv = yargs(process.argv).options({ feed: { type: "string" } }).argv;

(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const feed = new sb.PullFeed(program, new PublicKey(argv.feed));
  const commitment = "processed";
  const demoPath = "target/deploy/sb_on_demand_solana-keypair.json";
  const testProgram = await myAnchorProgram(provider, demoPath);
  const readIx = testProgram.methods.test().accounts({ feed }).instruction();
  const conf = { numSignatures: 3 };

  while (true) {
    const [feedUpdateIx, responses, success] = await feed.fetchUpdateIx(conf);
    if (!success) {
      throw new Error(`Errors: ${responses.map((x) => x.error)}`);
    }

    const lutOwners = [...responses.map((x) => x.oracle), feed];
    const tx = await sb.asV0Tx({
      connection,
      ixs: [feedUpdateIx, readIx],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitMultiple: 1.3,
      lookupTables: await sb.loadLookupTables(lutOwners),
    });

    const sim = await connection.simulateTransaction(tx, { commitment });
    const sig = await connection.sendTransaction(tx);
    const simPrice = +sim.value.logs.join().match(/price:\s*"(\d+(\.\d+)?)/)[1];
    console.log(`Price update: ${simPrice}\n\tTransaction sent: ${sig}`);
    await sb.sleep(3000);
  }
})();
