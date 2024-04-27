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

export function buildBinanceComJob(pair: String): OracleJob {
  const tasks = [
    OracleJob.Task.create({
      httpTask: OracleJob.HttpTask.create({
        url: `https://www.binance.com/api/v3/ticker/price?symbol=${pair}`,
      }),
    }),
    OracleJob.Task.create({
      jsonParseTask: OracleJob.JsonParseTask.create({ path: "$.price" }),
    }),
  ];
  return OracleJob.create({ tasks });
}

export function buildCoinbaseJob(pair: String): OracleJob {
  const tasks = [
    OracleJob.Task.create({
      httpTask: OracleJob.HttpTask.create({
        url: `https://api.pro.coinbase.com/products/${pair}/ticker`,
        headers: [
          { key: "Accept", value: "application/json" },
          { key: "User-Agent", value: "Mozilla/5.0" },
        ],
      }),
    }),
    OracleJob.Task.create({
      jsonParseTask: OracleJob.JsonParseTask.create({ path: "$.price" }),
    }),
  ];
  return OracleJob.create({ tasks });
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
