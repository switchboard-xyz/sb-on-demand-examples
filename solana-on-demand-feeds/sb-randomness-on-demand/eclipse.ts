import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  initializeGame,
  loadSbProgram,
  loadSVMSwitchboardProgram,
} from "./utils";
import { setupSVMQueue } from "./utils";
import { getUserGuessFromCommandLine } from "./utils";
import { initializeMyProgram } from "./utils";
import { createCoinFlipInstruction } from "./utils";
import { settleFlipInstruction } from "./utils";
import { ensureEscrowFunded } from "./utils";

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";

(async function main() {
  console.clear();

  console.log({
    ...(await sb.AnchorUtils.loadEnv()),
  });
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();

  console.log("\nSetup...");
  console.log("Program", program!.programId.toString());
  const userGuess = getUserGuessFromCommandLine();

  const genesisHash = await connection.getGenesisHash();
  const isTestnet =
    genesisHash == "CX4huckiV9QNAkKNVKi5Tj8nxzBive5kQimd94viMKsU";
  const isMainnet =
    genesisHash == "8axJLKAqQU9oyULRunGrZTLDEXhn17VWxoH5F7MCmdXG";
  if (!isTestnet && !isMainnet) {
    throw new Error(
      "Unsupported network. Only Eclipse testnet and mainnet are supported for this."
    );
  }

  // map to solana or devnet queue
  const queueKey = isMainnet
    ? sb.ON_DEMAND_MAINNET_QUEUE_PDA
    : sb.ON_DEMAND_DEVNET_QUEUE_PDA;

  const myProgram = await initializeMyProgram(program!.provider);
  const sbProgram = await loadSVMSwitchboardProgram(program!.provider);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: false,
    maxRetries: 0,
  };

  const r = new sb.Randomness(
    sbProgram,
    new PublicKey("6AB7juEdnFTydT3pZCsz1XdFz6coqf2SqiX9bSf1kELZ")
  );

  // create randomness account and initialise it
  const rngKp = Keypair.generate();
  const [randomness, ix] = await sb.Randomness.create(
    sbProgram,
    rngKp,
    queueKey
  );
  console.log("\nCreated randomness account..");
  console.log("Randomness account", randomness.pubkey.toString());

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
  console.log(
    "  Transaction Signature for randomness account creation: ",
    sig1
  );

  // initilise example program accounts
  const playerStateAccount = PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), keypair.publicKey.toBuffer()],
    sbProgram.programId
  );
  // Find the escrow account PDA and initliaze the game
  const [escrowAccount, escrowBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED)],
    myProgram.programId
  );
  console.log("\nInitialize the game states...");
  await initializeGame(
    myProgram,
    playerStateAccount,
    escrowAccount,
    keypair,
    sbProgram,
    connection
  );
  await ensureEscrowFunded(
    connection,
    escrowAccount,
    keypair,
    sbProgram,
    txOpts
  );

  // Commit to randomness Ix
  console.log("\nCommit to randomness...");
  const commitIx = await randomness.commitIx(queueKey);

  // Create coinFlip Ix
  const coinFlipIx = await createCoinFlipInstruction(
    myProgram,
    rngKp.publicKey,
    userGuess,
    playerStateAccount,
    keypair,
    escrowAccount
  );

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
  console.log("  Transaction Signature commitTx", sig4);

  // Reveal the randomness Ix
  console.log("\nReveal the randomness...");
  const revealIx = await randomness.revealIx();
  const settleFlipIx = await settleFlipInstruction(
    myProgram,
    escrowBump,
    playerStateAccount,
    rngKp.publicKey,
    escrowAccount,
    keypair
  );

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
  console.log("  Transaction Signature revealTx", sig5);

  const answer = await connection.getParsedTransaction(sig5, {
    maxSupportedTransactionVersion: 0,
  });
  let resultLog = answer?.meta?.logMessages?.filter((line) =>
    line.includes("FLIP_RESULT")
  )[0];
  let result = resultLog?.split(": ")[2];

  console.log("\nYour guess is ", userGuess ? "Heads" : "Tails");

  console.log(`\nAnd the random result is ... ${result}!`);
})();
