import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, Aggregator } from "@switchboard-xyz/sui-sdk";
import yargs from "yargs";

const argv = yargs(process.argv)
  .options({
    feedId: {
      type: "string",
      description: "Single feed ID",
    },
    feedIds: {
      type: "string",
      description: "Comma-separated list of feed IDs",
    },
    signAndSend: {
      type: "boolean",
      default: false,
      description: "Sign and send the transaction (requires SUI_PRIVATE_KEY)",
    },
  })
  .parseSync();

async function crossbarUpdate() {
  // Configuration
  const RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
  const CROSSBAR_URL = process.env.CROSSBAR_URL || "https://crossbar.switchboardlabs.xyz";
  const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;

  // Parse feed IDs
  let FEED_IDS: string[] = [];

  if (argv.feedIds) {
    FEED_IDS = argv.feedIds.split(',').map(id => id.trim());
  } else if (argv.feedId) {
    FEED_IDS = [argv.feedId];
  } else if (process.env.FEED_IDS) {
    FEED_IDS = process.env.FEED_IDS.split(',').map(id => id.trim());
  }

  if (FEED_IDS.length === 0) {
    throw new Error("Feed IDs must be provided via --feedId, --feedIds, or FEED_IDS environment variable");
  }

  const SIGN_AND_SEND = argv.signAndSend;

  // Validate signing requirements
  if (SIGN_AND_SEND && !PRIVATE_KEY) {
    throw new Error("SUI_PRIVATE_KEY environment variable is required when using --signAndSend");
  }

  console.log(`Using Crossbar URL: ${CROSSBAR_URL}`);
  console.log(`Updating ${FEED_IDS.length} feed(s):`, FEED_IDS);
  console.log(`Mode: ${SIGN_AND_SEND ? '🔐 Sign and Send Transaction' : '🎯 Simulate Only'}`);

  // Initialize clients
  const suiClient = new SuiClient({ url: RPC_URL });
  const sb = new SwitchboardClient(suiClient);

  // Initialize keypair if signing
  let keypair: Ed25519Keypair | null = null;
  let senderAddress: string | null = null;

  if (SIGN_AND_SEND && PRIVATE_KEY) {
    keypair = Ed25519Keypair.fromSecretKey(PRIVATE_KEY);
    senderAddress = keypair.getPublicKey().toSuiAddress();
    console.log(`Signing address: ${senderAddress}`);
  }

  try {
    // Create transaction with appropriate sender
    const feedTx = new Transaction();
    if (SIGN_AND_SEND && senderAddress) {
      feedTx.setSender(senderAddress);
    } else {
      feedTx.setSender("0x0000000000000000000000000000000000000000000000000000000000000000");
    }

    console.log("\n🔄 Calling Crossbar directly for oracle updates...");

    // Call Crossbar directly using fetchManyUpdateTx
    const startTime = Date.now();
    const oracleResponses = await Aggregator.fetchManyUpdateTx(
      sb,
      FEED_IDS,
      feedTx,
      {
        crossbarUrl: CROSSBAR_URL
      }
    );
    const fetchTime = Date.now() - startTime;

    console.log(`✅ Crossbar call completed in ${fetchTime}ms`);
    console.log(`\nReceived responses for ${oracleResponses.responses?.length || 0} feed(s)`);

    // Process each response
    if (oracleResponses.responses) {
      oracleResponses.responses.forEach((response: any, index: number) => {
        console.log(`\n📊 Feed ${index + 1} (${FEED_IDS[index]}):`);
        console.log(`Queue: ${response.queue}`);
        console.log(`Fee: ${response.fee}`);
        console.log(`Failures: ${response.failures?.length || 0}`);

        if (response.results && Array.isArray(response.results)) {
          response.results.forEach((result: any, resultIndex: number) => {
            console.log(`\n  Oracle Result ${resultIndex + 1}:`);
            if (result.value !== undefined) {
              console.log(`    Value: ${result.value}`);
            }
            if (result.timestamp) {
              console.log(`    Timestamp: ${new Date(result.timestamp * 1000).toISOString()}`);
            }
            // Show full result structure
            console.log(`    Full result:`, JSON.stringify(result, null, 4));
          });
        }

        // Show feed configuration
        if (response.feedConfigs) {
          console.log(`\n  Feed Configuration:`);
          console.log(`    Feed Hash: ${response.feedConfigs.feedHash}`);
          console.log(`    Max Variance: ${response.feedConfigs.maxVariance}`);
          console.log(`    Min Responses: ${response.feedConfigs.minResponses}`);
          console.log(`    Min Sample Size: ${response.feedConfigs.minSampleSize}`);
        }
      });
    }

    // Handle any failures
    if (oracleResponses.failures && oracleResponses.failures.length > 0) {
      console.log(`\n❌ Failed Updates (${oracleResponses.failures.length}):`);
      oracleResponses.failures.forEach((failure: any, index: number) => {
        console.log(`  Failure ${index + 1}:`, failure);
      });
    }

    // Execute or simulate the transaction
    if (SIGN_AND_SEND && keypair) {
      console.log("\n🔐 Signing and sending transaction...");
      try {
        const result = await suiClient.signAndExecuteTransaction({
          signer: keypair,
          transaction: feedTx,
          options: {
            showEffects: true,
            showEvents: true,
            showInput: true,
          },
        });

        console.log(`Transaction result: ${result.effects?.status?.status}`);

        if (result.effects?.status?.status === "success") {
          console.log("✅ Transaction executed successfully!");
          console.log(`Transaction digest: ${result.digest}`);
          console.log("Gas used:", {
            computation: result.effects.gasUsed.computationCost,
            storage: result.effects.gasUsed.storageCost,
            storageRebate: result.effects.gasUsed.storageRebate
          });

          // Show any events emitted
          if (result.events && result.events.length > 0) {
            console.log(`\nEvents emitted (${result.events.length}):`);
            result.events.forEach((event, index) => {
              console.log(`  Event ${index + 1}:`, {
                type: event.type,
                sender: event.sender,
                packageId: event.packageId,
              });
            });
          }

          // Show object changes
          if (result.effects.mutated && result.effects.mutated.length > 0) {
            console.log(`\nObjects updated (${result.effects.mutated.length}):`);
            result.effects.mutated.forEach((obj, index) => {
              console.log(`  Object ${index + 1}: ${obj.reference.objectId}`);
            });
          }

        } else {
          console.log("❌ Transaction execution failed:", result.effects?.status);
        }
      } catch (txError) {
        console.log("❌ Transaction execution error:", txError);
      }
    } else {
      // Simulate the transaction
      console.log("\n🎯 Simulating update transaction...");
      try {
        const dryRunResult = await suiClient.dryRunTransactionBlock({
          transactionBlock: await feedTx.build({ client: suiClient }),
        });

        console.log(`Simulation result: ${dryRunResult.effects.status.status}`);

        if (dryRunResult.effects.status.status === "success") {
          console.log("✅ Transaction simulation successful!");
          console.log("Gas costs:", {
            computation: dryRunResult.effects.gasUsed.computationCost,
            storage: dryRunResult.effects.gasUsed.storageCost,
            storageRebate: dryRunResult.effects.gasUsed.storageRebate
          });
        } else {
          console.log("❌ Transaction simulation failed:", dryRunResult.effects.status);
        }
      } catch (simError) {
        console.log("❌ Could not simulate transaction:", simError);
      }
    }

    // Performance summary
    console.log(`\n📈 Performance Summary:`);
    console.log(`- Feeds requested: ${FEED_IDS.length}`);
    console.log(`- Successful responses: ${oracleResponses.responses?.length || 0}`);
    console.log(`- Failed responses: ${oracleResponses.failures?.length || 0}`);
    console.log(`- Total fetch time: ${fetchTime}ms`);
    console.log(`- Average per feed: ${Math.round(fetchTime / FEED_IDS.length)}ms`);

  } catch (error) {
    console.error("❌ Error calling Crossbar:", error);

    // Show more specific error information if available
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    }

    process.exit(1);
  }
}

// Run the crossbar update example
crossbarUpdate().catch(console.error);
