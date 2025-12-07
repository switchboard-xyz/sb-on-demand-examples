// Set up axios timeout override BEFORE importing Switchboard modules
import axios from "axios";

const originalCreate = axios.create;
axios.create = function (config = {}) {
  return originalCreate({
    timeout: 7000,
    ...config,
  });
};

axios.defaults.timeout = 7000;

import * as anchor from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as sb from "@switchboard-xyz/on-demand";
import {
  createCoinFlipInstruction,
  handleTransaction,
  ensureEscrowFunded,
  getUserGuessFromCommandLine,
  initializeGame,
  initializeMyProgram,
  loadSbProgram,
  settleFlipInstruction,
  setupQueue,
} from "./gillUtils";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createSolanaClient } from "gill";

type AnchorPublicKey = anchor.web3.PublicKey;
type AnchorKeypair = anchor.web3.Keypair;

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT: anchor.web3.Commitment = "confirmed";
const RANDOMNESS_KEYPAIR_PATH = path.join(__dirname, "randomness-keypair.json");

async function retryCommitRandomness(
  randomness: sb.Randomness,
  queue: AnchorPublicKey,
  maxRetries = 3,
  delayMs = 2000
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
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 8000);
    }
  }

  throw new Error("Should not reach here");
}

async function retryRevealRandomness(
  randomness: sb.Randomness,
  maxRetries = 5,
  delayMs = 2000
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
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 10000);
    }
  }

  throw new Error("Should not reach here");
}

async function loadOrCreateRandomnessAccount(
  sbProgram: anchor.Program,
  queue: AnchorPublicKey
): Promise<{
  randomness: sb.Randomness;
  rngKp: AnchorKeypair;
  createIx?: anchor.web3.TransactionInstruction;
}> {
  let rngKp: AnchorKeypair;
  let createIx: anchor.web3.TransactionInstruction | undefined;

  if (fs.existsSync(RANDOMNESS_KEYPAIR_PATH)) {
    console.log("Loading existing randomness account...");
    const keypairData = JSON.parse(fs.readFileSync(RANDOMNESS_KEYPAIR_PATH, "utf8"));
    rngKp = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log("Loaded randomness account", rngKp.publicKey.toString());

    const randomness = new sb.Randomness(sbProgram, rngKp.publicKey);
    return { randomness, rngKp };
  }

  console.log("Creating new randomness account...");
  rngKp = anchor.web3.Keypair.generate();
  fs.writeFileSync(RANDOMNESS_KEYPAIR_PATH, JSON.stringify(Array.from(rngKp.secretKey)));
  console.log("Saved randomness keypair to", RANDOMNESS_KEYPAIR_PATH);

  const [randomness, ix] = await sb.Randomness.create(sbProgram, rngKp, queue);
  console.log("Created randomness account", randomness.pubkey.toString());

  return { randomness, rngKp, createIx: ix };
}

function getRpcEndpoint(): string {
  return (
    process.env.GILL_RPC_URL ||
    process.env.RPC_URL ||
    process.env.ANCHOR_PROVIDER_URL ||
    "https://api.devnet.solana.com"
  );
}

function getWalletPath(): string {
  return (
    process.env.GILL_WALLET ||
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json")
  );
}

(async function main() {
  console.clear();

  const rpcUrl = getRpcEndpoint();
  const walletPath = getWalletPath();

  const gillClient = createSolanaClient({ urlOrMoniker: rpcUrl });
  const anchorConnection = new anchor.web3.Connection(rpcUrl, COMMITMENT);
  const keypair = await sb.AnchorUtils.initKeypairFromFile(walletPath);
  const wallet = new NodeWallet(keypair);
  const provider = new anchor.AnchorProvider(anchorConnection, wallet, {
    commitment: COMMITMENT,
  });
  anchor.setProvider(provider);

  console.log("\nSetup...");
  console.log("RPC", rpcUrl);
  console.log("Wallet", walletPath);

  const sbProgram = await loadSbProgram(provider);
  console.log("Switchboard Program", sbProgram.programId.toString());

  const userGuess = getUserGuessFromCommandLine();
  const queue = await setupQueue(sbProgram);
  const myProgram = await initializeMyProgram(provider);

  const txOpts: anchor.web3.ConfirmOptions = {
    commitment: "processed",
    skipPreflight: false,
    maxRetries: 0,
  };

  const { randomness, rngKp, createIx } = await loadOrCreateRandomnessAccount(
    sbProgram,
    queue
  );

  if (createIx) {
    const sig1 = await handleTransaction(
      sbProgram,
      gillClient,
      [createIx],
      keypair,
      [keypair, rngKp],
      { ...txOpts, commitment: "processed" }
    );
    console.log("  Transaction Signature for randomness account creation:", sig1);
  } else {
    console.log("Reusing existing randomness account:", randomness.pubkey.toString());
  }

  const playerStateAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), keypair.publicKey.toBuffer()],
    sbProgram.programId
  );
  const [escrowAccount, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
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
    gillClient,
    txOpts
  );

  await ensureEscrowFunded(gillClient, escrowAccount, keypair, sbProgram, txOpts);

  console.log("\nCommit to randomness...");
  const commitIx = await retryCommitRandomness(randomness, queue);
  const coinFlipIx = await createCoinFlipInstruction(
    myProgram,
    rngKp.publicKey,
    userGuess,
    playerStateAccount,
    keypair,
    escrowAccount
  );

  const sig4 = await handleTransaction(
    sbProgram,
    gillClient,
    [commitIx, coinFlipIx],
    keypair,
    [keypair],
    { ...txOpts, commitment: COMMITMENT }
  );
  console.log("  Transaction Signature commitTx", sig4);

  console.log("\nReveal the randomness...");
  console.log("Waiting 3 seconds before attempting reveal...");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const revealIx = await retryRevealRandomness(randomness);
  const settleFlipIx = await settleFlipInstruction(
    myProgram,
    escrowBump,
    playerStateAccount,
    rngKp.publicKey,
    escrowAccount,
    keypair
  );

  const sig5 = await handleTransaction(
    sbProgram,
    gillClient,
    [revealIx, settleFlipIx],
    keypair,
    [keypair],
    { ...txOpts, commitment: COMMITMENT }
  );
  console.log("  Transaction Signature revealTx", sig5);

  const answer = await anchorConnection.getParsedTransaction(sig5, {
    maxSupportedTransactionVersion: 0,
  });
  const resultLog = answer?.meta?.logMessages?.find((line) =>
    line.includes("FLIP_RESULT")
  );
  const result = resultLog?.split(": ")[2];

  console.log("\nYour guess is ", userGuess ? "Heads" : "Tails");
  console.log(`\nAnd the random result is ... ${result}!`);
  console.log("\nGame completed!");
  process.exit(0);
})();
