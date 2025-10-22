import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, Aggregator } from "@switchboard-xyz/sui-sdk";
import yargs from "yargs";

const argv = yargs(process.argv)
  .options({
    signAndSend: {
      type: "boolean",
      default: false,
      description: "Sign and send the transaction (requires SUI_PRIVATE_KEY)",
    },
    details: {
      type: "boolean",
      default: false,
      description: "Show detailed output for each feed",
    },
  })
  .parseSync();

async function simulateAllFeeds() {
  // Predefined aggregator IDs for simulation
  const aggregatorIds = [
    '0x8b8730df2806ff5ed076b51a048e0cf8c87300538ec21cd80f10ebc5cbc8b19e',
    '0x1be91ae8a4d306c06afba46c4a2aa8331cf1daea6b0c3dddb3f2b3f29009418e',
    '0x247d69bdadebfd64e1ed0eadb7c7a5338f2a1445791bd8a6a24466d7cab5f107',
    '0x0c9a07f75b227e167320781402ba6398a544574704a6f50ad62ccdba3bfbe1eb',
    '0x48727126e6c3ed52d42907039b0e0094eab4ec24f89251a13a104c4313f7b63a',
    '0x5b47660ea50f7ee2c418814a1bff81184df2f932808999b4a500ae44cf3dcb6d',
    '0xd27352c27ac9b2344bb23bdd94e7a877bc371c0838e905638fb457d83ad0f28b',
    '0x5ee2c1d96519c02ac18f8e67007532526ba4d01a582c71bd638efdd36b12c481',
    '0x6fad8b69ab1d9550302c610e5a0ffcb81c1e2b218ff05b6ea6cdd236b5963346',
  ];

  // Configuration
  const RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
  const CROSSBAR_URL = process.env.CROSSBAR_URL || "https://crossbar.switchboardlabs.xyz";
  const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;

  const SIGN_AND_SEND = argv.signAndSend;
  const SHOW_DETAILS = argv.details;

  // Validate signing requirements
  if (SIGN_AND_SEND && !PRIVATE_KEY) {
    throw new Error("SUI_PRIVATE_KEY environment variable is required when using --signAndSend");
  }

  console.log(`🚀 Simulating All Switchboard Feeds on Sui`);
  console.log(`Using Crossbar URL: ${CROSSBAR_URL}`);
  console.log(`Total feeds to process: ${aggregatorIds.length}`);
  console.log(`Mode: ${SIGN_AND_SEND ? '🔐 Sign and Send Transaction' : '🎯 Simulate Only'}`);
  console.log(`Details: ${SHOW_DETAILS ? '📝 Detailed Output' : '📊 Summary Only'}`);
  console.log('─'.repeat(80));

  // Initialize clients
  const suiClient = new SuiClient({ url: RPC_URL });
  const sb = new SwitchboardClient(suiClient);

  // Initialize keypair if signing
  let keypair: Ed25519Keypair | null = null;
  let senderAddress: string | null = null;

  if (SIGN_AND_SEND && PRIVATE_KEY) {
    keypair = Ed25519Keypair.fromSecretKey(PRIVATE_KEY);
    senderAddress = keypair.getPublicKey().toSuiAddress();
    console.log(`Signing address: ${senderAddress}\n`);
  }

  try {
    // Create transaction with appropriate sender
    const feedTx = new Transaction();
    if (SIGN_AND_SEND && senderAddress) {
      feedTx.setSender(senderAddress);
    } else {
      feedTx.setSender("0x0000000000000000000000000000000000000000000000000000000000000000");
    }

    console.log("🔄 Calling Crossbar for all feeds...");
    const startTime = Date.now();

    // Call Crossbar directly using fetchManyUpdateTx
    const oracleResponses = await Aggregator.fetchManyUpdateTx(
      sb,
      aggregatorIds,
      feedTx,
      {
        crossbarUrl: CROSSBAR_URL
      }
    );

    const fetchTime = Date.now() - startTime;
    console.log(`✅ Crossbar call completed in ${fetchTime}ms\n`);

    // Process results
    const successCount = oracleResponses.responses?.length || 0;
    const failureCount = oracleResponses.failures?.length || 0;

    console.log(`📈 Results Summary:`);
    console.log(`- Total feeds requested: ${aggregatorIds.length}`);
    console.log(`- Successful responses: ${successCount}`);
    console.log(`- Failed responses: ${failureCount}`);
    console.log(`- Success rate: ${((successCount / aggregatorIds.length) * 100).toFixed(1)}%`);
    console.log(`- Average fetch time per feed: ${Math.round(fetchTime / aggregatorIds.length)}ms\n`);

    // Show detailed results if requested
    if (SHOW_DETAILS && oracleResponses.responses) {
      console.log("📊 Detailed Feed Results:");
      console.log('─'.repeat(80));

      oracleResponses.responses.forEach((response: any, index: number) => {
        console.log(`\n${index + 1}. Feed: ${aggregatorIds[index]}`);
        console.log(`   Queue: ${response.queue || 'N/A'}`);
        console.log(`   Fee: ${response.fee || 0}`);
        console.log(`   Failures: ${response.failures?.length || 0}`);

        if (response.results && Array.isArray(response.results)) {
          response.results.forEach((result: any, resultIndex: number) => {
            if (result.value !== undefined) {
              console.log(`   Oracle ${resultIndex + 1} Value: ${result.value}`);
            }
            if (result.timestamp) {
              console.log(`   Oracle ${resultIndex + 1} Time: ${new Date(result.timestamp * 1000).toISOString()}`);
            }
          });
        }

        if (response.feedConfigs) {
          console.log(`   Config: variance=${response.feedConfigs.maxVariance}, minResponses=${response.feedConfigs.minResponses}`);
        }
      });

      console.log('\n' + '─'.repeat(80));
    }

    // Show failures if any
    if (failureCount > 0 && oracleResponses.failures) {
      console.log(`\n❌ Failed Feeds (${failureCount}):`);
      oracleResponses.failures.forEach((failure: any, index: number) => {
        console.log(`  ${index + 1}. ${JSON.stringify(failure)}`);
      });
    }

    // Execute or simulate the transaction
    if (SIGN_AND_SEND && keypair) {
      console.log("\n🔐 Signing and sending batch transaction...");
      try {
        const result = await suiClient.signAndExecuteTransaction({
          signer: keypair,
          transaction: feedTx,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });

        console.log(`Transaction result: ${result.effects?.status?.status}`);

        if (result.effects?.status?.status === "success") {
          console.log("✅ Batch transaction executed successfully!");
          console.log(`Transaction digest: ${result.digest}`);
          console.log("Gas used:", {
            computation: result.effects.gasUsed.computationCost,
            storage: result.effects.gasUsed.storageCost,
            storageRebate: result.effects.gasUsed.storageRebate
          });

          if (result.effects.mutated && result.effects.mutated.length > 0) {
            console.log(`\nFeed objects updated: ${result.effects.mutated.length}`);
            if (SHOW_DETAILS) {
              result.effects.mutated.forEach((obj, index) => {
                console.log(`  ${index + 1}. ${obj.reference.objectId}`);
              });
            }
          }
        } else {
          console.log("❌ Batch transaction failed:", result.effects?.status);
        }
      } catch (txError) {
        console.log("❌ Transaction execution error:", txError);
      }
    } else {
      // Simulate the transaction
      console.log("\n🎯 Simulating batch transaction...");
      try {
        const dryRunResult = await suiClient.dryRunTransactionBlock({
          transactionBlock: await feedTx.build({ client: suiClient }),
        });

        console.log(`Simulation result: ${dryRunResult.effects.status.status}`);

        if (dryRunResult.effects.status.status === "success") {
          console.log("✅ Batch simulation successful!");
          console.log("Estimated gas costs:", {
            computation: dryRunResult.effects.gasUsed.computationCost,
            storage: dryRunResult.effects.gasUsed.storageCost,
            storageRebate: dryRunResult.effects.gasUsed.storageRebate
          });

          // Calculate total estimated cost
          const totalCost = BigInt(dryRunResult.effects.gasUsed.computationCost) +
                          BigInt(dryRunResult.effects.gasUsed.storageCost) -
                          BigInt(dryRunResult.effects.gasUsed.storageRebate);
          console.log(`Total estimated cost: ${totalCost} MIST`);

        } else {
          console.log("❌ Batch simulation failed:", dryRunResult.effects.status);
        }
      } catch (simError) {
        console.log("❌ Could not simulate transaction:", simError);
      }
    }

    // Final performance summary
    console.log(`\n🏁 Final Summary:`);
    console.log(`- Feeds processed: ${aggregatorIds.length}`);
    console.log(`- Oracle responses received: ${successCount}`);
    console.log(`- Total processing time: ${fetchTime}ms`);
    console.log(`- Throughput: ${(aggregatorIds.length / (fetchTime / 1000)).toFixed(2)} feeds/second`);

  } catch (error) {
    console.error("\n❌ Error during batch simulation:", error);
    process.exit(1);
  }
}

// Run the simulation
console.log("Starting batch feed simulation...\n");
simulateAllFeeds().catch(console.error);