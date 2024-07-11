import * as sb from "@switchboard-xyz/on-demand";
import { myAnchorProgram, TX_CONFIG, DEMO_PATH } from "./utils";
import { PublicKey } from "@solana/web3.js";

(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  // NOTE: These are published feeds on devnet. You can replace them with your own feeds.
  const f1 = new PublicKey("4JSGSjzEewwKuDiAi4pdtgYhhAzoAEVGxKWbV11R5Cvf");
  const f2 = new PublicKey("A1rStfT1W6vMd3jnAv1oK2YHzT2jRrvCgChtoYL78ZqH");
  const demo = await myAnchorProgram(program.provider, DEMO_PATH);
  const myIx1 = await demo.methods.test().accounts({ feed: f1 }).instruction();
  const myIx2 = await demo.methods.test().accounts({ feed: f2 }).instruction();

  while (true) {
    const [pullIx, luts] = await sb.PullFeed.fetchUpdateManyIx(program, {
      feeds: [f1, f2],
      numSignatures: 3,
    });

    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, myIx1, myIx2],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    console.log(`Success ${sim.value.logs.join("\n")}`);
    console.log(`\tTransaction sent: ${await connection.sendTransaction(tx)}`);
    await sb.sleep(3000);
  }
})();
