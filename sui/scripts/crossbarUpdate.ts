import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, Aggregator } from "@switchboard-xyz/sui-sdk";

async function crossbarUpdate() {
  // Configuration
  const RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
  const CROSSBAR_URL = process.env.CROSSBAR_URL || "https://crossbar.switchboard.xyz";

  // Parse command line arguments for feed IDs
  let FEED_IDS: string[] = [];

  // Check for --feedIds flag (comma-separated)
  const feedIdsIndex = process.argv.findIndex(arg => arg === '--feedIds');
  if (feedIdsIndex !== -1 && process.argv[feedIdsIndex + 1]) {
    FEED_IDS = process.argv[feedIdsIndex + 1].split(',').map(id => id.trim());
  } else if (process.env.FEED_IDS) {
    FEED_IDS = process.env.FEED_IDS.split(',').map(id => id.trim());
  } else if (process.argv[2]) {
    // Single feed ID as argument
    FEED_IDS = [process.argv[2]];
  }

  if (FEED_IDS.length === 0) {
    throw new Error("FEED_IDS must be provided as environment variable (comma-separated) or --feedIds flag");
  }

  console.log(`Using Crossbar URL: ${CROSSBAR_URL}`);
  console.log(`Updating ${FEED_IDS.length} feed(s):`, FEED_IDS);

  // Initialize clients
  const suiClient = new SuiClient({ url: RPC_URL });
  const sb = new SwitchboardClient(suiClient);

  try {
    // Create transaction with dummy sender for simulation
    const feedTx = new Transaction();
    feedTx.setSender("0x0000000000000000000000000000000000000000000000000000000000000000");

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