// create_ata.ts
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID as TOKEN_2022_FALLBACK, // for convenience
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import fs from "fs";

function env(name: string, req = true): string | undefined {
  const v = process.env[name];
  if (req && (!v || v.trim() === "")) throw new Error(`Missing env ${name}`);
  return v;
}

(async () => {
  // --- envs ---
  const kpPath = env("KP")!; // e.g. /path/to/id.json
  const mintStr = env("MINT")!; // e.g. SW1TCHL...
  const ownerStr = env("WALLET_ADDRESS")!; // ATA owner (EOA or PDA)

  // --- keypair / accounts ---
  const mint = new PublicKey(mintStr);
  const owner = new PublicKey(ownerStr);
  // If you want classic Token-2022-safe defaulting, uncomment the next line instead:
  // const tokenProgramId = tokenProgramIdStr ? new PublicKey(tokenProgramIdStr) : TOKEN_2022_FALLBACK; // set explicit for your setup

  // If you specifically want *classic* Token Program (not Token-2022), set:
  // const tokenProgramId = tokenProgramIdStr ? new PublicKey(tokenProgramIdStr) : new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  // --- derive ATA ---
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true // allowOwnerOffCurve (works for PDAs)
  );
  console.log("ATA:          ", ata.toBase58());

  // --- build ix ---
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
