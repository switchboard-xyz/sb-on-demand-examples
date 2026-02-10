import { PublicKey, Connection, TransactionInstruction, Keypair } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import { FeedHash, OracleJob, IOracleFeed } from "@switchboard-xyz/common";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { TX_CONFIG, loadBasicProgram, basicReadOracleIx } from "./utils";

const URL = "https://helius.api.corbits.dev";
const RPC_METHOD = "getBlockHeight";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/**
 * Check and display the USDC balance for a given keypair on mainnet
 */
async function checkUsdcBalance(
  connection: Connection,
  keypair: Keypair,
  usdcMint: PublicKey
): Promise<void> {
  try {
    const usdcTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      keypair.publicKey
    );
    const tokenAccountInfo = await getAccount(connection, usdcTokenAccount);
    const usdcBalance = Number(tokenAccountInfo.amount) / 1_000_000; // USDC has 6 decimals
    console.log("💵 Current USDC balance on mainnet:", usdcBalance.toFixed(6), "USDC");
  } catch (error) {
    console.error("❌ Failed to fetch USDC balance (token account may not exist):", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Build and simulate a transaction with the given instructions
 */
async function simulateTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  readOracleIx: TransactionInstruction,
  keypair: Keypair
): Promise<void> {
  console.log("\n🔨 Building transaction...");
  const tx = await sb.asV0Tx({
    connection,
    ixs: [
      ...instructions, // Managed update instructions
      readOracleIx,    // Read from quote account
    ],
    signers: [keypair],
    computeUnitPrice: 20_000,
    computeUnitLimitMultiple: 1.1,
  });

  console.log("🧪 Simulating transaction...");
  const sim = await connection.simulateTransaction(tx);
  console.log(sim.value.logs?.join("\n"));

  if (sim.value.err) {
    console.error("❌ Simulation failed:", sim.value.err);
    process.exit(1);
  }

  console.log("\n✅ Simulation succeeded!");
  console.log("\n💡 Key Takeaways:");
  console.log("   • Feed defined inline (not stored on IPFS)");
  console.log("   • X402 header passed via variable override");
  console.log("   • Oracle authenticated with paywalled RPC");
  console.log("   • Data stored in quote account");
}

const ORACLE_FEED: IOracleFeed = {
  name: "X402 Paywalled RPC Call",
  minJobResponses: 1,
  minOracleSamples: 1,
  maxJobRangePct: 0,
  jobs: [
    {
      tasks: [
        {
          httpTask: {
            url: URL,
            method: OracleJob.HttpTask.Method.METHOD_POST,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: RPC_METHOD,
            }),
            headers: [
              {
                key: "PAYMENT-SIGNATURE",
                value: "${X402_PAYMENT_SIGNATURE}",
              },
            ],
          },
        },
        {
          jsonParseTask: {
            path: "$.result", // Extract result from JSON-RPC response
          },
        },
      ],
    },
  ],
};

/**
 * X402 Variable Override Example - Paywalled RPC Access (v2 API)
 *
 * This example demonstrates using X402 v2 authentication headers as variable overrides
 * to access paywalled RPC endpoints. The feed is defined inline rather than stored on IPFS.
 *
 * Key concepts:
 * 1. Define oracle feed inline with ${X402_PAYMENT_SIGNATURE} placeholder
 * 2. Use x402 v2 client to derive payment signature for the paywalled RPC endpoint
 * 3. Pass signature as variable override to oracle job
 * 4. Oracle uses the signature to authenticate JSON-RPC calls
 * 5. Extract $.result from JSON-RPC response
 * 6. Verified data is returned in the Ed25519 instruction
 *
 * This approach is useful for:
 * - Paywalled RPC endpoints requiring micropayments
 * - Dynamic authentication without IPFS storage
 * - JSON-RPC methods on premium infrastructure
 * - Custom authentication schemes
 */
(async function main() {
  console.log("🔧 Initializing X402 v2 variable override demo...");

  // Step 1: Load Solana environment configuration (`$ solana config get`)
  const { program, keypair, connection, crossbar } = await sb.AnchorUtils.loadEnv();
  console.log("👤 Wallet:", keypair.publicKey.toBase58());
  console.log("📡 RPC Method:", RPC_METHOD);

  // Step 2: Check USDC balance on mainnet
  await checkUsdcBalance(connection, keypair, USDC);

  // Step 3: Create x402 v2 client with Solana signer
  console.log("\n🔐 Initializing x402 v2 client...");
  const signer = await createKeyPairSignerFromBytes(keypair.secretKey);
  const client = new x402Client();
  registerExactSvmScheme(client, { signer: toClientSvmSigner(signer) });
  console.log("✅ x402 v2 client initialized");

  // Step 4: Fetch 402 payment requirements from the paywalled endpoint
  console.log("\n🔑 Fetching payment requirements (402) from paywalled RPC...");
  const requestBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: RPC_METHOD,
  });

  const response = await fetch(URL, {
    method: "POST",
    body: requestBody,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Step 5: Derive X402 PAYMENT-SIGNATURE header
  console.log("🔐 Deriving PAYMENT-SIGNATURE header...");
  const httpClient = new x402HTTPClient(client);
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    name => response.headers.get(name),
    await response.json().catch(() => undefined)
  );
  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const paymentSignature = paymentHeaders["PAYMENT-SIGNATURE"];
  console.log("✅ X402 payment signature generated");

  // Step 6: Load Switchboard queue
  const queue = await sb.Queue.loadDefault(program!);

  // Step 7: Compute and display the feed ID (hash of the protobuf)
  const feedId = FeedHash.computeOracleFeedId(ORACLE_FEED);
  console.log("🔖 Feed ID:", `0x${feedId.toString("hex")}`);

  // Step 8: Derive the canonical quote account from the feed id
  const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [feedId]);
  console.log("📍 Quote Account:", quoteAccount.toBase58());

  // NOTE: You must not simulate with the same x402 signature or you will pay twice!
  // const simFeed = await crossbar.simulateFeed(ORACLE_FEED, true, { X402_PAYMENT_SIGNATURE: paymentSignature });

  // Step 9: Fetch managed update instructions with X402 signature as variable override
  console.log("\n📋 Fetching managed update instructions with X402 variable overrides...");
  const instructions = await queue.fetchManagedUpdateIxs(
    crossbar,
    [ORACLE_FEED],
    {
      // NOTE: NUM_SIGNATURES MUST BE 1 FOR x402 REQUESTS
      numSignatures: 1,
      // Pass the X402 payment signature as variable override
      // This replaces ${X402_PAYMENT_SIGNATURE} in the job definition
      variableOverrides: {
        X402_PAYMENT_SIGNATURE: paymentSignature,
      },
      instructionIdx: 0,
      payer: keypair.publicKey,
    }
  );

  console.log("✅ Generated instructions:", instructions.length);
  console.log("   - Ed25519 signature verification");
  console.log("   - Quote program verified_update");
  console.log("   - Variable override: X402_PAYMENT_SIGNATURE");

  // Step 10: Load basic program and create read instruction
  const basicProgram = await loadBasicProgram(program!.provider);
  const readOracleIx = await basicReadOracleIx(
    basicProgram,
    quoteAccount,
    queue.pubkey,
    keypair.publicKey
  );

  // Step 11: Build and simulate transaction
  await simulateTransaction(connection, instructions, readOracleIx, keypair);
})();
