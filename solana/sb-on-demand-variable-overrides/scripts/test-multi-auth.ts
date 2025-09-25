import { CrossbarClient } from "@switchboard-xyz/common";
import { buildMultiAuthJob } from "./utils";
import * as sb from "@switchboard-xyz/on-demand";
import dotenv from "dotenv";

/**
 * Test script demonstrating variable overrides with multiple authentication headers
 * Run with: AUTH_TOKEN=your_token API_KEY=your_key bun run scripts/test-multi-auth.ts
 */

const crossbarClient = new CrossbarClient(
  "https://crossbar.switchboard.xyz",
  /* verbose= */ true
);

(async function main() {
  try {
    dotenv.config();

    const authToken = process.env.AUTH_TOKEN;
    const apiKey = process.env.API_KEY;

    if (!authToken || !apiKey) {
      console.log("\n⚠️  Warning: AUTH_TOKEN and API_KEY environment variables are recommended");
      console.log("   Run with: AUTH_TOKEN=your_token API_KEY=your_key bun run scripts/test-multi-auth.ts");
    }

    console.log("\n🧪 Testing Multi-Authentication Variable Overrides");

    const { keypair, connection } = await sb.AnchorUtils.loadEnv();
    const queueAccount = await sb.getDefaultQueue(connection.rpcEndpoint);
    const queue = queueAccount.pubkey;

    // Create job with multiple auth variable overrides
    const job = buildMultiAuthJob();
    console.log("\n📋 Job Definition:", JSON.stringify(job.toJSON(), null, 2));

    const variableOverrides = {
      "AUTH_TOKEN": authToken || "demo_auth_token",
      "API_KEY": apiKey || "demo_api_key"
    };

    console.log("\n🔧 Variable Overrides:");
    console.log("   AUTH_TOKEN:", authToken ? "***" : "demo_auth_token");
    console.log("   API_KEY:", apiKey ? "***" : "demo_api_key");

    // Note: In a real implementation, you would use this with queue.fetchSignaturesConsensus
    console.log("\n✅ Multi-auth variable override job created successfully!");
    console.log("   - Uses ${AUTH_TOKEN} and ${API_KEY} placeholders");
    console.log("   - All data sources and paths are hardcoded for verifiability");
    console.log("   - Only authentication credentials use variable substitution");
    console.log("   - No secrets management infrastructure required");

  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }

  process.exit(0);
})();