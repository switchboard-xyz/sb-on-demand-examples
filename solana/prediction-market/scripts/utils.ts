import * as anchor from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";

export const PREDICTION_MARKET_PROGRAM_PATH =
  "target/deploy/prediction_market-keypair.json";

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const programKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const programId = programKeypair.publicKey;

  let idl: anchor.Idl | null = null;
  try {
    idl = (await anchor.Program.fetchIdl(programId, provider))!;
  } catch {
    throw new Error(
      `Failed to fetch IDL for program ${programId.toBase58()}. Was it deployed?`
    );
  }

  try {
    return new anchor.Program(idl, provider);
  } catch {
    throw new Error("Failed to load prediction-market IDL. Was it deployed?");
  }
}
