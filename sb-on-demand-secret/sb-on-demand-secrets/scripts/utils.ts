import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  Commitment
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { sha256 } from "js-sha256";
import nacl from "tweetnacl";

export const DEMO_PATH = "target/deploy/sb_on_demand_solana-keypair.json";
export const TX_CONFIG = {
  commitment: "processed" as Commitment,
  skipPreflight: true,
  maxRetries: 0,
};

export async function myProgramIx(program: anchor.Program, feed: PublicKey) {
  return await program.methods.test().accounts({ feed }).instruction();
}

export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  try {
    const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
    const pid = myProgramKeypair.publicKey;
    const idl = (await anchor.Program.fetchIdl(pid, provider))!;
    const program = new anchor.Program(idl, provider);
    return program;
  } catch (e) {
    throw new Error("Failed to load demo program. Was it deployed?");
  }
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

export function buildSecretsJob(
  secretNameTask: string,
  keypair: Keypair
): OracleJob {
  const jobConfig = {
    tasks: [
      {
        secretsTask: {
          authority: keypair.publicKey.toBase58(),
        },
      },
      {
        httpTask: {
          url: `https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${secretNameTask}&units=metric`,
        },
      },
      {
        jsonParseTask: {
          path: "$.main.temp",
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

export async function ensureUserSecretProfileExists(sbSecrets, keypair) {
  try {
    const user = await sbSecrets.getUser(
      keypair.publicKey.toBase58(),
      "ed25519"
    );
    console.log("User found", user);
    return user; // Return the user if found
  } catch (error) {
    console.log("User not found, creating user");
    const request = await sbSecrets.createOrUpdateUserRequest(
      keypair.publicKey.toBase58(),
      "ed25519",
      ""
    );
    // Hash the payload before signing for added security
    const payloadHash = sha256.create().update(request.toString()).hex();
    const signature = nacl.sign.detached(
        Buffer.from(payloadHash),
        keypair.secretKey
      );

    const user = await sbSecrets.createOrUpdateUser(
      request,
      Buffer.from(signature).toString("base64")
    );
    console.log("User created", user);
    return user; // Return the new user
  }
}

export async function ensureSecretExists(
  sbSecrets,
  keypair,
  secretName,
  secretValue,
  options = { maxRetries: 5, retryDelayMs: 1000 } 
) {
  const { maxRetries, retryDelayMs } = options;

  // Helper function to fetch a secret
  const fetchSecret = async () => {
    const userSecrets = await sbSecrets.getUserSecrets(
      keypair.publicKey.toBase58(),
      "ed25519"
    );
    return userSecrets.find((secret) => secret.secret_name === secretName);
  };

  // Step 1: Check if the secret already exists
  const existingSecret = await fetchSecret();
  if (existingSecret) {
    console.log(`Secret '${secretName}' already exists.`);
    console.log("Existing Secret:", existingSecret); // Log the existing secret
    return existingSecret;
  }

  // Step 2: Create the secret if it doesn't exist
  console.log(`Secret '${secretName}' not found. Creating now...`);
  const request = sbSecrets.createSecretRequest(
    keypair.publicKey.toBase58(),
    "ed25519",
    secretName,
    secretValue
  );

  const payloadHash = sha256.create().update(request.toString()).hex();
  const signature = nacl.sign.detached(
    Buffer.from(payloadHash),
    keypair.secretKey
  );

  await sbSecrets.createSecret(
    request,
    Buffer.from(signature).toString("base64")
  );

  // Step 3: Retry logic to confirm secret creation
  const retry = async (fn, attempts) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const result = await fn();
      if (result) {
        console.log(`Secret '${secretName}' successfully created and verified.`);
        console.log("Verified Secret:", result); // Log the verified secret
        return result;
      }
      console.log(
        `Secret '${secretName}' not found yet. Retrying in ${retryDelayMs}ms (Attempt ${attempt}/${attempts})...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    throw new Error(
      `Failed to confirm creation of secret '${secretName}' after ${attempts} attempts.`
    );
  };

  return retry(fetchSecret, maxRetries);
}


// export async function whitelistFeedHash(
//   sbSecrets,
//   keypair,
//   nacl,
//   feedHash,
//   secretName
// ) {
//   const addWhitelist = await sbSecrets.createAddMrEnclaveRequest(
//     keypair.publicKey.toBase58(),
//     "ed25519",
//     feedHash.toString("hex"),
//     [secretName]
//   );
//   const whitelistSignature = nacl.sign.detached(
//     new Uint8Array(addWhitelist.toEncodedMessage()),
//     keypair.secretKey
//   );
//   const sendWhitelist = await sbSecrets.addMrEnclave(
//     addWhitelist,
//     Buffer.from(whitelistSignature).toString("base64")
//   );
//   console.log("Feed hash whitelisted:", sendWhitelist);
//   return sendWhitelist;
// }
export async function whitelistFeedHash(
  sbSecrets,
  keypair,
  feedHash,
  secretName,
  options = { maxRetries: 5, retryDelayMs: 3000 } // Configurable options
) {
  const { maxRetries, retryDelayMs } = options;

  // Helper function to fetch user secrets and check whitelist
  const isFeedHashInWhitelist = async () => {
    const userSecrets = await sbSecrets.getUserSecrets(
      keypair.publicKey.toBase58(),
      "ed25519"
    );

    // Find the secret by name and check if the hash is in its whitelist
    const secret = userSecrets.find((s) => s.secret_name === secretName);
    if (!secret) {
      console.log(`Secret '${secretName}' not found.`);
      return false;
    }

    return secret.whitelist.includes(feedHash.toString("hex"));
  };

  // Step 1: Check if the feed hash is already whitelisted
  if (await isFeedHashInWhitelist()) {
    console.log(`Feed hash '${feedHash.toString("hex")}' is already whitelisted to Secret: '${secretName}.`);
    return { success: true, message: "Already whitelisted" };
  }

  // Step 2: Add the feed hash to the whitelist
  console.log(`Feed hash '${feedHash.toString("hex")}' not whitelisted to Secret: '${secretName}. Adding now...`);
  const request = await sbSecrets.createAddMrEnclaveRequest(
    keypair.publicKey.toBase58(),
    "ed25519",
    feedHash.toString("hex"),
    [secretName]
  );
  const payloadHash = sha256.create().update(request.toString()).hex();
  const signature = nacl.sign.detached(
    Buffer.from(payloadHash),
    keypair.secretKey
  );

  await sbSecrets.addMrEnclave(
    request,
    Buffer.from(signature).toString("base64")
  );
  console.log("Whitelist addition initiated.");

  // Step 3: Retry to confirm the feed hash was whitelisted
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (await isFeedHashInWhitelist()) {
      console.log(`Feed hash '${feedHash.toString("hex")}' successfully whitelisted to Secret: '${secretName}.`);
      return { success: true, message: "Whitelisted successfully" };
    }

    console.log(
      `Feed hash '${feedHash.toString(
        "hex"
      )}' not whitelisted yet. Retrying in ${retryDelayMs}ms (Attempt ${attempt}/${maxRetries})...`
    );
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  // If we exhaust all retries, throw an error
  throw new Error(
    `Failed to confirm whitelisting of feed hash '${feedHash.toString("hex")}' to secret: '${secretName}, after ${maxRetries} attempts.`
  );
}
