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
  Commitment,
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
import { myAnchorProgram, buildCoinbaseJob, buildBinanceComJob } from "./utils";

async function feedUpdateCallback([slot_, resp]: any[]): Promise<void> {
  const slot = new BN(slot_ - 100);
  const currentValue = sb.toFeedValue(resp.submissions, slot)?.value;
  const vals = resp.submissions;
  const max = vals.reduce((max, sub) => Math.max(max, +sub.slot), 0);
  console.log(`Current value: ${currentValue} at slot ${max}`);
}

(async function main() {
  // Devnet default queue
  const queue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
  const path = "../target/deploy/sb_on_demand_solana-keypair.json";
  const [_, myProgramKeypair] = await AnchorUtils.initWalletFromFile(path);
  const { keypair, connection, provider } = await AnchorUtils.loadEnv();
  const program = await AnchorUtils.loadProgramFromEnv();
  const myProgram = await myAnchorProgram(provider, myProgramKeypair.publicKey);
  // Generate the feed keypair
  const [pullFeed, feedKp] = PullFeed.generate(program);
  // Gets all feed updates
  const subscriptionId = await PullFeed.subscribeToAllUpdates(
    program,
    feedUpdateCallback
  );
  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
  };
  const conf = {
    // the feed name (max 32 bytes)
    name: "PYUSD-USD",
    // the queue of oracles to bind to
    queue,
    // the jobs for the feed to perform
    jobs: [buildCoinbaseJob("PYUSD-USD")],
    // allow 1% variance between submissions and jobs
    maxVariance: 1.0,
    // minimum number of responses of jobs to allow
    minResponses: 1,
    // number of signatures to fetch per update
    numSignatures: 1,
  };

  // Initialize the feed
  const tx = await pullFeed.initTx(program, conf);
  tx.sign([keypair, feedKp]);
  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig);
  console.log("Feed initialized: ", sig);

  // Send a price update with a following user instruction every N seconds
  const interval = 1_000;
  while (true) {
    const tx = await InstructionUtils.asV0Tx(program, [
      await pullFeed.solanaFetchUpdateIx(conf),
      await myProgram.methods
        .test()
        .accounts({ feed: feedKp.publicKey })
        .instruction(),
    ]);
    tx.sign([keypair]);
    const sim = await connection.simulateTransaction(tx, txOpts);
    const simLogs = sim.value.logs.filter(
      (x) => x.includes("Program log:") && !x.includes("Instruction:")
    );
    const sig = await connection.sendTransaction(tx, txOpts);
    console.log(`Price update: ${simLogs}\n\t${sig}`);
    await sleep(interval);
  }
})();
