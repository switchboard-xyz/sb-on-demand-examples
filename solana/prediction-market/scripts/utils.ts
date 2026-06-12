import * as anchor from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";

export const PREDICTION_MARKET_PROGRAM_PATH =
  "target/deploy/prediction_market-keypair.json";

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const programKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = programKeypair.publicKey;

  let idl: anchor.Idl | null = null;
  try {
    idl = await anchor.Program.fetchIdl(pid, provider);
  } catch {
    throw new Error(
      `Failed to fetch IDL for program ${pid.toBase58()}. Was it deployed?`
    );
  }

  if (!idl) {
    throw new Error(
      `No IDL found for program ${pid.toBase58()}. Was it deployed?`
    );
  }

  try {
    return new anchor.Program(idl, provider);
  } catch {
    throw new Error("Failed to load IDL of prediction market program.");
  }
}
