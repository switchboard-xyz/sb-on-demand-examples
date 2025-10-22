import { Aggregator } from "@switchboard-xyz/sui-sdk";
import yargs from "yargs";
import { loadConfig } from "./utils/config";
import { initializeClients } from "./utils/clients";
import { createTransaction, simulateTransaction } from "./utils/transaction";

const argv = yargs(process.argv)
  .options({
    feedId: {
      type: "string",
      required: true,
      description: "The feed ID to crank",
    },
  })
  .parseSync();

async function crankFeed() {
  // Load configuration
  const config = loadConfig();

  // Initialize clients
  const { suiClient, sb } = initializeClients(config.rpcUrl);

  try {
    // Load the aggregator (feed)
    const aggregator = new Aggregator(sb, argv.feedId);

    // Create transaction to simulate feed update with a dummy sender
    const transaction = createTransaction(false);

    // Add update instruction to transaction
    const updateResponse = await aggregator.fetchUpdateTx(transaction);

    // Try to extract the new price from the response
    if (updateResponse && typeof updateResponse === 'object') {
      const newPrice = updateResponse.price || updateResponse.value || updateResponse.result;
      if (newPrice) {
        console.log("🔄 New price from fetchUpdateTx:", newPrice);
      }

      // Look for oracle responses
      if (updateResponse.responses) {
        updateResponse.responses.forEach((response: any, index: number) => {
          console.log(`Oracle ${index + 1}:`);
          console.log("Full response:", JSON.stringify(response, null, 2));

          if (response.results && Array.isArray(response.results)) {
            console.log(`Oracle ${index + 1} results:`);
            response.results.forEach((result: any, resultIndex: number) => {
              console.log(`  Result ${resultIndex}:`, JSON.stringify(result, null, 2));
            });
          }
        });
      }
    }

    // Simulate the transaction
    await simulateTransaction(suiClient, transaction);

  } catch (error) {
    console.error("Error processing feed:", error);
    process.exit(1);
  }
}

// Run the example
crankFeed().catch(console.error);
