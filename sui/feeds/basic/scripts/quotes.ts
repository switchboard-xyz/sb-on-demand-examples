/**
 * Switchboard Oracle Quotes Example for Sui
 *
 * This example demonstrates how to fetch oracle quotes on-demand using Switchboard.
 * Oracle Quotes provide zero-setup, on-demand oracle data without managing feed state.
 *
 * For a complete example with Move contract integration and Quote Verifier,
 * see the scripts/run.ts file and the Move source code in sources/example.move
 *
 * Usage:
 *   tsx examples/quotes.ts
 *   tsx examples/quotes.ts --sign  # Sign and send transaction (requires SUI_PRIVATE_KEY)
 *   tsx examples/quotes.ts --feedHash 0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
 *   tsx examples/quotes.ts --network testnet
 */

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, Quote } from "@switchboard-xyz/sui-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .options({
    sign: {
      type: "boolean",
      default: false,
      description: "Sign and send the transaction (requires SUI_PRIVATE_KEY)",
    },
    feedHash: {
      type: "string",
      description: "Feed hash to fetch quotes for (default: BTC/USD)",
      default: "0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812",
    },
    numOracles: {
      type: "number",
      description: "Number of oracles to request data from",
      default: 3,
    },
    network: {
      type: "string",
      description: "Network to use (mainnet or testnet)",
      default: "mainnet",
      choices: ["mainnet", "testnet"],
    },
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function main() {
  console.log("🔮 Switchboard Oracle Quotes Example for Sui\n");
  console.log("Configuration:");
  console.log(`  Network: ${argv.network}`);
  console.log(`  Feed: ${argv.feedHash}`);
  console.log(`  Oracles: ${argv.numOracles}`);
  console.log(`  Mode: ${argv.sign ? "🔐 Sign and Send" : "🎯 Simulate Only"}\n`);

  // Setup clients
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl(argv.network as "mainnet" | "testnet");
  const suiClient = new SuiClient({ url: rpcUrl });
  const sb = new SwitchboardClient(suiClient);

  // Fetch Switchboard state
  console.log("📡 Connecting to Switchboard...");
  const state = await sb.fetchState();
  console.log("✅ Connected to Switchboard");
  console.log(`   Oracle Queue: ${state.oracleQueueId}`);
  console.log(`   Network: ${state.mainnet ? "Mainnet" : "Testnet"}\n`);

  console.log(`🔍 Fetching oracle quotes for feed...`);

  // Create transaction
  const tx = new Transaction();

  // Fetch quotes for the feed using the Quote API
  // This fetches signed oracle data from multiple oracles via Crossbar
  const quotes = await Quote.fetchUpdateQuote(sb, tx, {
    feedHashes: [argv.feedHash],
    numOracles: argv.numOracles,
  });

  console.log("✅ Successfully fetched oracle quotes!\n");

  // In a real application, you would call your Move contract here to verify and use the quotes:
  // 
  // tx.moveCall({
  //   target: 'YOUR_PACKAGE::your_module::update_price',
  //   arguments: [
  //     tx.object(quoteConsumerId),  // Your QuoteConsumer object
  //     quotes,                       // The fetched quotes
  //     tx.pure.vector("u8", feedHashBytes),
  //     tx.object("0x6"),            // Sui Clock
  //   ],
  // });
  //
  // See scripts/run.ts for a complete working example with Move contract integration

  console.log("💡 What you can do with these quotes:");
  console.log("   1. Pass them to a Move contract with a QuoteVerifier");
  console.log("   2. The verifier will check oracle signatures");
  console.log("   3. Validate freshness and price deviation");
  console.log("   4. Use the verified price in your DeFi logic\n");

  if (argv.sign) {
    // Sign and send transaction
    const privateKey = process.env.SUI_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("SUI_PRIVATE_KEY environment variable required for signing");
    }

    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    console.log(`🔐 Signing with address: ${keypair.getPublicKey().toSuiAddress()}`);

    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    await suiClient.waitForTransaction({ digest: result.digest });

    console.log(`\n✅ Transaction successful!`);
    console.log(`   Digest: ${result.digest}`);
    console.log(`   Gas used: ${JSON.stringify(result.effects?.gasUsed, null, 2)}`);
  } else {
    // Simulate transaction
    console.log("🎯 Simulating transaction...");

    // Set a dummy sender for simulation (required by Sui SDK)
    const dummySender = "0x0000000000000000000000000000000000000000000000000000000000000000";
    tx.setSender(dummySender);

    const result = await suiClient.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: suiClient }),
    });

    if (result.effects.status.status === "success") {
      console.log("✅ Simulation successful!");
      console.log(`   Gas cost: ${JSON.stringify(result.effects.gasUsed, null, 2)}`);
    } else {
      console.error("❌ Simulation failed:", result.effects.status);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📚 Next Steps:");
  console.log("=".repeat(80));
  console.log("\n1. Deploy the example contract:");
  console.log("   sui client publish --gas-budget 100000000\n");
  console.log("2. Run the complete example with Move integration:");
  console.log("   EXAMPLE_PACKAGE_ID=0xYOUR_PACKAGE_ID npm run example\n");
  console.log("3. See sources/example.move for the Move contract code");
  console.log("4. See scripts/run.ts for the complete TypeScript example\n");
}

main().catch(console.error);
