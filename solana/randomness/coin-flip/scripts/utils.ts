import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import yargs from "yargs";
import * as reader from "readline-sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const COMMITMENT = "confirmed";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchIdlWithRetry(
  programId: PublicKey,
  provider: anchor.Provider,
  label: string,
  attempts: number = 3,
  delayMs: number = 500
): Promise<anchor.Idl | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const idl = await anchor.Program.fetchIdl(programId, provider);
      if (idl) {
        return idl;
      }
      lastError = new Error(`IDL not found for ${label}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < attempts) {
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 4000);
    }
  }

  if (lastError) {
    console.warn(`Failed to fetch IDL for ${label} after ${attempts} attempts`, lastError);
  }
  return null;
}

function loadLocalIdl(idlPath: string, programId: PublicKey, label: string): anchor.Idl {
  if (!fs.existsSync(idlPath)) {
    throw new Error(`Local IDL not found for ${label} at ${idlPath}`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const anyIdl = idl as anchor.Idl & {
    accounts?: Array<{ name: string; type?: unknown }>;
    types?: Array<{ name: string; type: unknown }>;
  };
  if (Array.isArray(anyIdl.accounts) && Array.isArray(anyIdl.types)) {
    const typeMap = new Map(anyIdl.types.map((t) => [t.name, t.type]));
    for (const account of anyIdl.accounts) {
      if (!account.type && typeMap.has(account.name)) {
        account.type = typeMap.get(account.name);
      }
    }
  }
  if (!idl.address) {
    (idl as anchor.Idl & { address?: string }).address = programId.toString();
  }
  return idl;
}

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = myProgramKeypair.publicKey;
  let idl = await fetchIdlWithRetry(pid, provider, "coin-flip program");
  if (!idl) {
    const localIdlPath = path.join(__dirname, "../target/idl/sb_randomness.json");
    console.warn(`Falling back to local IDL at ${localIdlPath}`);
    idl = loadLocalIdl(localIdlPath, pid, "coin-flip program");
  }
  if (!idl.address) {
    (idl as anchor.Idl & { address?: string }).address = pid.toString();
  }
  return new anchor.Program(idl, provider);
}

export async function loadSbProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  const sbProgramId = await sb.getProgramId(provider.connection);
  const sbIdl = await fetchIdlWithRetry(
    sbProgramId,
    provider,
    "Switchboard On-Demand program"
  );
  if (!sbIdl) {
    throw new Error("Failed to fetch Switchboard On-Demand IDL after retries.");
  }
  if (!sbIdl.address) {
    (sbIdl as anchor.Idl & { address?: string }).address = sbProgramId.toString();
  }
  return new anchor.Program(sbIdl, provider);
}

// export async function loadSVMSwitchboardProgram(
// provider: anchor.Provider
// ): Promise<anchor.Program> {
// const svmProgramId = sb.ON_DEMAND_MAINNET_PID;
// const svmIdl = await anchor.Program.fetchIdl(svmProgramId, provider);
// const svmProgram = new anchor.Program(svmIdl!, provider);
// return svmProgram;
// }

export async function initializeMyProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  const overrideProgramId = process.env.COIN_FLIP_PROGRAM_ID;
  if (overrideProgramId) {
    const pid = new PublicKey(overrideProgramId);
    let idl = await fetchIdlWithRetry(pid, provider, "coin-flip program");
    if (!idl) {
      const localIdlPath = path.join(__dirname, "../target/idl/sb_randomness.json");
      console.warn(`Falling back to local IDL at ${localIdlPath}`);
      idl = loadLocalIdl(localIdlPath, pid, "coin-flip program");
    }
    if (!idl.address) {
      (idl as anchor.Idl & { address?: string }).address = pid.toString();
    }
    const program = new anchor.Program(idl, provider);
    console.log("My program", program.programId.toString());
    return program;
  }

  const myProgramPath = path.join(
    __dirname,
    "../target/deploy/sb_randomness-keypair.json"
  );
  const myProgram = await myAnchorProgram(provider, myProgramPath);
  console.log("My program", myProgram.programId.toString());
  return myProgram;
}

export async function setupQueue(program: anchor.Program): Promise<PublicKey> {
  const queueAccount = await sb.getDefaultQueue(
    program.provider.connection.rpcEndpoint
  );
  console.log("Queue account", queueAccount.pubkey.toString());
  try {
    await queueAccount.loadData();
  } catch (err) {
    throw new Error(
      "Queue not found, ensure you are using devnet in your env"
    );
  }
  return queueAccount.pubkey;
}

export async function setupSVMQueue(
  program: anchor.Program,
  queue: PublicKey
): Promise<PublicKey> {
  const queuePDA = sb.Queue.queuePDA(program, queue);
  console.log("Queue:", queuePDA.toString());
  return queuePDA;
}

export function getUserGuessFromCommandLine(): boolean {
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

/**
 * Creates, simulates, sends, and confirms a transaction.
 * @param sbProgram - The Switchboard program.
 * @param connection - The Solana connection object.
 * @param ix - The instruction array for the transaction.
 * @param keypair - The keypair of the payer.
 * @param signers - The array of signers for the transaction.
 * @param txOpts - The transaction options.
 * @returns The transaction signature.
 */
export async function handleTransaction(
  sbProgram: anchor.Program,
  connection: Connection,
  ix: anchor.web3.TransactionInstruction[],
  keypair: Keypair,
  signers: Keypair[],
  txOpts: any
): Promise<string> {
  const createTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: ix,
    payer: keypair.publicKey,
    signers: signers,
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  const sim = await connection.simulateTransaction(createTx, txOpts);
  const sig = await connection.sendTransaction(createTx, txOpts);
  await connection.confirmTransaction(sig, COMMITMENT);
  console.log("  Transaction Signature", sig);
  return sig;
}

export async function initializeGame(
  myProgram: anchor.Program,
  playerStateAccount: [anchor.web3.PublicKey, number],
  escrowAccount: PublicKey,
  keypair: Keypair,
  sbProgram: anchor.Program,
  connection: Connection
): Promise<void> {
  const initIx = await myProgram.methods
    .initialize()
    .accounts({
      playerState: playerStateAccount,
      escrowAccount: escrowAccount,
      user: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };
  await handleTransaction(
    sbProgram,
    connection,
    [initIx],
    keypair,
    [keypair],
    txOpts
  );
}

export /**
 * Creates the coin flip instruction for the given program.
 * @param myProgram - The Anchor program.
 * @param rngKpPublicKey - The public key of the randomness keypair.
 * @param userGuess - The user's guess (heads or tails).
 * @param playerStateAccount - The player's state account public key.
 * @param keypair - The keypair of the user.
 * @param escrowAccount - The escrow account public key.
 * @returns The coin flip instruction.
 */
async function createCoinFlipInstruction(
  myProgram: anchor.Program,
  rngKpPublicKey: PublicKey,
  userGuess: boolean,
  playerStateAccount: [anchor.web3.PublicKey, number],
  keypair: Keypair,
  escrowAccount: PublicKey
): Promise<anchor.web3.TransactionInstruction> {
  return await myProgram.methods
    .coinFlip(rngKpPublicKey, userGuess)
    .accounts({
      playerState: playerStateAccount,
      user: keypair.publicKey,
      randomnessAccountData: rngKpPublicKey,
      escrowAccount: escrowAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Creates the settle flip instruction for the given program.
 * @param myProgram - The Anchor program.
 * @param escrowBump - The bump seed for the escrow account.
 * @param playerStateAccount - The player's state account public key.
 * @param rngKpPublicKey - The public key of the randomness keypair.
 * @param escrowAccount - The escrow account public key.
 * @param keypair - The keypair of the user.
 * @returns The settle flip instruction.
 */
export async function settleFlipInstruction(
  myProgram: anchor.Program,
  escrowBump: number,
  playerStateAccount: [anchor.web3.PublicKey, number],
  rngKpPublicKey: PublicKey,
  escrowAccount: PublicKey,
  keypair: Keypair
): Promise<anchor.web3.TransactionInstruction> {
  return await myProgram.methods
    .settleFlip(escrowBump)
    .accounts({
      playerState: playerStateAccount,
      randomnessAccountData: rngKpPublicKey,
      escrowAccount: escrowAccount,
      user: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ensureEscrowFunded(
  connection: Connection,
  escrowAccount: PublicKey,
  keypair: Keypair,
  sbProgram: anchor.Program,
  txOpts: any
): Promise<void> {
  const accountBalance = await connection.getBalance(escrowAccount);
  const minRentExemption = await connection.getMinimumBalanceForRentExemption(
    0
  );

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
    console.log("  Transaction Signature ", sig3);
  } else {
    console.log("  Escrow account funded already");
  }
}
