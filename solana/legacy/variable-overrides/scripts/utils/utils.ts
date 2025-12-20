import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  Commitment,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";

export const DEMO_PATH = "target/deploy/sb_on_demand_solana-keypair.json";
export const TX_CONFIG = {
  commitment: "processed" as Commitment,
  skipPreflight: true,
  maxRetries: 0,
};

export async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  try {
    const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
    const pid = myProgramKeypair.publicKey;
    const idl = (await anchor.Program.fetchIdl(pid, provider))!;
    const program = new anchor.Program(idl, provider);
    return program;
  } catch (e) {
    throw new Error("Failed to load demo program. Was it deployed?");
  }
}

export async function sendAndConfirmTx(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Array<Keypair>
): Promise<TransactionSignature> {
  tx.sign(signers);
  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/**
 * Builds an Oracle job using variable overrides instead of secrets.
 * Following security best practices from the gitbook documentation:
 * - Only use variables for API keys/authentication (✅)
 * - Hardcode all data sources, paths, and parameters (✅)
 * - Ensure feed verifiability by making data extraction deterministic (✅)
 */
export function buildVariableOverrideJob(): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          // ✅ Hardcoded endpoint and parameters - fully verifiable data source
          // Only the API key uses variable substitution for secure credential management
          url: "https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${OPEN_WEATHER_API_KEY}&units=metric",
          method: "GET",
        },
      },
      {
        jsonParseTask: {
          // ✅ Hardcoded path - verifiable data extraction
          path: "$.main.temp",
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Creates a simple value job for testing variable overrides
 */
export function buildSimpleValueJob(): OracleJob {
  const jobConfig = {
    tasks: [
      {
        valueTask: {
          big: "${TEST_VALUE}",
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Example of a more complex job with multiple API authentication headers
 * Following security best practices - only auth tokens use variables
 */
export function buildMultiAuthJob(): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          // ✅ Hardcoded endpoint - verifiable data source
          url: "https://api.polygon.io/v2/last/trade/AAPL", // Hardcoded symbol for verifiability
          method: "GET",
          headers: [
            {
              key: "Authorization",
              value: "Bearer ${AUTH_TOKEN}", // ✅ Only auth token as variable
            },
            {
              key: "X-API-Key",
              value: "${API_KEY}", // ✅ Only API key as variable
            },
            {
              key: "User-Agent",
              value: "Switchboard-Oracle/1.0", // ✅ Hardcoded
            },
          ],
        },
      },
      {
        jsonParseTask: {
          // ✅ Hardcoded path - verifiable data extraction
          path: "$.results.p",
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}