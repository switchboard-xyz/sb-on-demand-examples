import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import type { AccountInfo, AccountMeta } from "@solana/web3.js";
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
} from "@solana/web3.js";
import * as bs58 from "bs58";
import Big from "big.js";
import { OracleJob } from "@switchboard-xyz/common";
import { toBufferLE } from "bigint-buffer";
import * as crypto from "crypto";
import * as fs from "fs";
const assert = require("assert");
import * as sb from "@switchboard-xyz/on-demand";
import {
  AnchorUtils,
  InstructionUtils,
  PullFeed,
  Queue,
  RecentSlotHashes,
} from "@switchboard-xyz/on-demand";

function buildBinanceComJob(pair: String): OracleJob {
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

export type FeedSubmission = { value: Big; slot: BN; oracle: PublicKey };

(async () => {
  const [wallet, payer] = await AnchorUtils.initWalletFromFile("payer.json");
  const PID = sb.SB_ON_DEMAND_PID;
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const queue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const idl = (await anchor.Program.fetchIdl(PID, provider))!;
  const program = new anchor.Program(idl, PID, provider);
  const feedKp = Keypair.generate();
  const pullFeed = new PullFeed(program, feedKp.publicKey);
  let lastSlot: number = 0;
  const subscriptionId = await PullFeed.subscribeToAllUpdates(
    program,
    (x: any): Promise<void> => {
      const [slot_, resp] = x;
      const slot = new BN(slot_ - 100);
      const feed = resp.pubkey;
      const currentValue = sb.toFeedValue(resp.submissions, slot);
      if (currentValue === null) {
        console.log("No value found");
        return Promise.resolve<void>(undefined);
      }
      let maxSlot = 0;
      for (const submission of resp.submissions) {
        if (submission.slot.gt(maxSlot)) {
          maxSlot = submission.slot.toNumber();
        }
      }
      console.log(
        `Current value: ${currentValue.value.toString()} at slot ${maxSlot}, staleness: ${
          maxSlot - lastSlot
        }`
      );
      lastSlot = maxSlot;
      return Promise.resolve<void>(undefined);
    }
  );
  const conf: any = {
    queue,
    jobs: [buildBinanceComJob("BTCUSDT")],
    maxVariance: 1.0,
    minResponses: 1,
    numSignatures: 1,
  };
  conf.feedHash = await Queue.fetchFeedHash(program, conf);
  const ix = await pullFeed.initIx(conf);
  const tx = await InstructionUtils.asV0Tx(program, [ix]);
  tx.sign([payer, feedKp]);
  const sig = await connection.sendTransaction(tx, {
    preflightCommitment: "processed",
  });
  await connection.confirmTransaction(sig);
  console.log("Feed initialized: ", sig);

  while (true) {
    try {
      const ix = await pullFeed.solanaFetchUpdateIx(conf);
      const tx = await InstructionUtils.asV0Tx(program, [ix]);
      tx.sign([payer]);
      const sig = await connection.sendTransaction(tx, {
        preflightCommitment: "processed",
      });
      console.log("Sent update signature: ", sig);
    } catch (e) {
      console.log(e);
    }
  }
  return;
})();
