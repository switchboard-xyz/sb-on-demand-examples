import * as anchor from "@coral-xyz/anchor";
import { BN, Wallet } from "@coral-xyz/anchor";
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
  sleep,
} from "@switchboard-xyz/on-demand";

let lastSlot: number = 0;
async function feedUpdateCallback(x: any): Promise<void> {
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
    `Current value: ${currentValue.value.toString()} at slot ${maxSlot}`
  );
  lastSlot = maxSlot;
  return Promise.resolve<void>(undefined);
}

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

async function myAnchorProgram(
  provider: anchor.Provider,
  myPid: PublicKey
): Promise<anchor.Program> {
  const idl = (await anchor.Program.fetchIdl(myPid, provider))!;
  const program = new anchor.Program(idl, myPid, provider);
  return program;
}

(async () => {
  const path = "../target/deploy/sb_on_demand_solana-keypair.json";
  const queue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
  const [_, myProgramKeypair] = await AnchorUtils.initWalletFromFile(path);
  const { keypair, connection, provider } = await AnchorUtils.loadEnv();
  const program = await AnchorUtils.loadProgramFromEnv();
  const [pullFeed, feedKp] = PullFeed.generate(program);
  const subscriptionId = await PullFeed.subscribeToAllUpdates(
    program,
    feedUpdateCallback
  );
  const conf: any = {
    queue,
    jobs: [buildBinanceComJob("BTCUSDT")],
    maxVariance: 1.0,
    minResponses: 1,
    numSignatures: 1,
  };
  conf.feedHash = await Queue.fetchFeedHash(program, conf);

  // Initialize the feed
  const tx = await pullFeed.initTx(program, conf);
  tx.sign([keypair, feedKp]);
  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig);
  console.log("Feed initialized: ", sig);

  // Send a price update every 5 seconds
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  while (true) {
    try {
      const tx = await InstructionUtils.asV0Tx(program, [
        await pullFeed.solanaFetchUpdateIx(conf),
        await myProgram.methods
          .test()
          .accounts({ feed: feedKp.publicKey })
          .instruction(),
      ]);
      tx.sign([keypair]);
      const sim = await connection.simulateTransaction(tx, {
        commitment: "processed",
      });
      console.log(
        "Simulated update: ",
        sim.value.logs.filter(
          (x) => x.includes("Program log:") && !x.includes("Instruction:")
        )
      );
      const sig = await connection.sendTransaction(tx, {
        skipPreflight: true,
      });
      console.log("Sent update signature: ", sig);
    } catch (e) {
      console.log(e);
    }
    await sleep(5_000);
  }
  return;
})();
