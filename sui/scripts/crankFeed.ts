import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, Aggregator } from "@switchboard-xyz/sui-sdk";
import yargs from "yargs";

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
  // Configuration
  const RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
  const FEED_ID = argv.feedId;

  // Initialize clients
  const suiClient = new SuiClient({ url: RPC_URL });

  // Initialize Switchboard client
  const sb = new SwitchboardClient(suiClient);

  try {
    // Load the aggregator (feed)
    const aggregator = new Aggregator(sb, FEED_ID);

    // Create transaction to simulate feed update with a dummy sender
    const transaction = new Transaction();
    transaction.setSender("0x0000000000000000000000000000000000000000000000000000000000000000");

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

    // Simulate the transaction instead of executing
    console.log("Simulating feed update transaction...");
    const dryRunResult = await suiClient.dryRunTransactionBlock({
      transactionBlock: await transaction.build({ client: suiClient }),
    });

    console.log("Simulation result:", dryRunResult.effects.status);

    if (dryRunResult.effects.status.status === "success") {
      console.log("✅ Feed update simulation successful!");
      console.log("Gas used:", dryRunResult.effects.gasUsed);

    } else {
      console.log("❌ Feed update simulation failed:", dryRunResult.effects.status);
    }

  } catch (error) {
    console.error("Error processing feed:", error);
    process.exit(1);
  }
}

// Run the example
crankFeed().catch(console.error);
