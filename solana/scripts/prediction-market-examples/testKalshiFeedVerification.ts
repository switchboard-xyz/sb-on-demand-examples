#!/usr/bin/env bun

/**
 * Kalshi Feed Verification Test
 *
 * This example demonstrates how to verify the contents of a Switchboard oracle feed
 * on-chain using the prediction market program. The key insight is that feed IDs are
 * deterministic - they are derived by hashing the feed configuration (proto).
 *
 * Purpose:
 * --------
 * Before trusting oracle data in your program, you should verify that the oracle is
 * using the exact feed configuration you expect. This prevents attacks where a malicious
 * actor could create a different feed with a similar name but different data sources.
 *
 * How it works:
 * -------------
 * 1. Create an oracle feed definition with specific tasks (KalshiApiTask, JsonParseTask)
 * 2. Store the feed on IPFS and get the deterministic feed ID (hash of the proto)
 * 3. Crank the oracle to fetch fresh data
 * 4. Use the on-chain program to verify the feed ID matches expected configuration
 *
 * The on-chain verification recreates the feed proto from known parameters (order ID,
 * API key ID) and hashes it to verify it matches the feed ID extracted from the oracle.
 *
 * Usage:
 * ------
 *   bun run scripts/prediction-market-examples/testKalshiFeedVerification.ts \
 *     --api-key-id YOUR_KALSHI_API_KEY_ID \
 *     --private-key-path /path/to/kalshi/private-key.pem \
 *     --order-id KALSHI_ORDER_ID
 *
 * Example:
 * --------
 *   bun run scripts/prediction-market-examples/testKalshiFeedVerification.ts \
 *     --api-key-id abc123 \
 *     --private-key-path ~/.kalshi/key.pem \
 *     --order-id 12345678-1234-1234-1234-123456789012
 */

import { CrossbarClient } from "@switchboard-xyz/common";
import * as sb from "@switchboard-xyz/on-demand";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as crypto from "crypto";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as pathModule from "path";
import { TX_CONFIG, myAnchorProgram, PREDICTION_MARKET_PROGRAM_PATH } from "../utils";

interface Arguments {
  apiKeyId: string;
  privateKeyPath: string;
  crossbarUrl: string;
  orderId: string;
}

const argv = yargs(hideBin(process.argv))
  .option("api-key-id", {
    alias: "k",
    type: "string",
    description: "Kalshi API Key ID",
    demandOption: true,
  })
  .option("private-key-path", {
    alias: "p",
    type: "string",
    description: "Path to the private key PEM file",
    demandOption: true,
  })
  .option("order-id", {
    alias: "o",
    type: "string",
    description: "Kalshi Order ID to verify",
    demandOption: true,
  })
  .option("crossbar-url", {
    alias: "u",
    type: "string",
    description: "Crossbar server URL",
    default: "https://crossbar.switchboardlabs.xyz",
  })
  .example(
    "$0 -k <api-key-id> -p /path/to/key.pem -o <order-id>",
    "Verify Kalshi feed on-chain"
  )
  .help()
  .alias("help", "h")
  .parseSync() as Arguments;

const PROGRAM_ID = new PublicKey(
  "5VjqP71zWPGc169ogvSphDG4tS2zdJ3qoiB6XTghmH1r"
);

function validatePrivateKeyPath(keyPath: string): void {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Private key file not found: ${keyPath}`);
  }
}

function loadPrivateKey(keyPath: string): crypto.KeyObject {
  const privateKeyPem = fs.readFileSync(keyPath, "utf8");
  return crypto.createPrivateKey(privateKeyPem);
}

function createSignature(
  privateKey: crypto.KeyObject,
  timestamp: string,
  method: string,
  path: string
): string {
  const message = `${timestamp}${method}${path}`;
  const messageBuffer = Buffer.from(message, "utf8");

  const signature = crypto.sign("sha256", messageBuffer, {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return signature.toString("base64");
}

(async function main() {
  try {
    console.log("🔍 Kalshi Feed Verification Test");
    console.log("==================================\n");

    // Step 1: Setup and validate inputs
    validatePrivateKeyPath(argv.privateKeyPath);

    const privateKey = loadPrivateKey(argv.privateKeyPath);
    const timestamp = Date.now().toString();
    const method = "GET";
    const path = `/trade-api/v2/portfolio/orders/${argv.orderId}`;
    const signature = createSignature(privateKey, timestamp, method, path);
    const url = `https://api.elections.kalshi.com${path}`;

    console.log("📋 Configuration:");
    console.log(`  🔑 API Key ID: ${argv.apiKeyId}`);
    console.log(`  📋 Order ID: ${argv.orderId}`);
    console.log(`  🌐 Crossbar URL: ${argv.crossbarUrl}`);
    console.log(`  ⏰ Timestamp: ${timestamp}\n`);

    // Step 2: Load Switchboard environment
    const { program: anchorProgram, keypair, connection } =
      await sb.AnchorUtils.loadEnv();
    const queue = await sb.Queue.loadDefault(anchorProgram!);

    console.log("🔧 Solana Configuration:");
    console.log(`  Wallet: ${keypair.publicKey.toBase58()}`);
    console.log(`  Queue: ${queue.pubkey.toBase58()}\n`);

    // Step 3: Create the oracle feed definition
    console.log("📝 Creating Oracle Feed Definition...");

    const oracleFeed = {
      name: "Kalshi Order Price",
      minJobResponses: 1,
      minOracleSamples: 1,
      maxJobRangePct: 0,
      jobs: [
        {
          tasks: [
            {
              kalshiApiTask: {
                url,
                apiKeyId: "${KALSHI_API_KEY_ID}",
                signature: "${KALSHI_SIGNATURE}",
                timestamp: "${KALSHI_TIMESTAMP}",
              },
            },
            {
              jsonParseTask: {
                path: "$.order.yes_price_dollars",
              },
            },
          ],
        },
      ],
    };

    // Step 4: Test feed simulation with Crossbar
    console.log("🧪 Simulating Feed with Crossbar...");

    const crossbar = new CrossbarClient(argv.crossbarUrl);
    const simulation = await crossbar.simulateFeed(oracleFeed, true, {
      KALSHI_SIGNATURE: signature,
      KALSHI_TIMESTAMP: timestamp,
      KALSHI_API_KEY_ID: argv.apiKeyId,
    });

    console.log("  ✅ Simulation Result:");
    console.log(`    Response: ${JSON.stringify(simulation)}...\n`);

    const quoteIx = await queue.fetchQuoteIx(
      crossbar,
      [oracleFeed],
      {
        numSignatures: 1,
        variableOverrides: {
          KALSHI_SIGNATURE: signature,
          KALSHI_TIMESTAMP: timestamp,
          KALSHI_API_KEY_ID: argv.apiKeyId,
        },
        instructionIdx: 0,
        payer: keypair.publicKey,
      }
    );
    console.log("  ✅ Oracle Cranked\n");

    const testProgram = await myAnchorProgram(
      anchorProgram!.provider,
      PREDICTION_MARKET_PROGRAM_PATH);

    const verifyKalshiIx = await testProgram.methods
      .verifyKalshiFeed(argv.orderId)
    .accounts({
      queue: queue.pubkey,
      slothashSysvar: sb.SYSVAR_SLOTHASHES_PUBKEY,
      instructionSysvar: sb.SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

    const tx = await sb.asV0Tx({
      connection,
      ixs: [quoteIx, verifyKalshiIx],
      signers: [keypair],
      computeUnitPrice: 20_000,
      computeUnitLimitMultiple: 1.1,
    });

    const sim = await connection.simulateTransaction(tx);
    console.log("  ✅ Transaction Simulated\n");
    console.log("📝 Transaction Simulation Logs:");
    console.log(JSON.stringify(sim, null, 2), "\n");
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      if (error.stack) {
        console.error("Stack:", error.stack);
      }
    }
    process.exit(1);
  }
})();
