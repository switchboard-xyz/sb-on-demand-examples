import * as anchor from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";
import * as reader from "readline-sync";
import type { SolanaClient } from "gill";
import { Buffer } from "buffer";

type GillClient = SolanaClient<string>;
type AnchorPublicKey = anchor.web3.PublicKey;
type AnchorKeypair = anchor.web3.Keypair;
const SystemProgram = anchor.web3.SystemProgram;

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = myProgramKeypair.publicKey;
  const idl = (await anchor.Program.fetchIdl(pid, provider))!;
  if (idl == null) {
    console.error("IDL not found for the program at", pid.toString());
    process.exit(1);
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

export async function initializeMyProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  const myProgramPath = "../../target/deploy/sb_randomness-keypair.json";
  const myProgram = await myAnchorProgram(provider, myProgramPath);
  console.log("My program", myProgram.programId.toString());
  return myProgram;
}

export async function setupQueue(program: anchor.Program): Promise<AnchorPublicKey> {
  const queueAccount = await sb.getDefaultQueue(
    program.provider.connection.rpcEndpoint
  );
  console.log("Queue account", queueAccount.pubkey.toString());
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found, ensure you are using devnet in your env");
    process.exit(1);
  }
  return queueAccount.pubkey;
}

export function getUserGuessFromCommandLine(): boolean {
  let userGuessInput = process.argv[2];
  if (!userGuessInput) {
    userGuessInput = reader
      .question("It is now time to make your prediction: Heads or tails... ")
      .trim()
      .toLowerCase();
  }

  const isValidGuess = userGuessInput === "heads" || userGuessInput === "tails";
  if (!isValidGuess) {
    console.error('Please provide a valid guess: "heads" or "tails".');
    process.exit(1);
  }

  return userGuessInput === "heads";
}
export async function handleTransaction(
  sbProgram: anchor.Program,
  client: GillClient,
  ix: anchor.web3.TransactionInstruction[],
  keypair: AnchorKeypair,
  signers: AnchorKeypair[],
  txOpts: anchor.web3.ConfirmOptions
): Promise<string> {
  const createTx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: ix,
    payer: keypair.publicKey,
    signers,
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });

  await simulateGillTransaction(client, createTx, txOpts);
  const sig = await sendGillTransaction(client, createTx, txOpts);
  console.log("  Transaction Signature", sig);
  return sig;
}

export async function initializeGame(
  myProgram: anchor.Program,
  playerStateAccount: [AnchorPublicKey, number],
  escrowAccount: AnchorPublicKey,
  keypair: AnchorKeypair,
  sbProgram: anchor.Program,
  client: GillClient,
  txOpts: anchor.web3.ConfirmOptions
): Promise<void> {
  const initIx = await myProgram.methods
    .initialize()
    .accounts({
      playerState: playerStateAccount,
      escrowAccount,
      user: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  await handleTransaction(
    sbProgram,
    client,
    [initIx],
    keypair,
    [keypair],
    txOpts
  );
}

export async function createCoinFlipInstruction(
  myProgram: anchor.Program,
  rngKpPublicKey: AnchorPublicKey,
  userGuess: boolean,
  playerStateAccount: [AnchorPublicKey, number],
  keypair: AnchorKeypair,
  escrowAccount: AnchorPublicKey
): Promise<anchor.web3.TransactionInstruction> {
  return await myProgram.methods
    .coinFlip(rngKpPublicKey, userGuess)
    .accounts({
      playerState: playerStateAccount,
      user: keypair.publicKey,
      randomnessAccountData: rngKpPublicKey,
      escrowAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function settleFlipInstruction(
  myProgram: anchor.Program,
  escrowBump: number,
  playerStateAccount: [AnchorPublicKey, number],
  rngKpPublicKey: AnchorPublicKey,
  escrowAccount: AnchorPublicKey,
  keypair: AnchorKeypair
): Promise<anchor.web3.TransactionInstruction> {
  return await myProgram.methods
    .settleFlip(escrowBump)
    .accounts({
      playerState: playerStateAccount,
      randomnessAccountData: rngKpPublicKey,
      escrowAccount,
      user: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ensureEscrowFunded(
  client: GillClient,
  escrowAccount: AnchorPublicKey,
  keypair: AnchorKeypair,
  sbProgram: anchor.Program,
  txOpts: anchor.web3.ConfirmOptions
): Promise<void> {
  const accountBalance = await fetchAccountBalance(client, escrowAccount, txOpts);
  const minRentResponse: any = await (client.rpc as any)
    .getMinimumBalanceForRentExemption(BigInt(0))
    .send();
  const minRentExemption = Number(
    typeof minRentResponse === "number"
      ? minRentResponse
      : minRentResponse?.value ?? minRentResponse?.result ?? minRentResponse ?? 0
  );

  if (accountBalance < minRentExemption) {
    const amountToFund = minRentExemption - accountBalance;
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

    await simulateGillTransaction(client, transferTx, txOpts);
    const sig3 = await sendGillTransaction(client, transferTx, txOpts);
    console.log("  Transaction Signature ", sig3);
  } else {
    console.log("  Escrow account funded already");
  }
}

async function fetchAccountBalance(
  client: GillClient,
  account: AnchorPublicKey,
  txOpts: anchor.web3.ConfirmOptions
): Promise<number> {
  const rpcAny = client.rpc as any;
  const balanceResponse = await rpcAny
    .getBalance(account.toBase58(), {
      commitment: txOpts.commitment ?? "processed",
    })
    .send();
  const lamports =
    balanceResponse?.value ??
    balanceResponse?.result?.value ??
    balanceResponse?.result ??
    balanceResponse ??
    0;
  return typeof lamports === "number" ? lamports : Number(lamports);
}

async function sendGillTransaction(
  client: GillClient,
  tx: anchor.web3.VersionedTransaction,
  txOpts: anchor.web3.ConfirmOptions
): Promise<string> {
  const base64Tx = Buffer.from(tx.serialize()).toString("base64");
  const rpcAny = client.rpc as any;
  const response = await rpcAny
    .sendTransaction(base64Tx, {
      encoding: "base64",
      skipPreflight: txOpts.skipPreflight ?? false,
      maxRetries: txOpts.maxRetries ?? undefined,
      preflightCommitment: txOpts.commitment ?? "processed",
    })
    .send();

  const signature =
    typeof response === "string"
      ? response
      : response?.value ?? response?.result ?? "";

  await confirmGillSignature(
    client,
    signature,
    txOpts.commitment ?? "confirmed"
  );

  return signature;
}

async function simulateGillTransaction(
  client: GillClient,
  tx: anchor.web3.VersionedTransaction,
  txOpts: anchor.web3.ConfirmOptions
) {
  const base64Tx = Buffer.from(tx.serialize()).toString("base64");
  try {
    await (client.rpc as any)
      .simulateTransaction(base64Tx, {
        encoding: "base64",
        sigVerify: false,
        commitment: txOpts.commitment ?? "processed",
        replaceRecentBlockhash: true,
      })
      .send();
  } catch (_err) {
    // ignore simulation errors and rely on send outcome
  }
}

async function confirmGillSignature(
  client: GillClient,
  signature: string,
  desiredCommitment: anchor.web3.Commitment
) {
  if (!signature) {
    throw new Error("Failed to obtain transaction signature");
  }

  const order: Record<string, number> = {
    processed: 0,
    confirmed: 1,
    finalized: 2,
  };
  const target = order[desiredCommitment ?? "confirmed"] ?? 1;

  while (true) {
    const statusResponse: any = await (client.rpc as any)
      .getSignatureStatuses([signature])
      .send();
    const statusArray = (statusResponse?.value ?? statusResponse?.result ?? []) as Array<{
      confirmationStatus?: string;
      confirmations?: number | null;
      err?: unknown;
    }>;
    const status = statusArray?.[0];

    if (status?.err) {
      throw new Error(
        `Transaction ${signature} failed: ${JSON.stringify(status.err)}`
      );
    }

    const currentLevel = status?.confirmationStatus
      ? order[status.confirmationStatus] ?? 0
      : status?.confirmations
      ? 1
      : 0;

    if (currentLevel >= target) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
