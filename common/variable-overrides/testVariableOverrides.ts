import { CrossbarClient, OracleJob } from "@switchboard-xyz/common";
import dotenv from "dotenv";

/**
 * Chain-agnostic example demonstrating variable overrides with Crossbar simulation
 *
 * Run with: POLYGON_API_KEY=your_key bun run testVariableOverrides.ts
 *
 * Get your API key from: https://polygon.io/
 */

/**
 * Builds an Oracle job using variable overrides for API authentication.
 *
 * Following security best practices:
 * - ✅ Only use variables for API keys/authentication
 * - ✅ Hardcode all data sources, paths, and parameters
 * - ✅ Ensure feed verifiability by making data extraction deterministic
 */
function buildPolygonAuthJob(): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          // ✅ Hardcoded endpoint - verifiable data source
          url: "https://api.polygon.io/v2/last/trade/AAPL",
          method: "GET",
          headers: [
            {
              key: "Authorization",
              value: "Bearer ${POLYGON_API_KEY}",
            },
          ],
        },
      },
      {
        jsonParseTask: {
          // ✅ Hardcoded path - verifiable data extraction
          path: "$.results[0].p",
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

async function main() {
  try {
    dotenv.config();

    // Check for required API key
    if (!process.env.POLYGON_API_KEY) {
      console.error("❌ Error: POLYGON_API_KEY environment variable is required");
      console.error("\nGet your API key from: https://polygon.io/");
      console.error("Then run: POLYGON_API_KEY=your_key bun run testVariableOverrides.ts");
      process.exit(1);
    }

    const crossbarUrl = process.env.CROSSBAR_URL || "https://crossbar.switchboard.xyz";
    const crossbarClient = new CrossbarClient(crossbarUrl);

    console.log("🧪 Variable Overrides Example\n");
    console.log("📊 Fetching AAPL stock price from Polygon.io");
    console.log("🔐 Using variable override for API authentication\n");

    // Build oracle job with API key placeholder
    const job = buildPolygonAuthJob();

    console.log("📋 Job Definition:");
    console.log(JSON.stringify(job.toJSON(), null, 2));
    console.log("\n🔑 Variable Override: POLYGON_API_KEY = *** (hidden)");
    console.log("🎯 Target: AAPL (hardcoded symbol)\n");

    // Simulate feed with Crossbar
    console.log("⚡ Simulating feed with Crossbar...");
    const result = await crossbarClient.simulateFeed(
      [job],
      { POLYGON_API_KEY: process.env.POLYGON_API_KEY }
    );

    console.log("✅ Success!\n");
    console.log("💰 AAPL Price:", result.results?.[0]);

    console.log("\n🔑 Key Takeaways:");
    console.log("  ✅ Variable used ONLY for API key (authorization header)");
    console.log("  ✅ Data source and symbol are hardcoded (verifiable)");
    console.log("  ✅ JSON path is hardcoded (verifiable extraction)");
    console.log("  ✅ Works identically on Solana, EVM, and Sui");

  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
    }
    process.exit(1);
  }
}

main();
