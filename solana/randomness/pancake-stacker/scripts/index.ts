// Set up axios timeout override BEFORE importing Switchboard modules
import axios from 'axios';

// Override axios.create to ensure all instances use 7-second timeout
const originalCreate = axios.create;
axios.create = function(config = {}) {
  return originalCreate({
    timeout: 7000,
    ...config,
  });
};
axios.defaults.timeout = 7000;

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  Commitment,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import {
  loadSbProgram,
  setupQueue,
  initializePancakeStackerProgram,
  initializePlayer,
  createFlipPancakeInstruction,
  createCatchPancakeInstruction,
  getPlayerStats,
} from "./utils";
import * as fs from "fs";
import * as path from "path";

const PLAYER_STATE_SEED = "playerState";
const COMMITMENT = "confirmed";
const RANDOMNESS_KEYPAIR_PATH = path.join(__dirname, "randomness-keypair.json");

async function retryCommitRandomness(
  randomness: sb.Randomness,
  queue: any,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<anchor.web3.TransactionInstruction> {
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
      delayMs = Math.min(delayMs * 1.5, 8000);
    }
  }

  throw new Error("Should not reach here");
}

async function retryRevealRandomness(
  randomness: sb.Randomness,
  maxRetries: number = 5,
  delayMs: number = 2000
): Promise<anchor.web3.TransactionInstruction> {
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
      delayMs = Math.min(delayMs * 1.5, 10000);
    }
  }

  throw new Error("Should not reach here");
}

async function loadOrCreateRandomnessAccount(
  sbProgram: anchor.Program,
  queue: any
): Promise<{ randomness: sb.Randomness; rngKp: Keypair; createIx?: anchor.web3.TransactionInstruction }> {
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
  console.log("========================================");
  console.log("       PANCAKE STACKER");
  console.log("========================================\n");

  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();

  console.log("Setup...");
  console.log("Program", program!.programId.toString());

  let queue = await setupQueue(program!);
  const myProgram = await initializePancakeStackerProgram(program!.provider);
  const sbProgram = await loadSbProgram(program!.provider);

  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: false,
    maxRetries: 0,
  };

  // Load or create randomness account
  const { randomness, rngKp, createIx } = await loadOrCreateRandomnessAccount(sbProgram, queue);

  // Create the randomness account if it's new
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
    console.log("  Transaction Signature for randomness account creation:", sig1);
  } else {
    console.log("Reusing existing randomness account:", randomness.pubkey.toString());
  }

  // Initialize player state account
  const playerStateAccount = PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), keypair.publicKey.toBuffer()],
    myProgram.programId
  );

  // Check if player is already initialized
  let stats = await getPlayerStats(myProgram, playerStateAccount[0]);
  if (!stats) {
    console.log("\nInitializing player state...");
    await initializePlayer(
      myProgram,
      playerStateAccount,
      keypair,
      sbProgram,
      connection
    );
    stats = await getPlayerStats(myProgram, playerStateAccount[0]);
  }

  console.log(`\nCurrent stack: ${stats?.stackHeight ?? 0} pancakes`);

  // Commit to randomness with retry logic
  console.log("\nFlipping pancake...");
  const commitIx = await retryCommitRandomness(randomness, queue);

  // Create flip pancake instruction
  const flipPancakeIx = await createFlipPancakeInstruction(
    myProgram,
    rngKp.publicKey,
    playerStateAccount,
    keypair
  );

  const commitTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [commitIx, flipPancakeIx],
    payer: keypair.publicKey,
    signers: [keypair],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim4 = await connection.simulateTransaction(commitTx, txOpts);
  const sig4 = await connection.sendTransaction(commitTx, txOpts);
  await connection.confirmTransaction(sig4, COMMITMENT);
  console.log("  Transaction Signature (flip):", sig4);

  // Reveal the randomness with retry logic
  console.log("\nCatching pancake...");
  console.log("Waiting 3 seconds before attempting reveal...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  const revealIx = await retryRevealRandomness(randomness);
  const catchPancakeIx = await createCatchPancakeInstruction(
    myProgram,
    playerStateAccount,
    rngKp.publicKey,
    keypair
  );

  const revealTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [revealIx, catchPancakeIx],
    payer: keypair.publicKey,
    signers: [keypair],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim5 = await connection.simulateTransaction(revealTx, txOpts);
  const sig5 = await connection.sendTransaction(revealTx, txOpts);
  await connection.confirmTransaction(sig5, COMMITMENT);
  console.log("  Transaction Signature (catch):", sig5);

  // Parse the result from transaction logs
  const answer = await connection.getParsedTransaction(sig5, {
    maxSupportedTransactionVersion: 0,
  });

  const landedLog = answer?.meta?.logMessages?.find((line) =>
    line.includes("PANCAKE_LANDED")
  );
  const knockedOverLog = answer?.meta?.logMessages?.find((line) =>
    line.includes("STACK_KNOCKED_OVER")
  );

  console.log("\n========================================");
  if (landedLog) {
    const match = landedLog.match(/new_stack_height=(\d+)/);
    const newHeight = match ? match[1] : "?";
    console.log("PANCAKE LANDED!");
    console.log(`Stack height: ${newHeight} pancakes`);
  } else if (knockedOverLog) {
    console.log("STACK KNOCKED OVER!");
    console.log("Your stack has been reset to 0");
  }
  console.log("========================================\n");

  // Show final stats
  const finalStats = await getPlayerStats(myProgram, playerStateAccount[0]);
  console.log(`Your stack: ${finalStats?.stackHeight ?? 0} pancakes`);

  console.log("\nGame completed!");
  process.exit(0);
})();
