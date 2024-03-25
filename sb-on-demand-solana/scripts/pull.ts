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
  const [wallet, payer] = await AnchorUtils.initWalletFromFile(
    "/Users/mgild/switchboard_environments_v2/devnet/upgrade_authority/test.json"
  );
  const PID = sb.SB_ON_DEMAND_PID;
  const connection = new Connection(
    "https://switchbo-switchbo-6225.devnet.rpcpool.com/f6fb9f02-0777-498b-b8f5-67cbb1fc0d14",
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
        `Current value of feed ${feedKp.publicKey}: ${currentValue.value.toString()} at slot ${maxSlot}, staleness: ${
          maxSlot - lastSlot
        }`
      );
      lastSlot = maxSlot;
      return Promise.resolve<void>(undefined);
    }
  );

  while (true) {
    try {
      const now = Math.floor(+Date.now() / 1000);
      const ixs = await PullFeed.solanaFetchUpsertIxs(program, {
        feed: feedKp.publicKey,
        queue,
        jobs: [buildBinanceComJob("BTCUSDT")],
        numSignatures: 1,
        maxVariance: 1,
        minResponses: 1,
      });
      const tx = await InstructionUtils.asV0Tx(program, ixs, []);
      tx.sign([payer, feedKp]);
      program.provider.connection
        .sendTransaction(tx, {
          preflightCommitment: "processed",
        })
        .catch((e) => console.log("Error: ", e));
    } catch (e) {
      console.log(e);
    }
  }
  return;
})();
