import * as sb from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
import yargs from "yargs";
import { TX_CONFIG, sleep } from "../utils";
import { PublicKey } from "@solana/web3.js";

const argv = yargs(process.argv.slice(2))
  .options({
    feed: { 
      type: "string",
      required: true,
      describe: "Feed public key to run job with variables"
    },
    variables: {
      type: "string",
      required: false,
      describe: "JSON string of variable overrides (e.g., '{\"API_KEY\":\"value\",\"SYMBOL\":\"BTCUSD\"}')"
    },
    gateway: {
      type: "string",
      required: false,
      default: "https://internal-crossbar.prod.mrgn.app",
      describe: "Gateway URL for crossbar client"
    },
    numSignatures: {
      type: "number",
      required: false,
      default: 3,
      describe: "Number of signatures to request"
    },
    simulate: {
      type: "boolean",
      required: false,
      default: true,
      describe: "Whether to simulate transaction (true) or send it (false)"
    }
  })
  .help()
  .argv as any;

interface JobVariables {
  [key: string]: string;
}

function parseVariables(variablesString?: string): JobVariables {
  if (!variablesString) {
    return {};
  }
  
  try {
    const parsed = JSON.parse(variablesString);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Variables must be an object');
    }
    
    // Convert all values to strings as required by the API
    const variables: JobVariables = {};
    for (const [key, value] of Object.entries(parsed)) {
      variables[key] = String(value);
    }
    
    return variables;
  } catch (error) {
    console.error('Error parsing variables JSON:', error);
    console.error('Expected format: \'{"API_KEY": "value", "SYMBOL": "BTCUSD"}\'');
    process.exit(1);
  }
}

function logVariableUsage() {
  console.log('\n=== Variable Override Usage Examples ===');
  console.log('1. Basic API key override:');
  console.log('   --variables \'{"API_KEY": "your-api-key-123"}\'');
  console.log('\n2. Multiple variables:');
  console.log('   --variables \'{"API_KEY": "key123", "SYMBOL": "BTCUSD", "ENDPOINT": "https://api.example.com"}\'');
  console.log('\n3. Environment-specific overrides:');
  console.log('   --variables \'{"ENV": "production", "TIMEOUT": "30000", "REGION": "us-east-1"}\'');
  console.log('\n4. Dynamic parameters:');
  console.log('   --variables \'{"BASE_URL": "https://api.prod.example.com", "VERSION": "v2", "USER_AGENT": "MyApp/1.0"}\'');
  console.log('\nVariables use ${VARIABLE_NAME} syntax in job definitions');
  console.log('===\n');
}

(async function main() {
  try {
    console.log('🚀 Starting Switchboard job execution with variable overrides...\n');
    
    // Parse command line variables
    const variableOverrides = parseVariables(argv.variables);
    
    // Log variable usage examples if no variables provided
    if (Object.keys(variableOverrides).length === 0) {
      console.log('ℹ️  No variables provided. Running with default job configuration.');
      logVariableUsage();
    } else {
      console.log('📋 Using variable overrides:');
      console.log(JSON.stringify(variableOverrides, null, 2));
      console.log();
    }

    // Initialize Switchboard environment
    console.log('⚙️  Initializing Switchboard environment...');
    const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
    
    // Load default queue and create feed account
    const queue = await sb.Queue.loadDefault(program!);
    const feedAccount = new sb.PullFeed(program!, argv.feed!);
    
    // Initialize crossbar client
    const crossbar = new CrossbarClient(argv.gateway);
    const gateway = await queue.fetchGatewayFromCrossbar(crossbar as any);
    
    // Pre-heat lookup tables for better performance
    console.log('🔥 Pre-heating lookup tables...');
    await feedAccount.preHeatLuts();
    
    console.log(`📡 Fetching job signatures with ${argv.numSignatures} signatures...`);
    const start = Date.now();
    
    // Fetch update instruction with variable overrides
    const [pullIx, responses, _ok, luts] = await feedAccount.fetchUpdateIx({
      gateway: gateway.gatewayUrl,
      crossbarClient: crossbar as any,
      variableOverrides: variableOverrides, // Pass our variable overrides here!
    });
    
    const fetchTime = Date.now() - start;
    console.log(`⚡ Fetch completed in ${fetchTime}ms`);
    
    // Check for errors in responses
    let hasErrors = false;
    for (const response of responses) {
      const shortErr = response.shortError();
      if (shortErr) {
        console.log(`❌ Error in response: ${shortErr}`);
        hasErrors = true;
      }
    }
    
    if (!hasErrors) {
      console.log('✅ All oracle responses successful!');
    }
    
    // Create transaction
    console.log('📦 Building transaction...');
    const tx = await sb.asV0Tx({
      connection,
      ixs: [...pullIx!],
      signers: [keypair],
      computeUnitPrice: 200_000,
      computeUnitLimitMultiple: 1.3,
      lookupTables: luts,
    });

    if (argv.simulate) {
      // Simulate transaction
      console.log('🧪 Simulating transaction...');
      const sim = await connection.simulateTransaction(tx, TX_CONFIG);
      
      if (sim.value.err) {
        console.log('❌ Simulation failed:');
        console.log(JSON.stringify(sim.value.err, null, 2));
      } else {
        console.log('✅ Simulation successful!');
        console.log(`💰 Compute units used: ${sim.value.unitsConsumed}`);
        
        // Log simulation details
        console.log('\n📊 Simulation Results:');
        console.log('- Logs:', sim.value.logs?.slice(0, 5) || []);
        if (sim.value.returnData) {
          console.log('- Return data program:', sim.value.returnData.programId);
        }
      }
    } else {
      // Send actual transaction
      console.log('📤 Sending transaction to network...');
      const signature = await connection.sendTransaction(tx, TX_CONFIG);
      console.log(`✅ Transaction sent! Signature: ${signature}`);
      
      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        console.log('❌ Transaction failed:');
        console.log(JSON.stringify(confirmation.value.err, null, 2));
      } else {
        console.log('✅ Transaction confirmed!');
      }
    }
    
    // Summary
    console.log('\n📈 Execution Summary:');
    console.log(`- Feed: ${argv.feed}`);
    console.log(`- Gateway: ${argv.gateway}`);
    console.log(`- Variables used: ${Object.keys(variableOverrides).length}`);
    console.log(`- Fetch time: ${fetchTime}ms`);
    console.log(`- Mode: ${argv.simulate ? 'Simulation' : 'Live Transaction'}`);
    
    if (Object.keys(variableOverrides).length > 0) {
      console.log('- Variable overrides:');
      for (const [key, value] of Object.entries(variableOverrides)) {
        console.log(`  - ${key}: ${value}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error running job with variables:');
    console.error(error);
    
    if (error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
})();