import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Commitment,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";

export const DEMO_PATH = "target/deploy/sb_on_demand_solana-keypair.json";
export const TX_CONFIG = {
  commitment: "processed" as Commitment,
  skipPreflight: true,
  maxRetries: 0,
};

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

export async function myProgramIx(
  program: anchor.Program,
  feed_: PublicKey | string
): Promise<TransactionInstruction> {
  const feed = new PublicKey(feed_);
  const myIx = await program.methods.test().accounts({ feed }).instruction();
  return myIx;
}

export function buildPythnetJob(pythFeed: string): OracleJob {
  const jobConfig = OracleJob.create({
    tasks: [
      OracleJob.Task.create({
        oracleTask: OracleJob.OracleTask.create({
          pythAllowedConfidenceInterval: 1.0,
          pythAddress: pythFeed,
        }),
      }),
    ],
  });
  return jobConfig;
}

export function buildSanctumFairPriceJob(lstMint: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        sanctumLstPriceTask: {
          lstMint,
        },
      },
    ],
  });
  return jobConfig;
}

export function buildBinanceComJob(pair: string): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          url: `https://www.binance.com/api/v3/ticker/price`,
        },
      },
      {
        jsonParseTask: {
          path: `$[?(@.symbol == '${pair}')].price`,
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

export function buildCoinbaseJob(pair: String): OracleJob {
  const parts = pair.split("-");
  const jobConfig = {
    tasks: [
      {
        valueTask: { value: 1 },
      },
      {
        divideTask: {
          job: {
            tasks: [
              {
                httpTask: {
                  url: `https://api.coinbase.com/v2/exchange-rates?currency=${parts[1]}`,
                  headers: [
                    { key: "Accept", value: "application/json" },
                    { key: "User-Agent", value: "Mozilla/5.0" },
                  ],
                },
              },
              {
                jsonParseTask: {
                  path: `$.data.rates.${parts[0]}`,
                },
              },
            ],
          },
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
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
