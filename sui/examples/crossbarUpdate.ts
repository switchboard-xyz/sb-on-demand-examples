import { Aggregator } from "@switchboard-xyz/sui-sdk";
import yargs from "yargs";
import { loadConfig, validateConfig } from "./utils/config";
import { initializeClients, initializeKeypair } from "./utils/clients";
import { createTransaction, executeOrSimulate } from "./utils/transaction";

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
  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config, {
    requirePrivateKey: argv.signAndSend,
  });

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

  console.log(`Using Crossbar URL: ${config.crossbarUrl}`);
  console.log(`Updating ${FEED_IDS.length} feed(s):`, FEED_IDS);
  console.log(`Mode: ${argv.signAndSend ? '🔐 Sign and Send Transaction' : '🎯 Simulate Only'}`);

  // Initialize clients
  const { suiClient, sb } = initializeClients(config.rpcUrl);

  // Initialize keypair if signing
  let keypair = null;
  let senderAddress = undefined;

  if (argv.signAndSend && config.privateKey) {
    const keypairInfo = initializeKeypair(config.privateKey);
    keypair = keypairInfo.keypair;
    senderAddress = keypairInfo.address;
    console.log(`Signing address: ${senderAddress}`);
  }

  try {
    // Create transaction with appropriate sender
    const feedTx = createTransaction(argv.signAndSend, senderAddress);

    console.log("\n🔄 Calling Crossbar directly for oracle updates...");

    // Call Crossbar directly using fetchManyUpdateTx
    const startTime = Date.now();
    const oracleResponses = await Aggregator.fetchManyUpdateTx(
      sb,
      FEED_IDS,
      feedTx,
      {
        crossbarUrl: config.crossbarUrl
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
    await executeOrSimulate(suiClient, feedTx, argv.signAndSend, keypair, { showDetails: true });

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
