import * as anchor from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";
import { PublicKey, Keypair, Connection, Commitment } from "@solana/web3.js";

const COMMITMENT = "processed";
const TX_CONFIG = {
  commitment: COMMITMENT as Commitment,
  skipPreflight: true,
  maxRetries: 0,
};

(async function main() {
  const pid = new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
  const url =
    "https://switchbo-switchbo-6225.devnet.rpcpool.com/f6fb9f02-0777-498b-b8f5-67cbb1fc0d14";
  let connection = new Connection(url, {
    commitment: "processed",
  });
  const keypair = Keypair.generate();
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });
  const idl = (await anchor.Program.fetchIdl(pid, provider))!;
  const program = new anchor.Program(idl, provider);

  const queue = new sb.Queue(
    program,
    new PublicKey("FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di")
  );
  console.log(await queue.fetchAllGateways());
  const feedAccount = new sb.PullFeed(
    program,
    "9czpHkNbq9ufM7GXC5n4eCZ2Whrmfva8eKGLJFxaprig"
  );

  while (true) {
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx();
    console.log("Price Updates:\n", responses);
    await sb.sleep(3000);
  }
})();
