import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
} from "@solana/web3.js";

export async function myAnchorProgram(
  provider: anchor.Provider,
  myPid: PublicKey
): Promise<anchor.Program> {
  const idl = (await anchor.Program.fetchIdl(myPid, provider))!;
  const program = new anchor.Program(idl, provider);
  return program;
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



export function buildSecretsJob(secretNameTask: string, keypair: Keypair): OracleJob {
  const jobConfig = {
    tasks: [
      {
        secretsTask: {
          authority: keypair.publicKey.toBase58(),
        }
      },
      {
        httpTask: {
          url: `https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${secretNameTask}&units=metric`,
        }
      },
      {
        jsonParseTask: {
          path: "$.main.temp"
        }
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}


export async function ensureUserExists(sbSecrets, keypair, nacl) {
  try {
    const user = await sbSecrets.getUser(keypair.publicKey.toBase58(), "ed25519");
    console.log("User found", user);
    return user;  // Return the user if found
  } catch (error) {
    console.log("User not found, creating user");
    const payload = await sbSecrets.createOrUpdateUserRequest(keypair.publicKey.toBase58(), "ed25519", "");
    const signature = nacl.sign.detached(
      new Uint8Array(payload.toEncodedMessage()),
      keypair.secretKey
    );
    const user = await sbSecrets.createOrUpdateUser(
      payload,
      Buffer.from(signature).toString("base64")
    );
    console.log("User created", user);
    return user;  // Return the new user
  }
}

export async function ensureSecretExists(sbSecrets, keypair, nacl, secretName, secretValue) {
  // Retrieve the user's secrets
  const userSecrets = await sbSecrets.getUserSecrets(keypair.publicKey.toBase58(), "ed25519");
  const existingSecret = userSecrets.find(secret => secret.secret_name === secretName);

  if (existingSecret) {
    console.log(`Secret '${secretName}' already exists. No need to create.`);
    return existingSecret;  // Return the existing secret
  } else {
    console.log(`Secret '${secretName}' not found. Creating now...`);
    const secretRequest = sbSecrets.createSecretRequest(
      keypair.publicKey.toBase58(),
      "ed25519",
      secretName,
      secretValue
    );
    const secretSignature = nacl.sign.detached(
      new Uint8Array(secretRequest.toEncodedMessage()),
      keypair.secretKey
    );
    const secret = await sbSecrets.createSecret(
      secretRequest,
      Buffer.from(secretSignature).toString("base64")
    );
    console.log("Secret created:", secret);
    return secret;  // Return the new secret
  }
}

export async function whitelistFeedHash(sbSecrets, keypair, nacl, feedHash, secretName) {
  const addWhitelist = await sbSecrets.createAddMrEnclaveRequest(
    keypair.publicKey.toBase58(),
    "ed25519",
    feedHash.toString('hex'),
    [secretName]
  );
  const whitelistSignature = nacl.sign.detached(
    new Uint8Array(addWhitelist.toEncodedMessage()),
    keypair.secretKey
  );
  const sendWhitelist = await sbSecrets.addMrEnclave(
    addWhitelist,
    Buffer.from(whitelistSignature).toString("base64")
  );
  console.log("Feed hash whitelisted:", sendWhitelist);
  return sendWhitelist;
}