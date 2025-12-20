import { CrossbarClient } from "@switchboard-xyz/common";
import { buildSimpleValueJob } from "./utils/utils";
import * as sb from "@switchboard-xyz/on-demand";
import dotenv from "dotenv";

/**
 * Simple test script demonstrating variable overrides with a value task
 * Run with: TEST_VALUE=12345 bun run scripts/test-simple.ts
 */

const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

(async function main() {
  try {
    dotenv.config();

    const testValue = process.env.TEST_VALUE || "100";
    console.log(`\n🧪 Testing Variable Overrides with value: ${testValue}`);

    const { keypair, connection } = await sb.AnchorUtils.loadEnv();
    const queueAccount = await sb.getDefaultQueue(connection.rpcEndpoint);
    const queue = queueAccount.pubkey;

    // Create job with variable override
    const job = buildSimpleValueJob();
    console.log("\n📋 Job Definition:", JSON.stringify(job.toJSON(), null, 2));

    // Test the variable override functionality
    const feedConfigs = [{
      feed: {
        jobs: [job],
      },
    }];

    console.log("\n🔧 Variable Overrides:", {
      TEST_VALUE: testValue
    });

    // Note: In a real implementation, you would use this with queue.fetchSignaturesConsensus
    // This is a simplified test to demonstrate the job structure
    console.log("\n✅ Variable override job created successfully!");
    console.log("   - Job uses ${TEST_VALUE} placeholder");
    console.log(`   - Will be replaced with: ${testValue}`);
    console.log("   - No secrets management required");

  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }

  process.exit(0);
})();