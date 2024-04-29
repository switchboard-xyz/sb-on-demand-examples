import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
} from "@solana/web3.js";

export async function myAnchorProgram(
  provider: anchor.Provider,
  myPid: PublicKey
): Promise<anchor.Program> {
  const idl = (await anchor.Program.fetchIdl(myPid, provider))!;
  const program = new anchor.Program(idl, myPid, provider);
  return program;
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
