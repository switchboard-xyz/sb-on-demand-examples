import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import {
  TX_CONFIG,
  sleep,
  myAnchorProgram,
  myProgramIx,
  DEMO_PATH,
  calculateStatistics,
} from "../utils";
import { PublicKey } from "@solana/web3.js";
import axios, { AxiosError } from "axios";


/**
 * Main execution function demonstrating bundle-based oracle integration
 *
 * This function implements a continuous loop that:
 * 1. Fetches the latest oracle bundle from Switchboard's Crossbar network
 * 2. Creates verification and program instructions
 * 3. Submits transactions to consume the oracle data
 * 4. Tracks performance metrics for monitoring
 *
 * @async
 * @function main
 *
 * @throws {Error} If environment setup fails or oracle network is unreachable
 */
(async function main() {
  // Load Solana environment configuration from standard locations
  // Expects ANCHOR_WALLET environment variable or ~/.config/solana/id.json
  const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();

  // Create Crossbar client for fetching oracle bundles
  // Crossbar is Switchboard's high-performance oracle data delivery network
  const crossbar = new CrossbarClient("http://localhost:8000");

  // Load the default Switchboard queue for your network (mainnet/devnet)
  // The queue contains the list of authorized oracle signers
  const queue = await sb.Queue.loadDefault(program!);

  // Fetch the gateway URL for this queue from Crossbar
  // This endpoint will provide signed oracle bundles
  // const gateway = await queue.fetchGatewayFromCrossbar(crossbar);

  // Load the address lookup table for transaction size optimization
  // This significantly reduces transaction size by using indices instead of full addresses
  // const lut = await queue.loadLookupTable();

  // Track latency measurements for performance monitoring
  const latencies: number[] = [];

  // Main execution loop - continuously fetches and processes oracle updates
  while (true) {
    try {
      console.log("\n===== Starting new Sui simulate attempt =====");
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`Crossbar URL: ${crossbar.crossbarUrl}`);
      console.log(`Sui Aggregator Address: 0x0c9a07f75b227e167320781402ba6398a544574704a6f50ad62ccdba3bfbe1eb`);

      // Test connectivity first
      console.log("\nTesting connectivity to Crossbar...");
      try {
        const healthCheck = await axios.get(`${crossbar.crossbarUrl}/health`, {
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });
        console.log(`Health check response: ${healthCheck.status} ${healthCheck.statusText}`);
        if (healthCheck.data) {
          console.log(`Health check data:`, JSON.stringify(healthCheck.data, null, 2));
        }
      } catch (healthErr) {
        console.error("Health check failed:", healthErr instanceof Error ? healthErr.message : String(healthErr));
        if (axios.isAxiosError(healthErr) && healthErr.code) {
          console.error(`Error code: ${healthErr.code}`);
        }
      }

      // Attempt the actual simulate
      console.log("\nAttempting to simulate Sui feeds...");
      const startTime = Date.now();
      const suiAggregatorAddress = "ByTpJ7pxD86SJqCcpewN7HdNkePrStCED1Gd4h2SJYCa";
      const resp = await crossbar.simulateSolanaFeeds("mainnet", [suiAggregatorAddress]);
      const fetchTime = Date.now() - startTime;

      console.log(`✅ Sui simulate successful in ${fetchTime}ms`);
      console.log(`Response ${JSON.stringify(resp, null, 2)}`);

      // Add a delay before next iteration
      await sleep(5000);

    } catch (error) {
      console.error("\n❌ Fetch failed!");
      console.error(`Error timestamp: ${new Date().toISOString()}`);

      if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError;
        console.error("\n=== Axios Error Details ===");
        console.error(`Message: ${axiosErr.message}`);
        console.error(`Code: ${axiosErr.code}`);
        console.error(`Syscall: ${(axiosErr as any).syscall}`);
        console.error(`Errno: ${(axiosErr as any).errno}`);

        if (axiosErr.config) {
          console.error("\n=== Request Configuration ===");
          console.error(`URL: ${axiosErr.config.url}`);
          console.error(`Method: ${axiosErr.config.method?.toUpperCase()}`);
          console.error(`Timeout: ${axiosErr.config.timeout || 'none'}`);
          console.error(`Headers:`, JSON.stringify(axiosErr.config.headers, null, 2));
        }

        if (axiosErr.response) {
          console.error("\n=== Response Details ===");
          console.error(`Status: ${axiosErr.response.status}`);
          console.error(`Status Text: ${axiosErr.response.statusText}`);
          console.error(`Headers:`, JSON.stringify(axiosErr.response.headers, null, 2));
          console.error(`Data:`, axiosErr.response.data);
        } else {
          console.error("\n⚠️  No response received - connection failed");

          // ECONNRESET specific debugging
          if (axiosErr.code === 'ECONNRESET') {
            console.error("\n=== ECONNRESET Troubleshooting ===");
            console.error("Possible causes:");
            console.error("1. Server closed the connection unexpectedly");
            console.error("2. Network issues or firewall blocking");
            console.error("3. Server crash or restart during request");
            console.error("4. Timeout on server side");
            console.error("5. Proxy or load balancer issues");

            // Check if server is running
            console.error("\nChecking if server is accessible...");
            try {
              const testReq = await axios.get(crossbar.crossbarUrl, {
                timeout: 2000,
                validateStatus: () => true
              });
              console.error(`Server responded with status: ${testReq.status}`);
            } catch (testErr) {
              console.error("Server appears to be down or unreachable");
            }
          }
        }

        // Network diagnostics
        if (axiosErr.code === 'ECONNRESET' || axiosErr.code === 'ECONNREFUSED') {
          console.error("\n=== Network Diagnostics ===");
          console.error(`Local endpoint: ${axiosErr.config?.url}`);
          console.error("Ensure the Crossbar server is running on localhost:8000");
        }
      } else if (error instanceof Error) {
        console.error("\n=== Generic Error ===");
        console.error(`Type: ${error.constructor.name}`);
        console.error(`Message: ${error.message}`);
        console.error(`Stack trace:\n${error.stack}`);
      } else {
        console.error("\n=== Unknown Error ===");
        console.error("Error object:", error);
      }

      // Wait before retrying
      await sleep(1000);
    }
  }
})();
