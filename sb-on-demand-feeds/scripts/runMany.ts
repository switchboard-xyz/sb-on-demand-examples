import * as sb from "@switchboard-xyz/on-demand";
import { TX_CONFIG, sleep } from "./utils";
import { PublicKey } from "@solana/web3.js";
import { BorshInstructionCoder } from "@coral-xyz/anchor";

(async function main() {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  // NOTE: These are published feeds on devnet. You can replace them with your own feeds.
  const f1 = new PublicKey("F8oaENnmLEqyHoiX6kqYu7WbbMGvuoB15fXfWX6SXUdZ");
  const f2 = new PublicKey("Fmx4PXYEt3rxnabPfuQYpQjgnC6DcytFPELHaVfQHmHz");
  console.log("Using feeds:", f1.toBase58(), f2.toBase58());
  while (true) {
    const [pullIx, luts] = await sb.PullFeed.fetchUpdateManyLightIx(program!, {
      feeds: [f1, f2],
      numSignatures: 3,
    });

    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    const sim = await connection.simulateTransaction(tx, TX_CONFIG);
    const ixCoder = new BorshInstructionCoder(program!.idl);
    console.log(
      "Submitting ix:",
      JSON.stringify(ixCoder.decode(pullIx.at(-1)!.data), null, 2)
    );
    console.log(
      "Submitted Price Updates:\n",
      JSON.stringify(sim.value.logs!, null, 2)
    );
    console.log(`Transaction sent: ${await connection.sendTransaction(tx)}`);
    await sleep(3000);
  }
})();
