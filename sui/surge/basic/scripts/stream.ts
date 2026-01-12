import * as sb from '@switchboard-xyz/on-demand';
import { SuiClient } from '@mysten/sui/client';
import {
  SwitchboardClient,
  emitSurgeQuote,
} from '@switchboard-xyz/sui-sdk';
import { fromB64 } from '@mysten/bcs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Transaction } from '@mysten/sui/transactions';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('network', {
    alias: 'n',
    type: 'string',
    description: 'Network to connect to',
    choices: ['mainnet', 'testnet'],
    default: 'mainnet',
  })
  .parseSync();

const network = argv.network as 'mainnet' | 'testnet';

// Network-specific configuration
const config = {
  mainnet: {
    rpcUrl: 'https://fullnode.mainnet.sui.io:443',
    oracleEndpoint: 'https://crossbar.switchboard.xyz/oracles/sui',
  },
  testnet: {
    rpcUrl: 'https://fullnode.testnet.sui.io:443',
    oracleEndpoint: 'https://crossbar.switchboard.xyz/oracles/sui/testnet',
  },
};

const suiClient = new SuiClient({ url: config[network].rpcUrl });
const switchboardClient = new SwitchboardClient(suiClient);

// Oracle mapping cache
const oracleMapping = new Map<string, string>(); // oracle_key -> oracle_id
let lastOracleFetch = 0;
const ORACLE_CACHE_TTL = 1000 * 60 * 10; // 10 minutes

// Transaction queue management
let isTransactionProcessing = false;
const rawResponseQueue: Array<{
  rawResponse: any;
  timestamp: number;
}> = [];

// Process transaction queue - ensures only one transaction at a time
async function processTransactionQueue(): Promise<void> {
  if (isTransactionProcessing || rawResponseQueue.length === 0) {
    return;
  }

  isTransactionProcessing = true;

  try {
    const queueItem = rawResponseQueue.shift()!;
    const { rawResponse, timestamp } = queueItem;

    console.log(
      `Processing transaction (queue length: ${rawResponseQueue.length})`
    );

    // Create transaction only during processing stage
    const transaction = new Transaction();

    // Convert to Sui quote format and add to transaction
    try {
      await emitSurgeQuote(switchboardClient, transaction, rawResponse);
    } catch (error) {
      console.error('Error in emitSurgeQuote:', error);
      console.log(
        'Failed rawResponse oracle_pubkey:',
        rawResponse.oracle_response?.oracle_pubkey
      );
      throw error; // Re-throw to maintain error handling flow
    }

    const result = await suiClient.signAndExecuteTransaction({
      transaction: transaction,
      signer: keypair!,
      options: {
        showEvents: true,
        showEffects: true,
        showInput: true,
        showObjectChanges: true,
      },
    });

    const processingTime = Date.now() - timestamp;
    console.log(`Transaction completed in ${processingTime}ms`);
    console.log('Transaction result:', result);
  } catch (error) {
    console.error('Transaction failed:', error);
  } finally {
    isTransactionProcessing = false;

    // Process next transaction in queue if any
    if (rawResponseQueue.length > 0) {
      setImmediate(() => processTransactionQueue());
    }
  }
}

// Fetch oracle mappings from Crossbar
async function fetchOracleMappings(): Promise<Map<string, string>> {
  const now = Date.now();

  if (oracleMapping.size > 0 && now - lastOracleFetch < ORACLE_CACHE_TTL) {
    return oracleMapping;
  }

  try {
    const response = await fetch(config[network].oracleEndpoint);
    const oracles = (await response.json()) as Array<{
      oracle_id: string;
      oracle_key: string;
    }>;

    oracleMapping.clear();
    for (const oracle of oracles) {
      // Remove 0x prefix from oracle_key for consistent mapping
      const cleanKey = oracle.oracle_key.startsWith('0x')
        ? oracle.oracle_key.slice(2)
        : oracle.oracle_key;
      oracleMapping.set(cleanKey, oracle.oracle_id);
    }

    lastOracleFetch = now;
    console.log(`Loaded ${oracleMapping.size} oracle mappings`);
    return oracleMapping;
  } catch (error) {
    console.error('Failed to fetch oracle mappings:', error);
    return oracleMapping;
  }
}

export function calculateStatistics(latencies: number[]) {
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const min = sortedLatencies[0];
  const max = sortedLatencies[sortedLatencies.length - 1];
  const median =
    sortedLatencies.length % 2 === 0
      ? (sortedLatencies[sortedLatencies.length / 2 - 1] +
          sortedLatencies[sortedLatencies.length / 2]) /
        2
      : sortedLatencies[Math.floor(sortedLatencies.length / 2)];
  const sum = sortedLatencies.reduce((a, b) => a + b, 0);
  const mean = sum / sortedLatencies.length;

  return {
    min,
    max,
    median,
    mean,
    count: latencies.length,
  };
}

let keypair: Ed25519Keypair | null = null;

try {
  // Read the keystore file (usually in JSON format)
  const keystorePath = path.join(
    os.homedir(),
    '.sui',
    'sui_config',
    'sui.keystore'
  );
  const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf-8'));

  // Ensure the keystore has at least 1 key
  if (keystore.length < 1) {
    throw new Error('Keystore has fewer than 1 key.');
  }

  // Access the 1st key (index 0) and decode from base64
  const secretKey = fromB64(keystore[0]);
  keypair = Ed25519Keypair.fromSecretKey(secretKey.slice(1)); // Slice to remove the first byte if needed
} catch (error) {
  console.log('Error:', error);
}

if (!keypair) {
  throw new Error('Keypair not loaded');
}

(async function main() {
  console.log(`Starting Surge streaming demo (${network})...`);
  console.log(`Using keypair: ${keypair!.toSuiAddress()}`);

  const latencies: number[] = [];

  // Initialize Surge with keypair and connection (uses on-chain subscription)
  const surge = new sb.Surge({
    connection: suiClient,
    keypair: keypair!,
    signatureScheme: 'secp256k1',
  });

  await surge.connectAndSubscribe([{ symbol: 'BTC/USD' }]);

  // Run simulation after 10 seconds
  setTimeout(async () => {
    console.log(
      '\n10 seconds elapsed - running simulation with latest data...'
    );
  }, 10_000);

  // Pre-fetch oracle mappings
  await fetchOracleMappings();

  // Listen for price updates
  surge.on('signedPriceUpdate', async (response: sb.SurgeUpdate) => {
    const currentLatency = Date.now() - response.data.source_ts_ms;
    latencies.push(currentLatency);

    const rawResponse = response.getRawResponse();
    console.log('Raw response:', rawResponse);

    const stats = calculateStatistics(latencies);
    const formattedPrices = response.getFormattedPrices();
    const currentPrice = Object.values(formattedPrices)[0] || 'N/A';
    console.log(
      `Update #${
        stats.count
      } | Price: ${currentPrice} | Latency: ${currentLatency}ms | Avg: ${stats.mean.toFixed(
        1
      )}ms`
    );

    // Convert oracle pubkey to oracle ID for Sui
    if (rawResponse.oracle_response?.oracle_pubkey) {
      try {
        let oracleKeyHex = rawResponse.oracle_response.oracle_pubkey;

        // The oracle pubkey should already be in hex format, just remove 0x prefix if present
        if (oracleKeyHex.startsWith('0x')) {
          oracleKeyHex = oracleKeyHex.slice(2);
        }

        console.log(`Oracle key (hex): ${oracleKeyHex}`);

        const oracleId = oracleMapping.get(oracleKeyHex);

        if (oracleId) {
          console.log(
            `Oracle mapping found: ${oracleKeyHex} -> ${oracleId}`
          );
          console.log('Oracle ID found, ready for Sui submission');
        } else {
          console.warn(`Oracle ID not found for key: ${oracleKeyHex}`);
          console.log(
            `Available oracle keys:`,
            Array.from(oracleMapping.keys()).slice(0, 3)
          );
        }
      } catch (error) {
        console.error('Failed to process oracle mapping:', error);
      }
    }

    // Add raw response to queue instead of creating transaction immediately
    rawResponseQueue.push({
      rawResponse,
      timestamp: Date.now(),
    });

    console.log(
      `Raw response queued (queue length: ${rawResponseQueue.length})`
    );

    // Trigger queue processing
    processTransactionQueue();
  });

  console.log(
    'Listening for price updates (will simulate after 10 seconds)...'
  );
})();
