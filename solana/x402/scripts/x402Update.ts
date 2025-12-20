import { PublicKey, Connection, TransactionInstruction, Keypair } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import { CrossbarClient, FeedHash, IOracleFeed, OracleJob } from "@switchboard-xyz/common";
import { createLocalWallet } from "@faremeter/wallet-solana";
import { exact } from "@faremeter/payment-solana";
import { X402FetchManager } from "@switchboard-xyz/x402-utils";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { TX_CONFIG, loadBasicProgram, basicReadOracleIx } from "../utils";

const URL = "https://helius.api.corbits.dev";
const RPC_METHOD = "getBlockHeight";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/**
 * Build JSON-RPC request body
 */
function buildJsonRpcBody(method: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method,
  });
}

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
            body: buildJsonRpcBody(RPC_METHOD),
            headers: [
              {
                key: "X-PAYMENT",
                value: "${X402_PAYMENT_HEADER}",
              },
              {
                key: "X-SWITCHBOARD-PAYMENT",
                value: "${X402_SWITCHBOARD_PAYMENT_HEADER}",
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
 * X402 Variable Override Example - Paywalled RPC Access
 *
 * This example demonstrates using X402 authentication headers as variable overrides
 * to access paywalled RPC endpoints. Similar to the prediction market example, the
 * feed is defined inline rather than stored on IPFS.
 *
 * Key concepts:
 * 1. Define oracle feed inline with ${X402_PAYMENT_HEADER} placeholder
 * 2. Derive X402 payment header for the paywalled RPC endpoint
 * 3. Pass header as variable override to oracle job
 * 4. Oracle uses the header to authenticate JSON-RPC calls
 * 5. Extract $.result from JSON-RPC response
 * 6. Verified data is returned in the Ed25519 instruction
 *
 * This approach is useful for:
 * - Paywalled RPC endpoints requiring micropayments
 * - Dynamic authentication without IPFS storage
 * - JSON-RPC methods on premium infrastructure
 * - Custom authentication schemes
 *
 * Unlike managed updates (which use feed IDs from IPFS), this creates the feed
 * definition on-the-fly and passes authentication dynamically.
 */
(async function main() {
  console.log("🔧 Initializing X402 variable override demo...");

  // Step 1: Load Solana environment configuration (`$ solana config get`)
  const { program, keypair, connection, crossbar } = await sb.AnchorUtils.loadEnv();
  console.log("👤 Wallet:", keypair.publicKey.toBase58());
  console.log("📡 RPC Method:", RPC_METHOD);

  // Step 2: Create Faremeter wallet for X402 payments
  const wallet = await createLocalWallet("mainnet-beta", keypair);

  // Step 3: Configure USDC payment handler
  const paymentHandler = exact.createPaymentHandler(wallet, USDC, connection);
  console.log("💰 Payment token: USDC");

  // Check USDC balance on mainnet
  await checkUsdcBalance(connection, keypair, USDC);

  // Step 4: Initialize X402FetchManager to derive payment headers
  const x402Manager = new X402FetchManager(paymentHandler);
  console.log("🔐 X402 manager initialized");

  // Step 5: Derive X402 payment headers for the paywalled RPC
  // These headers will be passed as variable overrides to the oracle job
  console.log("\n🔑 Deriving X402 payment headers...");
  const paymentHeaders = await x402Manager.derivePaymentHeaders(URL, {
    method: "POST",
    body: buildJsonRpcBody(RPC_METHOD),
  });
  const paymentHeader = paymentHeaders.xPaymentHeader;
  const switchboardPaymentHeader = paymentHeaders.xSwitchboardPayment;
  console.log("✅ X402 payment headers generated");

  // Step 6: Load Switchboard queue
  const queue = await sb.Queue.loadDefault(program!);

  // Step 7: Compute and display the feed ID (hash of the protobuf)
  const feedId = FeedHash.computeOracleFeedId(ORACLE_FEED);
  console.log("🔖 Feed ID:", `0x${feedId.toString("hex")}`);

  // Step 8: Derive the canonical quote account from the feed id
  const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [feedId]);
  console.log("📍 Quote Account:", quoteAccount.toBase58());

  // NOTE: You must not simulate with the same x402 header or you will pay twice!
  // const simFeed = await crossbar.simulateFeed(ORACLE_FEED, true, { X402_PAYMENT_HEADER: paymentHeader });
  // console.log(simFeed);

  // Step 9: Fetch managed update instructions with X402 headers as variable overrides
  console.log("\n📋 Fetching managed update instructions with X402 variable overrides...");
  const instructions = await queue.fetchManagedUpdateIxs(
    crossbar,
    [ORACLE_FEED],
    {
      // NOTE: NUM_SIGNATURES MUST BE 1 FOR x402 REQUESTS
      numSignatures: 1,
      // Pass the X402 payment headers as variable overrides
      // These replace ${X402_PAYMENT_HEADER} and ${X402_SWITCHBOARD_PAYMENT_HEADER} in the job definition
      variableOverrides: {
        X402_PAYMENT_HEADER: paymentHeader,
        X402_SWITCHBOARD_PAYMENT_HEADER: switchboardPaymentHeader,
      },
      instructionIdx: 0,
      payer: keypair.publicKey,
    }
  );

  console.log("✅ Generated instructions:", instructions.length);
  console.log("   - Ed25519 signature verification");
  console.log("   - Quote program verified_update");
  console.log("   - Variable overrides: X402_PAYMENT_HEADER, X402_SWITCHBOARD_PAYMENT_HEADER");

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
