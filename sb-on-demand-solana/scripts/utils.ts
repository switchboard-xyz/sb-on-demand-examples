import { AnchorUtils } from "@switchboard-xyz/on-demand";
import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  MessageV0,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  Commitment,
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
          path: '$[?(@.symbol == "BTCUSDC")].price',
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

export function buildCoinbaseJob(token: String): OracleJob {
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
                  url: `https://api.coinbase.com/v2/exchange-rates?currency=USD`,
                  headers: [
                    { key: "Accept", value: "application/json" },
                    { key: "User-Agent", value: "Mozilla/5.0" },
                  ],
                },
              },
              {
                jsonParseTask: {
                  path: `$.data.rates.${token}`,
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
