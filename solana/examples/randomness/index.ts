// Set up axios timeout override BEFORE importing Switchboard modules
import axios from 'axios';

// Override axios.create to ensure all instances use 7-second timeout
const originalCreate = axios.create;
axios.create = function(config = {}) {
  return originalCreate({
    timeout: 7000, // 7 seconds
    ...config,
  });
};

// Also set global default
axios.defaults.timeout = 7000;

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { initializeGame, loadSbProgram } from "./utils";
import { setupQueue } from "./utils";
import { getUserGuessFromCommandLine } from "./utils";
import { initializeMyProgram } from "./utils";
import { createCoinFlipInstruction } from "./utils";
import { settleFlipInstruction } from "./utils";
import { ensureEscrowFunded } from "./utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as fs from "fs";
import * as path from "path";

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";
const RANDOMNESS_KEYPAIR_PATH = path.join(__dirname, "randomness-keypair.json");

async function retryCommitRandomness(randomness: sb.Randomness, queue: any, maxRetries: number = 3, delayMs: number = 2000): Promise<anchor.web3.TransactionInstruction> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to commit randomness (attempt ${attempt}/${maxRetries})...`);
      const commitIx = await randomness.commitIx(queue);
      console.log("Successfully obtained commit instruction");
      return commitIx;
    } catch (error: any) {
      console.log(`Commit attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        console.error("All commit attempts failed. The Switchboard gateway may be experiencing issues.");
        throw error;
      }

      console.log(`Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Increase delay for next attempt
      delayMs = Math.min(delayMs * 1.5, 8000);
    }
  }

  throw new Error("Should not reach here");
}

async function retryRevealRandomness(randomness: sb.Randomness, maxRetries: number = 5, delayMs: number = 2000): Promise<anchor.web3.TransactionInstruction> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to reveal randomness (attempt ${attempt}/${maxRetries})...`);
      const revealIx = await randomness.revealIx();
      console.log("Successfully obtained reveal instruction");
      return revealIx;
    } catch (error: any) {
      console.log(`Reveal attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        console.error("All reveal attempts failed. The Switchboard gateway may be experiencing issues.");
        throw error;
      }

      console.log(`Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * 1.5, 10000);
    }
  }

  throw new Error("Should not reach here");
}

async function loadOrCreateRandomnessAccount(sbProgram: anchor.Program, queue: any): Promise<{ randomness: sb.Randomness; rngKp: Keypair; createIx?: anchor.web3.TransactionInstruction }> {
  let rngKp: Keypair;
  let createIx: anchor.web3.TransactionInstruction | undefined;

  if (fs.existsSync(RANDOMNESS_KEYPAIR_PATH)) {
    console.log("Loading existing randomness account...");
    const keypairData = JSON.parse(fs.readFileSync(RANDOMNESS_KEYPAIR_PATH, 'utf8'));
    rngKp = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log("Loaded randomness account", rngKp.publicKey.toString());

    const randomness = new sb.Randomness(sbProgram, rngKp.publicKey);
    return { randomness, rngKp };
  } else {
    console.log("Creating new randomness account...");
    rngKp = Keypair.generate();

    fs.writeFileSync(RANDOMNESS_KEYPAIR_PATH, JSON.stringify(Array.from(rngKp.secretKey)));
    console.log("Saved randomness keypair to", RANDOMNESS_KEYPAIR_PATH);

    const [randomness, ix] = await sb.Randomness.create(sbProgram, rngKp, queue);
    console.log("Created randomness account", randomness.pubkey.toString());

    return { randomness, rngKp, createIx: ix };
  }
}

(async function main() {
  console.clear();
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  // **** if sb.anchorUtils.loadEnv() is not working, you can use the following code: ****
  //  const connection = new anchor.web3.Connection(
  //   "https://api.devnet.solana.com",
  //   "confirmed"
  // );
  // const keypair = await sb.AnchorUtils.initKeypairFromFile("** YOUR PATH **/.config/solana/id.json");
  // const wallet = new NodeWallet(keypair);
  // const provider = new anchor.AnchorProvider(connection,wallet)
  // const pid = sb.ON_DEMAND_DEVNET_PID;
  // const program = await anchor.Program.at(pid, provider);
  console.log("\nSetup...");
  console.log("Program", program!.programId.toString());
  const userGuess = getUserGuessFromCommandLine();
  let queue = await setupQueue(program!);
  const myProgram = await initializeMyProgram(program!.provider);
  const sbProgram = await loadSbProgram(program!.provider);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: false,
    maxRetries: 0,
  };

  // load or create randomness account
  const { randomness, rngKp, createIx } = await loadOrCreateRandomnessAccount(sbProgram, queue);

  // Only create the randomness account if it's new
  if (createIx) {
    const createRandomnessTx = await sb.asV0Tx({
      connection: sbProgram.provider.connection,
      ixs: [createIx],
      payer: keypair.publicKey,
      signers: [keypair, rngKp],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const sim = await connection.simulateTransaction(createRandomnessTx, txOpts);
    const sig1 = await connection.sendTransaction(createRandomnessTx, txOpts);
    await connection.confirmTransaction(sig1, "finalized");
    console.log(
      "  Transaction Signature for randomness account creation: ",
      sig1
    );
  } else {
    console.log("Reusing existing randomness account:", randomness.pubkey.toString());
  }

  // initilise example program accounts
  const playerStateAccount = await PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), keypair.publicKey.toBuffer()],
    sbProgram.programId
  );
  // Find the escrow account PDA and initliaze the game
  const [escrowAccount, escrowBump] = await PublicKey.findProgramAddressSync(
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

  // Commit to randomness Ix with retry logic
  console.log("\nCommit to randomness...");
  const commitIx = await retryCommitRandomness(randomness, queue);

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

  // Reveal the randomness Ix with retry logic
  console.log("\nReveal the randomness...");
  console.log("Waiting 3 seconds before attempting reveal...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  const revealIx = await retryRevealRandomness(randomness);
  const settleFlipIx = await settleFlipInstruction(
    myProgram,
    escrowBump,
    playerStateAccount,
    rngKp.publicKey,
    escrowAccount,
    keypair
  );
  // Note: Not closing the randomness account so it can be reused
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

  // Test closing the randomness account
  console.log("\nClosing randomness account...");
  const closeIx = await randomness.closeIx();
  const closeTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [closeIx],
    payer: keypair.publicKey,
    signers: [keypair],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });
  const closeSig = await connection.sendTransaction(closeTx, txOpts);
  await connection.confirmTransaction(closeSig, COMMITMENT);
  console.log("  Transaction Signature closeTx", closeSig);

  // Verify account is closed
  const accountInfo = await connection.getAccountInfo(randomness.pubkey);
  if (accountInfo === null) {
    console.log("  Randomness account successfully closed!");
    // Clean up the keypair file since account is closed
    fs.unlinkSync(RANDOMNESS_KEYPAIR_PATH);
  } else {
    console.log("  WARNING: Randomness account still exists!");
  }

  console.log("\nGame completed!");
  process.exit(0);
})();
