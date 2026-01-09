import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";

const COMMITMENT = "confirmed";

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = myProgramKeypair.publicKey;
  const idl = (await anchor.Program.fetchIdl(pid, provider))!;
  if (idl == null) {
    throw new Error(`IDL not found for the program at ${pid.toString()}`);
  }
  if (idl?.address == undefined || idl?.address == null) {
    idl.address = pid.toString();
  }
  const program = new anchor.Program(idl, provider);
  return program;
}

export async function loadSbProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  const sbProgramId = await sb.getProgramId(provider.connection);
  const sbIdl = await anchor.Program.fetchIdl(sbProgramId, provider);
  const sbProgram = new anchor.Program(sbIdl!, provider);
  return sbProgram;
}

export async function initializePancakeStackerProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  const myProgramPath = "../target/deploy/pancake_stacker-keypair.json";
  const myProgram = await myAnchorProgram(provider, myProgramPath);
  console.log("Pancake Stacker program", myProgram.programId.toString());
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
    throw new Error("Queue not found, ensure you are using devnet in your env");
  }
  return queueAccount.pubkey;
}

/**
 * Creates, simulates, sends, and confirms a transaction.
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

export async function initializePlayer(
  myProgram: anchor.Program,
  playerStateAccount: [anchor.web3.PublicKey, number],
  keypair: Keypair,
  sbProgram: anchor.Program,
  connection: Connection
): Promise<void> {
  const initIx = await myProgram.methods
    .initialize()
    .accounts({
      playerState: playerStateAccount[0],
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

/**
 * Creates the flip pancake instruction
 */
export async function createFlipPancakeInstruction(
  myProgram: anchor.Program,
  rngKpPublicKey: PublicKey,
  playerStateAccount: [anchor.web3.PublicKey, number],
  keypair: Keypair
): Promise<anchor.web3.TransactionInstruction> {
  return await myProgram.methods
    .flipPancake(rngKpPublicKey)
    .accounts({
      playerState: playerStateAccount[0],
      user: keypair.publicKey,
      randomnessAccountData: rngKpPublicKey,
      authority: keypair.publicKey,
    })
    .instruction();
}

/**
 * Creates the catch pancake instruction
 */
export async function createCatchPancakeInstruction(
  myProgram: anchor.Program,
  playerStateAccount: [anchor.web3.PublicKey, number],
  rngKpPublicKey: PublicKey,
  keypair: Keypair
): Promise<anchor.web3.TransactionInstruction> {
  return await myProgram.methods
    .catchPancake()
    .accounts({
      playerState: playerStateAccount[0],
      randomnessAccountData: rngKpPublicKey,
      user: keypair.publicKey,
    })
    .instruction();
}

/**
 * Fetch player stats from the program
 */
export async function getPlayerStats(
  myProgram: anchor.Program,
  playerStateAccount: PublicKey
): Promise<{ stackHeight: number; hasPendingFlip: boolean } | null> {
  try {
    const state = await myProgram.account.playerState.fetch(playerStateAccount);
    return {
      stackHeight: (state.stackHeight as anchor.BN).toNumber(),
      hasPendingFlip: state.hasPendingFlip as boolean,
    };
  } catch (e) {
    return null;
  }
}
