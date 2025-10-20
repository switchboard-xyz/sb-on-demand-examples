import { PublicKey } from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";
import { createLocalWallet } from "@faremeter/wallet-solana";
import { exact } from "@faremeter/payment-solana";
import { X402FetchManager } from "@switchboard-xyz/x402-utils";
import yargs from "yargs";

const argv = yargs(process.argv)
  .options({
    rpcUrl: {
      type: "string",
      default: "https://helius.api.corbits.dev",
      description: "The X402-enabled paywalled RPC URL",
    },
    method: {
      type: "string",
      default: "getBlockHeight",
      description: "The RPC method to call",
    },
  })
  .parseSync();

/**
 * X402 Paywalled RPC Example
 *
 * This example demonstrates how to interact with X402-enabled paywalled RPC endpoints
 * using Switchboard's X402FetchManager and Faremeter payment infrastructure. It shows how to:
 *
 * 1. Create a Solana wallet for payment authorization
 * 2. Configure USDC payment handler for exact payments
 * 3. Initialize X402FetchManager to handle payment headers
 * 4. Fetch X402 payment requirements from the paywalled endpoint (returns an `accepts` array)
 * 5. Derive and attach payment headers to RPC requests
 * 6. Execute paywalled RPC calls with automatic payment handling
 *
 * The X402 payment protocol enables:
 * - Micropayments for individual RPC requests
 * - Automatic payment header generation and signing
 * - Transparent integration with existing RPC workflows
 * - USDC-based exact payment handling
 * - Pay-per-use access to premium RPC infrastructure
 */
(async function main() {
  try {
    console.log("🔧 Initializing X402 payment demo...");

    // Step 1: Load Solana environment configuration using AnchorUtils
    const { keypair, connection } = await sb.AnchorUtils.loadEnv();
    console.log("👤 Wallet:", keypair.publicKey.toBase58());

    // Step 2: Create Faremeter wallet from keypair
    // This wallet handles payment signing and authorization
    const wallet = await createLocalWallet("mainnet-beta", keypair);

    // Step 3: Configure USDC payment handler
    // USDC mint address on Solana mainnet
    const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const paymentHandler = exact.createPaymentHandler(wallet, usdcMint, connection);
    console.log("💰 Payment token: USDC");

    // Step 4: Initialize X402FetchManager
    // This manager handles payment header derivation and X402 protocol
    const x402Manager = new X402FetchManager(paymentHandler);
    console.log("🔐 X402 manager initialized");

    // Step 5: Configure the paywalled RPC request
    const paywalledRpcUrl = argv.rpcUrl;
    console.log("🌐 Paywalled RPC:", paywalledRpcUrl);
    console.log("📡 RPC method:", argv.method);

    const params = {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: argv.method
      }),
    };

    // Step 6: Fetch X402 payment information
    // This retrieves the payment requirements from the paywalled endpoint
    console.log("\n📋 Fetching X402 payment info...");
    const x402Info = await x402Manager.fetchX402Info(paywalledRpcUrl, params);

    const paymentDetails = x402Info.accepts[0];
    console.log("Payment required:", {
      scheme: paymentDetails.scheme,
      network: paymentDetails.network,
      resource: paymentDetails.resource,
      payTo: paymentDetails.payTo,
      maxAmountRequired: paymentDetails.maxAmountRequired,
      asset: paymentDetails.asset,
      description: paymentDetails.description,
      extra: paymentDetails.extra,
    });

    // Step 7: Derive payment header
    // The X402FetchManager creates a signed payment authorization header
    console.log("\n🔑 Deriving payment header...");
    const header = await x402Manager.derivePaymentHeader(paywalledRpcUrl, params);

    // Step 8: Execute the paywalled RPC request
    // Include the X-PAYMENT header to authorize the request
    console.log("\n🚀 Executing paywalled RPC call...");
    const response = await fetch(paywalledRpcUrl, {
      ...params,
      headers: {
        'X-PAYMENT': header,
        'Content-Type': 'application/json',
      },
    });

    // Step 9: Process and display results
    if (!response.ok) {
      console.error("❌ Request failed:", response.status, response.statusText);
      return;
    }

    const result = await response.json();
    console.log("\n✅ RPC Response:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
