// Set up axios timeout override BEFORE importing Switchboard modules
import axios from "axios";

// Override axios.create to ensure all instances use 7-second timeout
const originalCreate = axios.create;
axios.create = function (config = {}) {
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
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { initializeGame, loadSbProgram } from "./utils.ts";
import { setupQueue } from "./utils.ts";
import { getUserGuessFromCommandLine } from "./utils.ts";
import { initializeMyProgram } from "./utils.ts";
import { createCoinFlipInstruction } from "./utils.ts";
import { settleFlipInstruction } from "./utils.ts";
import { ensureEscrowFunded } from "./utils.ts";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RANDOMNESS_KEYPAIR_PATH = path.join(__dirname, "randomness-keypair.json");
const RUN_ID = `coinflip-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const UNKNOWN_FAILURES_DIR = path.join(__dirname, "..", "unknown-failures");
const RUNS_DIR = path.join(__dirname, "..", "runs");
const LATENCY_LOG_PATH = path.join(RUNS_DIR, "latencies.jsonl");
const ORACLE_OVERRIDE = process.env.ORACLE_OVERRIDE;

type UnknownFailureEvent = {
  stage: string;
  timestamp: string;
  rpcEndpoint?: string;
  programId?: string;
  oracle?: string;
  gatewayUrl?: string;
  error: {
    message: string;
    name?: string;
    stack?: string;
    cause?: string;
    code?: string;
    axios?: {
      message?: string;
      code?: string;
      status?: number;
      url?: string;
      method?: string;
      timeout?: number;
      data?: unknown;
    };
  };
  extra?: Record<string, unknown>;
};

let connectionRef: Connection | undefined;
let programRef: anchor.Program | undefined;
let selectedOracleRef: PublicKey | undefined;
let selectedGatewayUrlRef: string | undefined;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractAxiosDetails(error: any) {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const config = error.config ?? {};
  const response = error.response;
  return {
    message: error.message,
    code: error.code,
    status: response?.status,
    url: config?.baseURL ? `${config.baseURL}${config.url ?? ""}` : config?.url,
    method: config?.method,
    timeout: config?.timeout,
    data: response?.data,
  };
}

function serializeError(error: any) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause ? String(error.cause) : undefined,
      code: (error as any).code,
      axios: extractAxiosDetails(error),
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function buildContext(extra?: Record<string, unknown>) {
  return {
    rpcEndpoint:
      connectionRef?.rpcEndpoint ?? process.env.ANCHOR_PROVIDER_URL,
    programId: programRef?.programId?.toString(),
    oracle: selectedOracleRef?.toString(),
    gatewayUrl: selectedGatewayUrlRef,
    ...extra,
  };
}

function recordUnknownFailure(
  stage: string,
  error: any,
  extra?: Record<string, unknown>
) {
  ensureDir(UNKNOWN_FAILURES_DIR);
  const failurePath = path.join(UNKNOWN_FAILURES_DIR, `${RUN_ID}.json`);
  const payload: { runId: string; events: UnknownFailureEvent[] } =
    fs.existsSync(failurePath)
      ? JSON.parse(fs.readFileSync(failurePath, "utf8"))
      : { runId: RUN_ID, events: [] };

  payload.events.push({
    stage,
    timestamp: new Date().toISOString(),
    ...buildContext(extra),
    error: serializeError(error),
  });

  fs.writeFileSync(failurePath, JSON.stringify(payload, null, 2));
}

function appendLatencyRecord(record: Record<string, unknown>) {
  ensureDir(RUNS_DIR);
  fs.appendFileSync(LATENCY_LOG_PATH, `${JSON.stringify(record)}\n`);
}

function failAndExit(
  stage: string,
  error: any,
  extra?: Record<string, unknown>
) {
  recordUnknownFailure(stage, error, extra);
  appendLatencyRecord({
    runId: RUN_ID,
    status: "failed",
    stage,
    ...buildContext(extra),
    error: serializeError(error),
    timestamp: new Date().toISOString(),
  });
  console.error(`[${RUN_ID}] Stage failed: ${stage}`, error);
  process.exit(1);
}

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  recordUnknownFailure("unhandledRejection", error);
  console.error(`[${RUN_ID}] Unhandled rejection`, error);
  process.exit(1);
});

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function selectHealthyOracle(
  sbProgram: anchor.Program,
  queuePubkey: PublicKey
): Promise<{ oracle: PublicKey; gatewayUrl: string; override: boolean }> {
  const queueAccount = new sb.Queue(sbProgram, queuePubkey);
  const oracleKeys = await queueAccount.fetchOracleKeys();
  if (!oracleKeys.length) {
    throw new Error("No oracles found on queue");
  }

  if (ORACLE_OVERRIDE) {
    const overrideKey = new PublicKey(ORACLE_OVERRIDE);
    const oracle = new sb.Oracle(sbProgram, overrideKey);
    const oracleData = await oracle.loadData();
    const gatewayUrl = String.fromCharCode(...oracleData.gatewayUri).replace(
      /\0+$/,
      ""
    );
    const healthUrl = `${gatewayUrl.replace(/\/+$/, "")}/gateway/api/v1/test`;
    try {
      const response = await axios.get(healthUrl, {
        timeout: 2000,
        validateStatus: () => true,
      });
      console.log(`[${RUN_ID}] Oracle override health check`, {
        oracle: overrideKey.toString(),
        gatewayUrl,
        status: response.status,
      });
    } catch (err: any) {
      console.log(`[${RUN_ID}] Oracle override health check failed`, {
        oracle: overrideKey.toString(),
        gatewayUrl,
        reason: err?.message ?? err,
      });
    }
    return { oracle: overrideKey, gatewayUrl, override: true };
  }

  const shuffled = shuffle(oracleKeys);
  const failures: Array<{ oracle: string; gatewayUrl?: string; reason: string }> =
    [];

  for (const oracleKey of shuffled) {
    try {
      const oracle = new sb.Oracle(sbProgram, oracleKey);
      const oracleData = await oracle.loadData();
      const gatewayUrl = String.fromCharCode(...oracleData.gatewayUri).replace(
        /\0+$/,
        ""
      );
      if (!gatewayUrl) {
        const reason = "missing gateway url";
        console.log(`[${RUN_ID}] Oracle health failed`, {
          oracle: oracleKey.toString(),
          reason,
        });
        failures.push({
          oracle: oracleKey.toString(),
          reason,
        });
        continue;
      }

      const healthUrl = `${gatewayUrl.replace(/\/+$/, "")}/gateway/api/v1/test`;
      const response = await axios.get(healthUrl, {
        timeout: 2000,
        validateStatus: () => true,
      });
      if (response.status >= 200 && response.status < 300) {
        console.log(`[${RUN_ID}] Selected healthy oracle`, {
          oracle: oracleKey.toString(),
          gatewayUrl,
          healthStatus: response.status,
        });
        return { oracle: oracleKey, gatewayUrl, override: false };
      }

      const reason = `health status ${response.status}`;
      console.log(`[${RUN_ID}] Oracle health failed`, {
        oracle: oracleKey.toString(),
        gatewayUrl,
        reason,
      });
      failures.push({
        oracle: oracleKey.toString(),
        gatewayUrl,
        reason,
      });
    } catch (err: any) {
      const reason = err?.code ? `${err.code}` : err?.message ?? "health check error";
      console.log(`[${RUN_ID}] Oracle health failed`, {
        oracle: oracleKey.toString(),
        reason,
      });
      failures.push({
        oracle: oracleKey.toString(),
        gatewayUrl: err?.config?.url,
        reason,
      });
    }
  }

  console.log(`[${RUN_ID}] No healthy oracle found`, failures.slice(0, 5));
  throw new Error("No healthy oracle found on queue");
}

async function retryCommitRandomness(
  randomness: sb.Randomness,
  queue: any,
  oracleOverride?: PublicKey,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<anchor.web3.TransactionInstruction> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[${RUN_ID}] Attempting to commit randomness (attempt ${attempt}/${maxRetries})...`
      );
      const commitIx = await randomness.commitIx(queue, undefined, oracleOverride);
      console.log(`[${RUN_ID}] Successfully obtained commit instruction`);
      return commitIx;
    } catch (error: any) {
      console.log(
        `[${RUN_ID}] Commit attempt ${attempt} failed:`,
        error?.message ?? error
      );

      if (attempt === maxRetries) {
        console.error(
          `[${RUN_ID}] All commit attempts failed. The Switchboard gateway may be experiencing issues.`
        );
        throw error;
      }

      console.log(`[${RUN_ID}] Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);

      // Increase delay for next attempt
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
      console.log(
        `[${RUN_ID}] Attempting to reveal randomness (attempt ${attempt}/${maxRetries})...`
      );
      const revealIx = await randomness.revealIx();
      console.log(`[${RUN_ID}] Successfully obtained reveal instruction`);
      return revealIx;
    } catch (error: any) {
      console.log(
        `[${RUN_ID}] Reveal attempt ${attempt} failed:`,
        error?.message ?? error
      );

      if (attempt === maxRetries) {
        console.error(
          `[${RUN_ID}] All reveal attempts failed. The Switchboard gateway may be experiencing issues.`
        );
        throw error;
      }

      console.log(`[${RUN_ID}] Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * 1.5, 10000);
    }
  }

  throw new Error("Should not reach here");
}

async function loadOrCreateRandomnessAccount(
  sbProgram: anchor.Program,
  queue: any
): Promise<{
  randomness: sb.Randomness;
  rngKp: Keypair;
  createIx?: anchor.web3.TransactionInstruction;
}> {
  let rngKp: Keypair;
  let createIx: anchor.web3.TransactionInstruction | undefined;

  if (fs.existsSync(RANDOMNESS_KEYPAIR_PATH)) {
    console.log("Loading existing randomness account...");
    const keypairData = JSON.parse(
      fs.readFileSync(RANDOMNESS_KEYPAIR_PATH, "utf8")
    );
    rngKp = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log("Loaded randomness account", rngKp.publicKey.toString());

    const randomness = new sb.Randomness(sbProgram, rngKp.publicKey);
    return { randomness, rngKp };
  }

  console.log("Creating new randomness account...");
  rngKp = Keypair.generate();

  fs.writeFileSync(
    RANDOMNESS_KEYPAIR_PATH,
    JSON.stringify(Array.from(rngKp.secretKey))
  );
  console.log("Saved randomness keypair to", RANDOMNESS_KEYPAIR_PATH);

  const [randomness, ix] = await sb.Randomness.create(sbProgram, rngKp, queue);
  console.log("Created randomness account", randomness.pubkey.toString());

  return { randomness, rngKp, createIx: ix };
}

(async function main() {
  console.clear();
  console.log(`[${RUN_ID}] Starting coin flip run`);

  let keypair: Keypair;
  let connection: Connection;
  let program: anchor.Program;
  let queue: PublicKey;
  let myProgram: anchor.Program;
  let sbProgram: anchor.Program;
  let commitSig: string | undefined;
  let revealSig: string | undefined;
  let commitBlockTime: number | null = null;
  let revealBlockTime: number | null = null;

  try {
    const env = await sb.AnchorUtils.loadEnv();
    keypair = env.keypair;
    connection = env.connection;
    program = env.program!;
  } catch (err) {
    failAndExit("loadEnv", err);
    return;
  }

  connectionRef = connection!;
  programRef = program!;

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
  console.log(`[${RUN_ID}] Program`, program!.programId.toString());
  const userGuess = getUserGuessFromCommandLine();

  try {
    queue = await setupQueue(program!);
  } catch (err) {
    failAndExit("setupQueue", err);
    return;
  }

  try {
    myProgram = await initializeMyProgram(program!.provider);
  } catch (err) {
    failAndExit("initializeMyProgram", err);
    return;
  }

  try {
    sbProgram = await loadSbProgram(program!.provider);
  } catch (err) {
    failAndExit("loadSbProgram", err);
    return;
  }

  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: false,
    maxRetries: 0,
  };

  let randomness: sb.Randomness;
  let rngKp: Keypair;
  let createIx: anchor.web3.TransactionInstruction | undefined;

  try {
    ({ randomness, rngKp, createIx } = await loadOrCreateRandomnessAccount(
      sbProgram,
      queue
    ));
  } catch (err) {
    failAndExit("loadOrCreateRandomnessAccount", err);
    return;
  }

  if (createIx) {
    try {
      const createRandomnessTx = await sb.asV0Tx({
        connection: sbProgram.provider.connection,
        ixs: [createIx],
        payer: keypair.publicKey,
        signers: [keypair, rngKp],
        computeUnitPrice: 75_000,
        computeUnitLimitMultiple: 1.3,
      });

      const sim = await connection.simulateTransaction(
        createRandomnessTx,
        txOpts
      );
      const sig1 = await connection.sendTransaction(createRandomnessTx, txOpts);
      await connection.confirmTransaction(sig1, "finalized");
      console.log(
        "  Transaction Signature for randomness account creation: ",
        sig1
      );
    } catch (err) {
      failAndExit("createRandomnessAccount", err);
      return;
    }
  } else {
    console.log(
      "Reusing existing randomness account:",
      randomness.pubkey.toString()
    );
  }

  const playerStateAccount = await PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), keypair.publicKey.toBuffer()],
    sbProgram.programId
  );
  const [escrowAccount, escrowBump] = await PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED)],
    myProgram.programId
  );
  console.log("\nInitialize the game states...");
  try {
    await initializeGame(
      myProgram,
      playerStateAccount,
      escrowAccount,
      keypair,
      sbProgram,
      connection
    );
  } catch (err) {
    failAndExit("initializeGame", err);
    return;
  }

  try {
    await ensureEscrowFunded(
      connection,
      escrowAccount,
      keypair,
      sbProgram,
      txOpts
    );
  } catch (err) {
    failAndExit("ensureEscrowFunded", err);
    return;
  }

  console.log("\nCommit to randomness...");
  console.log(`[${RUN_ID}] Waiting 2 seconds before commit...`);
  await sleep(2000);

  let oracleInfo: { oracle: PublicKey; gatewayUrl: string; override: boolean };
  try {
    oracleInfo = await selectHealthyOracle(sbProgram, queue);
  } catch (err) {
    failAndExit("selectHealthyOracle", err);
    return;
  }
  selectedOracleRef = oracleInfo.oracle;
  selectedGatewayUrlRef = oracleInfo.gatewayUrl;
  if (oracleInfo.override) {
    console.log(`[${RUN_ID}] Using oracle override`, {
      oracle: oracleInfo.oracle.toString(),
      gatewayUrl: oracleInfo.gatewayUrl,
    });
  }

  let commitIx: anchor.web3.TransactionInstruction;
  try {
    commitIx = await retryCommitRandomness(randomness, queue, oracleInfo.oracle);
  } catch (err) {
    failAndExit("commitRandomness", err);
    return;
  }

  const coinFlipIx = await createCoinFlipInstruction(
    myProgram,
    rngKp.publicKey,
    userGuess,
    playerStateAccount,
    keypair,
    escrowAccount
  );

  try {
    const commitTx = await sb.asV0Tx({
      connection: sbProgram.provider.connection,
      ixs: [commitIx, coinFlipIx],
      payer: keypair.publicKey,
      signers: [keypair],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const sim4 = await connection.simulateTransaction(commitTx, txOpts);
    commitSig = await connection.sendTransaction(commitTx, txOpts);
    await connection.confirmTransaction(commitSig, COMMITMENT);
    console.log(`[${RUN_ID}] Transaction Signature commitTx`, commitSig);
  } catch (err) {
    failAndExit("commitTransaction", err, { commitSig });
    return;
  }

  try {
    const commitInfo = await connection.getParsedTransaction(commitSig!, {
      maxSupportedTransactionVersion: 0,
    });
    commitBlockTime = commitInfo?.blockTime ?? null;
  } catch (err) {
    recordUnknownFailure("commitBlockTime", err, { commitSig });
  }

  console.log("\nReveal the randomness...");
  console.log(`[${RUN_ID}] Waiting 5 seconds before attempting reveal...`);
  await sleep(5000);

  let revealIx: anchor.web3.TransactionInstruction;
  try {
    revealIx = await retryRevealRandomness(randomness);
  } catch (err) {
    failAndExit("revealRandomness", err, { commitSig });
    return;
  }

  const settleFlipIx = await settleFlipInstruction(
    myProgram,
    escrowBump,
    playerStateAccount,
    rngKp.publicKey,
    escrowAccount,
    keypair
  );

  try {
    const revealTx = await sb.asV0Tx({
      connection: sbProgram.provider.connection,
      ixs: [revealIx, settleFlipIx],
      payer: keypair.publicKey,
      signers: [keypair],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const sim5 = await connection.simulateTransaction(revealTx, txOpts);
    revealSig = await connection.sendTransaction(revealTx, txOpts);
    await connection.confirmTransaction(revealSig, COMMITMENT);
    console.log(`[${RUN_ID}] Transaction Signature revealTx`, revealSig);
  } catch (err) {
    failAndExit("revealTransaction", err, { commitSig, revealSig });
    return;
  }

  try {
    const revealInfo = await connection.getParsedTransaction(revealSig!, {
      maxSupportedTransactionVersion: 0,
    });
    revealBlockTime = revealInfo?.blockTime ?? null;
  } catch (err) {
    recordUnknownFailure("revealBlockTime", err, { commitSig, revealSig });
  }

  const latencySeconds =
    commitBlockTime != null && revealBlockTime != null
      ? revealBlockTime - commitBlockTime
      : null;

  appendLatencyRecord({
    runId: RUN_ID,
    status: "success",
    commitSig,
    revealSig,
    commitBlockTime,
    revealBlockTime,
    latencySeconds,
    oracle: selectedOracleRef?.toString(),
    gatewayUrl: selectedGatewayUrlRef,
    oracleOverride: ORACLE_OVERRIDE ?? undefined,
    timestamp: new Date().toISOString(),
  });

  const answer = await connection.getParsedTransaction(revealSig!, {
    maxSupportedTransactionVersion: 0,
  });
  const resultLog = answer?.meta?.logMessages?.filter((line) =>
    line.includes("FLIP_RESULT")
  )[0];
  const result = resultLog?.split(": ")[2];

  console.log("\nYour guess is ", userGuess ? "Heads" : "Tails");
  console.log(`\nAnd the random result is ... ${result}!`);
  console.log("\nGame completed!");
  process.exit(0);
})();
