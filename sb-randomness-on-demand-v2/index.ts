import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import reader from "readline-sync";
import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import { Queue, SB_ON_DEMAND_PID } from "@switchboard-xyz/on-demand";

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = myProgramKeypair.publicKey;
  const idl = (await anchor.Program.fetchIdl(pid, provider))!;
  const program = new anchor.Program(idl, provider);
  return program;
}

let argv = yargs(process.argv).options({
  feed: { type: "string", describe: "An existing feed to pull from" },
  mainnet: { type: "boolean", describe: "Use mainnet queue" },
}).argv;

(async function main() {
  console.clear();
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  console.log("Program", program!.programId.toString());
  const userGuess = getUserGuessFromCommandLine();
  let queue = new PublicKey("FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di");

  const queueAccount = new Queue(program!, queue);
  console.log("Queue account", queue.toString());
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    return;
  }
  const myProgramPath =
    "sb-randomness/target/deploy/sb_randomness-keypair.json";
  const myProgram = await myAnchorProgram(program!.provider, myProgramPath);
  console.log("My program", myProgram.programId.toString());
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };

  const sbProgramId = SB_ON_DEMAND_PID;
  const sbIdl = await anchor.Program.fetchIdl(sbProgramId, program!.provider);
  const sbProgram = new anchor.Program(sbIdl!, program!.provider);
  const rngKp = Keypair.generate();

  const [randomness, ix] = await sb.Randomness.create(sbProgram, rngKp, queue);
  console.log("Randomness account", randomness.pubkey.toString());
  console.log("ix", ix);

  const createRandomnessTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [ix],
    payer: keypair.publicKey,
    signers: [keypair, rngKp],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim = await connection.simulateTransaction(createRandomnessTx, txOpts);
  const sig1 = await connection.sendTransaction(createRandomnessTx, txOpts);
  await connection.confirmTransaction(sig1, COMMITMENT);
  console.log("Transaction Signature", sig1);

  const playerStateAccount = await PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), keypair.publicKey.toBuffer()],
    sbProgram.programId
  );

  // Find the escrow account PDA
  const [escrowAccount, escrowBump] = await PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED)],
    myProgram.programId
  );

  console.log("Escrow account", escrowAccount.toString());
  console.log("Player state account", playerStateAccount.toString());
  console.log("");

  const initIx = await myProgram.methods
    .initialize()
    .accounts({
      playerState: playerStateAccount,
      escrowAccount: escrowAccount,
      user: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const initTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [initIx],
    payer: keypair.publicKey,
    signers: [keypair],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim2 = await connection.simulateTransaction(initTx, txOpts);
  const sig2 = await connection.sendTransaction(initTx, txOpts);
  await connection.confirmTransaction(sig2, COMMITMENT);
  console.log("Transaction Signature init", sig2);

  await ensureEscrowFunded(
    connection,
    escrowAccount,
    keypair,
    sbProgram,
    txOpts
  );

  // commit ix
  const commitIx = await randomness.commitIx(queue);
  // call coinflip program Ix

  const coinFlipIx = await myProgram.methods
    .coinFlip(rngKp.publicKey, userGuess)
    .accounts({
      playerState: playerStateAccount,
      user: keypair.publicKey,
      randomnessAccountData: rngKp.publicKey,
      escrowAccount: escrowAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const commitTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [commitIx, coinFlipIx],
    payer: keypair.publicKey,
    signers: [keypair],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim4 = await connection.simulateTransaction(commitTx, txOpts);
  const sig4 = await connection.sendTransaction(commitTx, txOpts);
  await connection.confirmTransaction(sig4, COMMITMENT);
  console.log("Transaction Signature commitTx", sig4);

  // now to reveal the randomness
  const revealIx = await randomness.revealIx();
  const settleFlipIx = await myProgram.methods
    .settleFlip(escrowBump)
    .accounts({
      playerState: playerStateAccount,
      randomnessAccountData: rngKp.publicKey,
      escrowAccount: escrowAccount,
      user: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const revealTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [revealIx, settleFlipIx],
    payer: keypair.publicKey,
    signers: [keypair],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim5 = await connection.simulateTransaction(revealTx, txOpts);
  const sig5 = await connection.sendTransaction(revealTx, txOpts);
  await connection.confirmTransaction(sig5, COMMITMENT);
  console.log("Transaction Signature revealTx", sig5);
})();

function getUserGuessFromCommandLine(): boolean {
  // Extract the user's guess from the command line arguments
  let userGuessInput = process.argv[2]; // The third argument is the user's input
  if (!userGuessInput) {
    userGuessInput = reader
      .question("It is now time to make your prediction: Heads or tails... ")
      .trim()
      .toLowerCase();
  }

  // Validate and convert the input to a boolean (heads = true, tails = false)
  const isValidGuess = userGuessInput === "heads" || userGuessInput === "tails";
  if (!isValidGuess) {
    console.error('Please provide a valid guess: "heads" or "tails".');
    process.exit(1); // Exit the script with an error code
  }

  return userGuessInput === "heads"; // Convert "heads" to true, "tails" to false
}

async function ensureEscrowFunded(
  connection: Connection,
  escrowAccount: PublicKey,
  keypair: Keypair,
  sbProgram: anchor.Program,
  txOpts: any
): Promise<void> {
  const accountBalance = await connection.getBalance(escrowAccount);
  const minRentExemption =
    await connection.getMinimumBalanceForRentExemption(0);

  const requiredBalance = minRentExemption;
  if (accountBalance < requiredBalance) {
    const amountToFund = requiredBalance - accountBalance;
    console.log(
      `Funding account with ${amountToFund} lamports to meet rent exemption threshold.`
    );

    const transferIx = SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: escrowAccount,
      lamports: amountToFund,
    });

    const transferTx = await sb.asV0Tx({
      connection: sbProgram.provider.connection,
      ixs: [transferIx],
      payer: keypair.publicKey,
      signers: [keypair],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const sim3 = await connection.simulateTransaction(transferTx, txOpts);
    const sig3 = await connection.sendTransaction(transferTx, txOpts);
    await connection.confirmTransaction(sig3, COMMITMENT);
    console.log("Transaction Signature transfer ", sig3);
  } else {
    console.log("Escrow account funded already");
  }
}
