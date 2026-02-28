// Set up axios logging + timeout override BEFORE importing Switchboard modules
import axios from "axios";

let RUN_ID = "";
let axiosRequestCounter = 0;
const AXIOS_LOGGING_ATTACHED = Symbol("sbAxiosLogging");

function buildFullUrl(config: any): string {
  if (!config) {
    return "";
  }
  const base = config.baseURL ?? "";
  const url = config.url ?? "";
  if (typeof url === "string" && url.startsWith("http")) {
    return url;
  }
  if (!base) {
    return url;
  }
  if (base.endsWith("/") && url.startsWith("/")) {
    return `${base}${url.slice(1)}`;
  }
  return `${base}${url}`;
}

function isGatewayRequest(config: any): boolean {
  const fullUrl = buildFullUrl(config);
  return fullUrl.includes("/gateway/api/");
}

function truncate(value: unknown, maxLen = 500): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const str =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen)}…(${str.length} chars)`;
}

function formatAxiosError(err: any) {
  return {
    message: err?.message ?? String(err),
    code: err?.code,
    status: err?.response?.status,
    url: buildFullUrl(err?.config),
    data: truncate(err?.response?.data),
  };
}

function attachAxiosLogging(instance: any, label: string) {
  if (instance?.[AXIOS_LOGGING_ATTACHED]) {
    return;
  }
  instance[AXIOS_LOGGING_ATTACHED] = true;

  instance.interceptors.request.use((config: any) => {
    const requestId = `${RUN_ID}-${++axiosRequestCounter}`;
    config.__sbRequestId = requestId;
    config.__sbStart = Date.now();

    if (isGatewayRequest(config)) {
      console.log(`[${RUN_ID}] [gateway:req] ${requestId}`, {
        label,
        method: config.method,
        url: buildFullUrl(config),
        timeout: config.timeout,
        data: truncate(config.data),
      });
    }
    return config;
  });

  instance.interceptors.response.use(
    (resp: any) => {
      if (isGatewayRequest(resp?.config)) {
        const ms = Date.now() - (resp.config.__sbStart ?? Date.now());
        console.log(`[${RUN_ID}] [gateway:res] ${resp.config.__sbRequestId}`, {
          status: resp.status,
          ms,
          url: buildFullUrl(resp.config),
        });
      }
      return resp;
    },
    (err: any) => {
      const config = err?.config;
      if (isGatewayRequest(config)) {
        const ms = Date.now() - (config?.__sbStart ?? Date.now());
        console.log(
          `[${RUN_ID}] [gateway:err] ${config?.__sbRequestId ?? "unknown"}`,
          {
            ms,
            ...formatAxiosError(err),
          }
        );
      }
      throw err;
    }
  );
}

// Override axios.create to ensure all instances use 7-second timeout
const originalCreate = axios.create;
axios.create = function (config = {}) {
  const instance = originalCreate({
    timeout: 7000, // 7 seconds
    ...config,
  });
  attachAxiosLogging(instance, "axios.create");
  return instance;
};

// Also set global default + attach logging
axios.defaults.timeout = 7000;
attachAxiosLogging(axios, "axios.default");

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { accountExists, initializeGame } from "./utils.ts";
import { setupQueue } from "./utils.ts";
import { getUserGuessFromCommandLine } from "./utils.ts";
import { initializeMyProgram } from "./utils.ts";
import { createCoinFlipInstruction } from "./utils.ts";
import { settleFlipInstruction } from "./utils.ts";
import { ensureEscrowFunded } from "./utils.ts";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RANDOMNESS_KEYPAIR_PATH = path.join(__dirname, "randomness-keypair.json");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGatewayError(error: any): boolean {
  const retryableCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "EPIPE",
  ]);
  if (error?.code && retryableCodes.has(error.code)) {
    return true;
  }
  const status = error?.response?.status;
  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  return false;
}

async function logGatewayDiagnostics(
  sbProgram: anchor.Program,
  randomness: sb.Randomness
): Promise<void> {
  try {
    const data = await randomness.loadData();
    console.log(`[${RUN_ID}] Randomness account`, randomness.pubkey.toString());
    console.log(`[${RUN_ID}] Randomness data`, {
      queue: data.queue.toString(),
      oracle: data.oracle.toString(),
      seedSlot: data.seedSlot?.toNumber?.() ?? data.seedSlot,
      revealSlot: data.revealSlot?.toNumber?.() ?? data.revealSlot,
    });

    const oracle = new sb.Oracle(sbProgram, data.oracle);
    const oracleData = await oracle.loadData();
    const gatewayUrl = String.fromCharCode(...oracleData.gatewayUri).replace(
      /\0+$/,
      ""
    );
    console.log(`[${RUN_ID}] Oracle gateway URL`, gatewayUrl);

    const healthUrl = `${gatewayUrl.replace(/\/+$/, "")}/gateway/api/v1/test`;
    try {
      const start = Date.now();
      const response = await axios.get(healthUrl);
      const ms = Date.now() - start;
      console.log(`[${RUN_ID}] Gateway health`, {
        status: response.status,
        ms,
        data: truncate(response.data),
      });
    } catch (err: any) {
      console.log(
        `[${RUN_ID}] Gateway health check failed`,
        formatAxiosError(err)
      );
    }
  } catch (err: any) {
    console.log(
      `[${RUN_ID}] Failed to collect gateway diagnostics`,
      formatAxiosError(err)
    );
  }
}

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
): Promise<{ oracle: PublicKey; gatewayUrl: string }> {
  const queueAccount = new sb.Queue(sbProgram, queuePubkey);
  const oracleKeys = await queueAccount.fetchOracleKeys();
  if (!oracleKeys.length) {
    throw new Error("No oracles found on queue");
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
        failures.push({
          oracle: oracleKey.toString(),
          reason: "missing gateway url",
        });
        continue;
      }

      const healthUrl = `${gatewayUrl.replace(/\/+$/, "")}/gateway/api/v1/test`;
      const start = Date.now();
      const response = await axios.get(healthUrl);
      const ms = Date.now() - start;
      if (response.status >= 200 && response.status < 300) {
        console.log(`[${RUN_ID}] Selected healthy oracle`, {
          oracle: oracleKey.toString(),
          gatewayUrl,
          healthMs: ms,
        });
        return { oracle: oracleKey, gatewayUrl };
      }

      failures.push({
        oracle: oracleKey.toString(),
        gatewayUrl,
        reason: `health status ${response.status}`,
      });
    } catch (err: any) {
      failures.push({
        oracle: oracleKey.toString(),
        gatewayUrl: err?.config ? buildFullUrl(err.config) : undefined,
        reason: err?.message ?? "health check error",
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
      const retryable = isRetryableGatewayError(error);
      console.log(
        `[${RUN_ID}] Commit attempt ${attempt} failed`,
        {
          retryable,
          ...formatAxiosError(error),
        }
      );

      if (!retryable || attempt === maxRetries) {
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

async function retryRevealRandomness(randomness: sb.Randomness, maxRetries: number = 5, delayMs: number = 2000): Promise<anchor.web3.TransactionInstruction> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[${RUN_ID}] Attempting to reveal randomness (attempt ${attempt}/${maxRetries})...`
      );
      const revealIx = await randomness.revealIx();
      console.log(`[${RUN_ID}] Successfully obtained reveal instruction`);
      return revealIx;
    } catch (error: any) {
      const retryable = isRetryableGatewayError(error);
      console.log(
        `[${RUN_ID}] Reveal attempt ${attempt} failed`,
        {
          retryable,
          ...formatAxiosError(error),
        }
      );

      if (!retryable || attempt === maxRetries) {
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
  queue: any,
  connection: anchor.web3.Connection
): Promise<{
  randomness: sb.Randomness;
  rngKp: Keypair;
  createIx?: anchor.web3.TransactionInstruction;
}> {
  let rngKp: Keypair;
  let createIx: anchor.web3.TransactionInstruction | undefined;

  if (fs.existsSync(RANDOMNESS_KEYPAIR_PATH)) {
    console.log("Loading existing randomness account...");
    const keypairData = JSON.parse(fs.readFileSync(RANDOMNESS_KEYPAIR_PATH, 'utf8'));
    rngKp = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log("Loaded randomness account", rngKp.publicKey.toString());

    const accountInfo = await connection.getAccountInfo(rngKp.publicKey);
    if (accountInfo) {
      const randomness = new sb.Randomness(sbProgram, rngKp.publicKey);
      return { randomness, rngKp };
    }

    console.log("Randomness account not found on chain. Recreating...");
    const [randomness, ix] = await sb.Randomness.create(sbProgram, rngKp, queue);
    return { randomness, rngKp, createIx: ix };
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

export type CoinFlipContext = {
  keypair: Keypair;
  connection: Connection;
  sbProgram: anchor.Program;
  myProgram: anchor.Program;
  queue: PublicKey;
};

export async function createCoinFlipContext(): Promise<CoinFlipContext> {
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
  const queue = await setupQueue(program!);
  const myProgram = await initializeMyProgram(program!.provider);
  return {
    keypair,
    connection,
    sbProgram: program!,
    myProgram,
    queue,
  };
}

function resolveGuess(input?: boolean | string): boolean {
  if (typeof input === "boolean") {
    return input;
  }
  if (typeof input === "string") {
    const guess = input.trim().toLowerCase();
    if (guess === "heads") return true;
    if (guess === "tails") return false;
  }
  return getUserGuessFromCommandLine();
}

export async function runCoinFlip(
  context?: CoinFlipContext,
  guessOverride?: boolean | string
) {
  RUN_ID = `coinflip-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  axiosRequestCounter = 0;
  console.clear();
  console.log(`[${RUN_ID}] Starting coin flip run`);
  const env = context ?? (await createCoinFlipContext());
  const { keypair, connection, sbProgram, myProgram, queue } = env;
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
  console.log(`[${RUN_ID}] Program`, sbProgram.programId.toString());
  const userGuess = resolveGuess(guessOverride);
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: false,
    maxRetries: 0,
  };

  // load or create randomness account
  const { randomness, rngKp, createIx } = await loadOrCreateRandomnessAccount(
    sbProgram,
    queue,
    connection
  );

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
  const playerStateExists = await accountExists(
    connection,
    playerStateAccount[0]
  );
  if (playerStateExists) {
    console.log(
      "Player state already initialized. Skipping initializeGame for",
      playerStateAccount[0].toString()
    );
  } else {
    await initializeGame(
      myProgram,
      playerStateAccount,
      escrowAccount,
      keypair,
      sbProgram,
      connection
    );
  }
  await ensureEscrowFunded(
    connection,
    escrowAccount,
    keypair,
    sbProgram,
    txOpts
  );

  // Commit to randomness Ix with retry logic
  console.log("\nCommit to randomness...");
  console.log(`[${RUN_ID}] Waiting 2 seconds before commit...`);
  await sleep(2000);
  const { oracle: healthyOracle } = await selectHealthyOracle(sbProgram, queue);
  const commitIx = await retryCommitRandomness(
    randomness,
    queue,
    healthyOracle
  );

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
    computeUnitLimitMultiple: 1.6,
  });

  const sim4 = await connection.simulateTransaction(commitTx, txOpts);
  const sig4 = await connection.sendTransaction(commitTx, txOpts);
  await connection.confirmTransaction(sig4, COMMITMENT);
  console.log(`[${RUN_ID}] Transaction Signature commitTx`, sig4);

  // Reveal the randomness Ix with retry logic
  console.log("\nReveal the randomness...");
  console.log(`[${RUN_ID}] Waiting 5 seconds before attempting reveal...`);
  await sleep(5000);
  await logGatewayDiagnostics(sbProgram, randomness);
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
    computeUnitLimitMultiple: 1.6,
  });

  const sim5 = await connection.simulateTransaction(revealTx, txOpts);
  const sig5 = await connection.sendTransaction(revealTx, txOpts);
  await connection.confirmTransaction(sig5, COMMITMENT);
  console.log(`[${RUN_ID}] Transaction Signature revealTx`, sig5);

  const answer = await connection.getParsedTransaction(sig5, {
    maxSupportedTransactionVersion: 0,
  });
  let resultLog = answer?.meta?.logMessages?.filter((line) =>
    line.includes("FLIP_RESULT")
  )[0];
  let result = resultLog?.split(": ")[2];

  console.log("\nYour guess is ", userGuess ? "Heads" : "Tails");

  console.log(`\nAnd the random result is ... ${result}!`);

  console.log("\nGame completed!");
  return {
    commitSig: sig4,
    revealSig: sig5,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCoinFlip()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
