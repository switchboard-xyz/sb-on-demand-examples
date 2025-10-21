import { PublicKey, Connection } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import { CrossbarClient, FeedHash, IOracleFeed, OracleJob } from "@switchboard-xyz/common";
import { createLocalWallet } from "@faremeter/wallet-solana";
import { exact } from "@faremeter/payment-solana";
import { X402FetchManager } from "@switchboard-xyz/x402-utils";
import yargs from "yargs";
import { TX_CONFIG, loadBasicProgram, basicReadOracleIx } from "../utils";

const argv = yargs(process.argv)
  .options({
    url: {
      type: "string",
      default: "https://helius.api.corbits.dev",
      description: "The X402-enabled paywalled RPC URL",
    },
    method: {
      type: "string",
      default: "getBlockHeight",
      description: "The JSON-RPC method to call",
    },
  })
  .parseSync();

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
            url: argv.url,
            method: OracleJob.HttpTask.Method.METHOD_POST,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: argv.method,
            }),
            headers: [
              {
                key: "X-PAYMENT",
                // Use variable placeholder - will be replaced by variable override
                value: "${X402_PAYMENT_HEADER}",
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
  try {
    console.log("🔧 Initializing X402 variable override demo...");

    // Step 1: Load Solana environment configuration
    const { program, keypair, connection, crossbar } = await sb.AnchorUtils.loadEnv();
    console.log("👤 Wallet:", keypair.publicKey.toBase58());
    console.log("📡 RPC Method:", argv.method);

    // Step 2: Create Faremeter wallet for X402 payments
    const wallet = await createLocalWallet("mainnet-beta", keypair);

    // Step 3: Configure USDC payment handler
    const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const mainnetConnection = new Connection("https://api.mainnet-beta.solana.com");
    const paymentHandler = exact.createPaymentHandler(wallet, usdcMint, mainnetConnection);
    console.log("💰 Payment token: USDC");

    // Step 4: Initialize X402FetchManager to derive payment headers
    const x402Manager = new X402FetchManager(paymentHandler);
    console.log("🔐 X402 manager initialized");

    // Step 5: Derive X402 payment header for the paywalled RPC
    // This header will be passed as a variable override to the oracle job
    console.log("\n🔑 Deriving X402 payment header...");
    const paymentHeader = await x402Manager.derivePaymentHeader(argv.url, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: argv.method,
      }),
    });
    console.log("✅ X402 payment header generated");

    // Step 6: Load Switchboard queue
    const queue = await sb.Queue.loadDefault(program!);

    // Step 7: Compute and display the feed ID (hash of the protobuf)
    const feedId = FeedHash.computeOracleFeedId(ORACLE_FEED);
    console.log("🔖 Feed ID:", `0x${feedId.toString("hex")}`);

    // Step 8: Derive the canonical quote account from feed hash
    const [quoteAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [feedId]);
    console.log("📍 Quote Account:", quoteAccount.toBase58());

    // Step 9: Fetch managed update instructions with X402 header as variable override
    console.log("\n📋 Fetching managed update instructions with X402 variable override...");
    const instructions = await queue.fetchManagedUpdateIxs(
      crossbar,
      [ORACLE_FEED],
      {
        numSignatures: 1,
        // Pass the X402 payment header as a variable override
        // This replaces ${X402_PAYMENT_HEADER} in the job definition
        variableOverrides: {
          X402_PAYMENT_HEADER: paymentHeader,
        },
        instructionIdx: 0,
        payer: keypair.publicKey,
      }
    );

    console.log("✅ Generated instructions:", instructions.length);
    console.log("   - Ed25519 signature verification");
    console.log("   - Quote program verified_update");
    console.log("   - Variable override: X402_PAYMENT_HEADER");

    // Step 10: Load basic program and create read instruction
    const basicProgram = await loadBasicProgram(program!.provider);
    const readOracleIx = await basicReadOracleIx(
      basicProgram,
      quoteAccount,
      queue.pubkey,
      keypair.publicKey
    );

    // Step 11: Build and simulate transaction
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
      return;
    }

    console.log("\n✅ Simulation succeeded!");
    console.log("\n💡 Key Takeaways:");
    console.log("   • Feed defined inline (not stored on IPFS)");
    console.log("   • X402 header passed via variable override");
    console.log("   • Oracle authenticated with paywalled RPC");
    console.log("   • Data stored in quote account");

  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("\nStack:", error.stack);
    }
    process.exit(1);
  }
})();
