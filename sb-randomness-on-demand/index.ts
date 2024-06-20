import * as anchor from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  VersionedTransaction, Commitment
} from "@solana/web3.js";
import {
  AnchorUtils,
  InstructionUtils,
  Queue,
  Randomness,
  SB_ON_DEMAND_PID,
  sleep,
} from "@switchboard-xyz/on-demand";
import dotenv from "dotenv";
import * as fs from "fs";
import reader from "readline-sync";

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";

// async function myAnchorProgram(
//   provider: anchor.Provider,
//   myPid: PublicKey
// ): Promise<anchor.Program> {
//   const idl = (await anchor.Program.fetchIdl(myPid, provider))!;
//   const program = new anchor.Program(idl, provider);
//   return program;
// }
export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = myProgramKeypair.publicKey;
  const idl = (await anchor.Program.fetchIdl(pid, provider))!;
  const program = new anchor.Program(idl, provider);
  return program;
}

(async function () {
  dotenv.config();
  console.clear();
  const { keypair, connection, provider, wallet } = await AnchorUtils.loadEnv();
  console.log(
    "NOTE: this example requires your solana cli config to be set to devnet"
  );
  console.log(
    "🚀 Welcome, brave soul, to the Cosmic Coin Flip Challenge! 🚀\n"
  );
  if (fileExists("serializedIx.bin")) {
    console.log("A pending request has been found in the ether. Resuming...");
    const bin = fs.readFileSync("serializedIx.bin");
    const tx = VersionedTransaction.deserialize(bin);
    tx.message.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash;
    tx.sign([keypair]);
    const sig = await connection.sendTransaction(tx);
    await connection.confirmTransaction(sig);
    console.log(
      "\n💫 With bated breath, we watched as the oracle unveiled our destiny: 💫"
    );
    let transactionRes = await connection.getTransaction(sig, {
      maxSupportedTransactionVersion: 0,
    });
    let resultLog = transactionRes?.meta?.logMessages?.filter((line) =>
      line.includes("FLIP_RESULT")
    )[0];
    let result = resultLog?.split(": ")[2];

    console.log(`\nDestiny reveals itself as... ${result}!`);
    fs.unlinkSync("serializedIx.bin");
    return;
  }
  const userGuess = getUserGuessFromCommandLine();
  console.log(
    `You've chosen ${
      userGuess ? "heads" : "tails"
    }. A choice that echoes through the cosmos.\n`
  );

  await pauseForEffect(
    "The stage is set, the galaxies align, and your destiny awaits. Prepare to cast your fate with the flip of a cosmic coin."
  );

  console.log("But this is no ordinary coin flip...");
  await pauseForEffect(
    "Powered by the mystical energies of Switchboard On-Demand Randomness, this challenge transcends the mundane, touching the very fabric of the cosmos."
  );

  const payer = wallet.payer;
  // Switchboard sbQueue fixed
  const sbQueue = new PublicKey("FfD96yeXs4cxZshoPPSKhSPgVQxLAJUT3gefgh84m1Di");
  const sbProgramId = SB_ON_DEMAND_PID;
  const sbIdl = await anchor.Program.fetchIdl(sbProgramId, provider);
  const sbProgram = new anchor.Program(sbIdl!, provider);
  const queueAccount = new Queue(sbProgram, sbQueue);

  // setup
  const path = "sb-randomness/target/deploy/sb_randomness-keypair.json";
  const [_, myProgramKeypair] = await AnchorUtils.initWalletFromFile(path);
  const coinFlipProgramId = new PublicKey(myProgramKeypair.publicKey.toString());
  const coinFlipProgram = await myAnchorProgram(provider, coinFlipProgramId.toString());

  const txOpts = {
    commitment: "processed" as Commitment,
    skipPreflight: true,
    maxRetries: 0,
  };
  await pauseForEffect("Now, let us begin our journey through the stars.");

  const rngKp = Keypair.generate();
  console.log("\n🌌 Step 1: Conjuring the Oracle of Randomness 🌌");
  const [randomness, ix] = await Randomness.create(sbProgram, rngKp, sbQueue);
  await pauseForEffect(
    "The Oracle whispers of futures unseen, awaiting our command to cast the die."
  );

  // const tx = await InstructionUtils.asV0Tx(sbProgram, [ix]);
  const tx = await sb.asV0Tx({
    connection: sbProgram.provider.connection,
    ixs: [ix],
    payer: keypair.publicKey,
    signers: [keypair, rngKp],
    computeUnitPrice: 75_000,
    computeUnitLimitMultiple: 1.3,
  });
  console.log("");
  //tx.sign([payer, rngKp]);
  // const sig1 = await connection.sendTransaction(tx);
  // await connection.confirmTransaction(sig1);
  const sim = await connection.simulateTransaction(tx, txOpts);
  const sig1 = await connection.sendTransaction(tx, txOpts);
  console.log("\n✨ Step 2: The Alignment of Celestial Forces ✨");

  // initialise game state
  console.log(
    "As celestial forces align, the stage is set for a quantum leap of fate."
  );

  const [playerStateAccount] = await PublicKey.findProgramAddress(
    [Buffer.from(PLAYER_STATE_SEED), payer.publicKey.toBuffer()],
    coinFlipProgramId
  ) as [PublicKey, number];

  // Find the escrow account PDA
  const [escrowAccount, escrowBump] = await PublicKey.findProgramAddress(
    [Buffer.from(ESCROW_SEED)],
    coinFlipProgramId
  );
  console.log("Escrow account", escrowAccount.toString());
  console.log("Player state account", playerStateAccount.toString());
  console.log("");

  // ensure game state account is initialized
  await ensurePlayerStateInitialized(
    playerStateAccount,
    escrowAccount,
    payer,
    provider,
    coinFlipProgram
  );
  // ensure escrow account is funded
  await ensureAccountFunded(connection, payer, escrowAccount, provider);
  await pauseForEffect(
    "With every variable in place, the time has come to challenge destiny."
  );

  // Switchboard magic: 2. Commit randomness
  console.log("\n🌌 Step 3: Sealing Fate with The Commitment Ceremony 🌌");
  await pauseForEffect(
    "At this pivotal moment, we invoke the ancient and mysterious powers of Switchboard On-Demand Randomness. With a solemn vow, we commit our guess to the cosmic ledger, never to be altered."
  );

  const transaction1 = new Transaction();
  // Commit transaction
  let commitIx;
  try {
    commitIx = await randomness.commitIx(sbQueue);
  } catch (error) {
    try {
      await queueAccount.fetchFreshOracle();
    } catch (error) {
      console.error(
        "Failed to find an open oracle. Please check our docs to ensure queue ${sbQueue} is an active queue."
      );
      throw error;
    }
    throw error;
  }

  const coinFlipIx = await coinFlipProgram.instruction.coinFlip(
    randomness.pubkey,
    userGuess,
    {
      accounts: {
        playerState: playerStateAccount,
        user: provider.wallet.publicKey,
        randomnessAccountData: randomness.pubkey,
        escrowAccount: escrowAccount,
        systemProgram: SystemProgram.programId,
      },
    }
  );

  // Add the coin flip instruction to
  transaction1.add(commitIx, coinFlipIx);
  const sig2 = await provider.sendAndConfirm(transaction1, [payer]);
  console.log(
    "\n✨ As the cosmic dust settles, our fate is now irrevocably bound to the whims of the universe. The Commitment Ceremony is complete. ✨"
  );
  console.log(`Transaction Signature: ${sig2}`);
  await sleep(5000); // Pause for effect..

  console.log("\n🔮 Step 4: Unveiling Destiny with The Grand Reveal 🔮");
  await pauseForEffect(
    "The air crackles with anticipation. The oracle, now ready, begins the sacred reveal. Watch closely as the curtain between realms thins, offering us a glimpse into the future."
  );

  const transaction2 = new Transaction();
  let revealIx = undefined;
  const settleFlipIx = await coinFlipProgram.instruction.settleFlip(
    escrowBump,
    {
      accounts: {
        playerState: playerStateAccount,
        randomnessAccountData: randomness.pubkey,
        escrowAccount: escrowAccount,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
    }
  );
  const tries = 5;
  for (let i = 0; i < tries; ++i) {
    try {
      revealIx = await randomness.revealIx();
      randomness.serializeIxToFile(
        [revealIx, settleFlipIx],
        "serializedIx.bin"
      );
      break;
    } catch (error) {
      if (i === tries - 1) {
        throw error;
      }
      console.log(
        "Waiting for a tiny bit more for the commitment to be locked..."
      );
      await sleep(1000);
    }
  }
  // Add the settle flip instruction to
  transaction2.add(revealIx!, settleFlipIx);
  const sig = await provider.sendAndConfirm(transaction2, [payer], {
    commitment: COMMITMENT,
  });
  console.log(
    "\n💫 With bated breath, we watched as the oracle unveiled our destiny: 💫"
  );
  console.log(`Transaction Signature: ${sig}`);
  // Dramatic pause
  await sleep(2000);

  let transaction = await connection.getConfirmedTransaction(sig);
  let resultLog = transaction?.meta?.logMessages?.filter((line) =>
    line.includes("FLIP_RESULT")
  )[0];
  let result = resultLog?.split(": ")[2];

  console.log(`\nDestiny reveals itself as... ${result}!`);
  footer(result!, userGuess);
})();

function footer(result: string, userGuess: boolean) {
  // Conclusion based on the result
  if ((result === "Heads" && userGuess) || (result === "Tails" && !userGuess)) {
    console.log(
      "\n✨ By the will of the cosmos and the Oracle's vision, victory is yours! Revel in the glory of the stars. ✨"
    );
  } else {
    console.log(
      "\n🌌 Though the stars did not align in your favor this time, remember, each spin of the cosmic wheel brings new possibilities. 🌌"
    );
  }

  console.log(
    "\nThank you for participating in the Cosmic Coin Flip Challenge. May the mysteries of the universe always intrigue and inspire you.\n"
  );
  fs.unlinkSync("serializedIx.bin");
}

async function ensureAccountFunded(
  connection: Connection,
  payer: Keypair,
  accountPubkey: PublicKey,
  provider: anchor.AnchorProvider,
  additionalLamports: number = 0
): Promise<void> {
  const accountBalance = await connection.getBalance(accountPubkey);
  // Determine the required balance for rent exemption
  const minRentExemption =
    await connection.getMinimumBalanceForRentExemption(0); // Adjust based on your account size needs

  const requiredBalance = minRentExemption + additionalLamports;
  if (accountBalance < requiredBalance) {
    const amountToFund = requiredBalance - accountBalance;
    console.log(
      `Funding account with ${amountToFund} lamports to meet rent exemption threshold.`
    );

    // Create and send the funding transaction
    const transferTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: accountPubkey,
        lamports: amountToFund,
      })
    );
    await provider.sendAndConfirm(transferTx, [payer]);
  } else {
  }
}

async function ensurePlayerStateInitialized(
  playerStateAccount: PublicKey,
  escrowAccount: PublicKey,
  payer: Keypair,
  provider: anchor.AnchorProvider,
  program: anchor.Program
): Promise<void> {
  try {
    // Try to fetch the game state account
    await program.account.playerState.fetch(playerStateAccount);
  } catch (error) {
    // Initialize the game state account
    const initTx = new Transaction().add(
      program.instruction.initialize({
        accounts: {
          playerState: playerStateAccount,
          escrowAccount: escrowAccount,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
      })
    );

    const signature = await provider.sendAndConfirm(initTx, [payer]);
  }
}

function getUserGuessFromCommandLine(): boolean {
  // Extract the user's guess from the command line arguments
  let userGuessInput = process.argv[2]; // The third argument is the user's input
  if (!userGuessInput) {
    userGuessInput = reader
      .question("It is now time to make your prediction: Heads or tails... ")
      .trim()
      .toLowerCase();
  }

  // Validate and convert the input to a boolean (heads = true, tails = false)
  const isValidGuess = userGuessInput === "heads" || userGuessInput === "tails";
  if (!isValidGuess) {
    console.error('Please provide a valid guess: "heads" or "tails".');
    process.exit(1); // Exit the script with an error code
  }

  return userGuessInput === "heads"; // Convert "heads" to true, "tails" to false
}

function pauseForEffect(message: any, duration = 500) {
  console.log(message);
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function fileExists(path: string): boolean {
  try {
    fs.accessSync(path, fs.constants.F_OK);
  } catch {
    return false;
  }
  return true;
}
