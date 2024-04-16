import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  SB_ON_DEMAND_PID,
  Randomness,
  InstructionUtils,
} from "@switchboard-xyz/on-demand";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import { AnchorWallet } from "@switchboard-xyz/solana.js";
import dotenv from "dotenv";
import resolve from "resolve-dir";
import { exec } from "child_process";
import * as fs from "fs";
import * as shell from "shelljs";
import reader from "readline-sync";

function loadDefaultKeypair() {
  const command =
    'solana config get | grep "Keypair Path" | awk -F " " \'{ print $3 }\'';
  const res = shell.exec(command, { async: false }).stdout.trim();
  const payerJson = new Uint8Array(
    JSON.parse(fs.readFileSync(resolve(res), "utf8"))
  );
  return Keypair.fromSecretKey(payerJson);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PLAYER_STATE_SEED = "playerState";
const ESCROW_SEED = "stateEscrow";
const COMMITMENT = "confirmed";

(async function () {
  dotenv.config();
  console.clear();
  const keypair = loadDefaultKeypair();
  console.log(
    "🚀 Welcome, brave soul, to the Cosmic Coin Flip Challenge! 🚀\n"
  );
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

  const sbProgramId = SB_ON_DEMAND_PID;
  const url = "https://api.devnet.solana.com";
  let connection = new Connection(url, {
    commitment: COMMITMENT,
  });

  const wallet = new AnchorWallet(keypair);
  const payer = wallet.payer;
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });
  // Switchboard sbQueue fixed
  const sbQueue = new PublicKey("5Qv744yu7DmEbU669GmYRqL9kpQsyYsaVKdR8YiBMTaP");
  const sbIdl = await anchor.Program.fetchIdl(sbProgramId, provider);
  const sbProgram = new anchor.Program(sbIdl!, sbProgramId, provider);

  // setup
  const coinFlipProgramId = new PublicKey(
    "Hjj3P8Bt7LYrbMnSa3zxA5iZu5E2hSHAFpxz32LrAXNv"
  );
  const idlCoin = await anchor.Program.fetchIdl(coinFlipProgramId, provider);
  const coinFlipProgram = new anchor.Program(
    idlCoin!,
    coinFlipProgramId,
    provider
  );

  await pauseForEffect("Now, let us begin our journey through the stars.");

  const rngKp = Keypair.generate();
  console.log("\n🌌 Step 1: Conjuring the Oracle of Randomness 🌌");
  const [randomness, ix] = await Randomness.create(sbProgram, rngKp, sbQueue);
  await pauseForEffect(
    "The Oracle whispers of futures unseen, awaiting our command to cast the die."
  );

  const tx = await InstructionUtils.asV0Tx(sbProgram, [ix]);
  console.log("");
  tx.sign([payer, rngKp]);
  const sig1 = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig1);
  console.log("\n✨ Step 2: The Alignment of Celestial Forces ✨");

  // initialise game state
  console.log(
    "As celestial forces align, the stage is set for a quantum leap of fate."
  );

  const [playerStateAccount] = await PublicKey.findProgramAddress(
    [Buffer.from(PLAYER_STATE_SEED), payer.publicKey.toBuffer()],
    coinFlipProgramId
  );

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
  const commitIx = await randomness.commitIx();

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
  for (let i = 0; i < 5; ++i) {
    try {
      revealIx = await randomness.revealIx();
      break;
    } catch (error) {
      if (i === 4) {
        throw error;
      }
      console.log(
        "Waiting for a tiny bit more for the commitment to be locked..."
      );
      await sleep(1000);
    }
  }
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
  // Add the settle flip instruction to
  transaction2.add(revealIx!, settleFlipIx);
  const sig = await provider.sendAndConfirm(transaction2, [payer]);
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
})();

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

function pauseForEffect(message: any, duration = 3000) {
  console.log(message);
  return new Promise((resolve) => setTimeout(resolve, duration));
}