import * as sb from "@switchboard-xyz/on-demand";
import { myAnchorProgram } from "./utils";
import { PublicKey } from "@solana/web3.js";

(async function main() {
  const feed1 = new PublicKey("4JSGSjzEewwKuDiAi4pdtgYhhAzoAEVGxKWbV11R5Cvf");
  const feed2 = new PublicKey("A1rStfT1W6vMd3jnAv1oK2YHzT2jRrvCgChtoYL78ZqH");
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const commitment = "processed";
  const demoPath = "target/deploy/sb_on_demand_solana-keypair.json";
  const demo = await myAnchorProgram(program.provider, demoPath).catch((e) => {
    throw new Error("Failed to load demo program. Was it deployed?");
  });
  const myIx1 = await demo.methods
    .test()
    .accounts({ feed: feed1 })
    .instruction();
  const myIx2 = await demo.methods
    .test()
    .accounts({ feed: feed2 })
    .instruction();
  const conf = {
    gateway: "https://xoracle-1.switchboard.xyz",
    feeds: [feed1, feed2],
    numSignatures: 8,
  };

  while (true) {
    const [pullIx, luts] = await sb.PullFeed.fetchUpdateManyIx(program, conf);

    const tx = await sb.asV0Tx({
      connection,
      ixs: [pullIx, myIx1, myIx2],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, { commitment });
    const sig = await connection.sendTransaction(tx);
    const simPrice = sim.value.logs.join("\n").match(/price: (.*)/);
    console.log(`Received ${simPrice}\n\tTransaction sent: ${sig}`);
    await sb.sleep(3000);
  }
})();
