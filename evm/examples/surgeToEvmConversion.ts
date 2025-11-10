#!/usr/bin/env bun
/**
 * Surge to EVM Conversion Example
 *
 * This script demonstrates how to convert Switchboard Surge updates to EVM-compatible format.
 * The converted data can be used with EVM smart contracts that consume Switchboard oracle data.
 *
 * Prerequisites:
 * - Bun runtime: https://bun.sh
 * - Access to Switchboard Surge updates
 *
 * Installation:
 *   bun add @switchboard-xyz/common
 *
 * Usage:
 *   # Basic conversion with sample data
 *   bun examples/surgeToEvmConversion.ts
 *
 *   # With custom surge data (JSON file)
 *   SURGE_DATA_FILE=path/to/surge-data.json bun examples/surgeToEvmConversion.ts
 *
 * @author Switchboard Labs
 * @license MIT
 */

// Import from the local common library since we just added the new functionality
import { EVMUtils, type SurgeRawGatewayResponse } from '@switchboard-xyz/common';
import * as fs from 'fs';

// ============================================================================
// Sample Surge Update Data
// ============================================================================

const sampleSurgeUpdate: SurgeRawGatewayResponse = {
  type: 'bundle_update',
  feed_bundle_id: 'sample-bundle-id',
  feed_values: [
    {
      value: '1000000000000000000', // 1e18 (example BTC price in wei-like format)
      feed_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      symbol: 'BTC/USD',
      source: 'switchboard'
    },
    {
      value: '2500000000000000000', // 2.5e18 (example ETH price)
      feed_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      symbol: 'ETH/USD',
      source: 'switchboard'
    }
  ],
  oracle_response: {
    oracle_pubkey: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    eth_address: '0x742d35Cc6634C0532925a3b8D4C0B4E5C0C8b6C9',
    signature: 'Zl+8HHAyFbKTmaH66HEkQ/4nKRGYKWV8YOjPT9JcGdEhZzy+qI9OKhF3m+nmz9mbegPJRtIJdLfdi1o7wjZCaw==', // 64-byte base64 signature
    checksum: 'sample-checksum',
    recovery_id: 0,
    oracle_idx: 0,
    timestamp: Math.floor(Date.now() / 1000), // Current timestamp in seconds
    recent_hash: '0xdeadbeefcafebabe',
    slot: 12345678
  },
  source_ts_ms: Date.now(),
  seen_at_ts_ms: Date.now(),
  triggered_on_price_change: true,
  message: 'Sample surge update for demonstration'
};

// ============================================================================
// Main Conversion Function
// ============================================================================

async function demonstrateSurgeToEvmConversion() {
  console.log('🔄 Switchboard Surge to EVM Conversion Demo\n');

  try {
    // Load surge data (from file or use sample)
    let surgeData: SurgeRawGatewayResponse;
    
    const surgeDataFile = process.env.SURGE_DATA_FILE;
    if (surgeDataFile && fs.existsSync(surgeDataFile)) {
      console.log(`📁 Loading surge data from: ${surgeDataFile}`);
      const fileContent = fs.readFileSync(surgeDataFile, 'utf-8');
      surgeData = JSON.parse(fileContent);
    } else {
      console.log('📋 Using sample surge data');
      surgeData = sampleSurgeUpdate;
    }

    // Display input data summary
    console.log('📊 Input Surge Update Summary:');
    console.log(`   - Type: ${surgeData.type}`);
    console.log(`   - Feed Count: ${surgeData.feed_values?.length || 0}`);
    console.log(`   - Timestamp: ${surgeData.oracle_response?.timestamp} (${new Date((surgeData.oracle_response?.timestamp || 0) * 1000).toISOString()})`);
    console.log(`   - Slot: ${surgeData.oracle_response?.slot}`);
    console.log(`   - Recovery ID: ${surgeData.oracle_response?.recovery_id}`);
    
    if (surgeData.feed_values) {
      console.log('   - Feed Values:');
      surgeData.feed_values.forEach((feed, i) => {
        console.log(`     ${i + 1}. ${feed.symbol || 'Unknown'}: ${feed.value} (Hash: ${feed.feed_hash.slice(0, 10)}...)`);
      });
    }

    console.log('\n🔧 Converting to EVM format...\n');

    // Perform the conversion
    const evmEncoded = EVMUtils.convertSurgeUpdateToEvmFormat(surgeData, {
      minOracleSamples: 1
    });

    console.log('✅ EVM Conversion Results:');
    console.log(`   - Encoded Data: ${evmEncoded}`);
    console.log(`   - Length: ${evmEncoded.length - 2} hex characters (${(evmEncoded.length - 2) / 2} bytes)`);

    // Parse and verify the structure
    console.log('\n🔍 Parsing EVM Structure:');
    
    const hexData = evmEncoded.slice(2); // Remove 0x prefix
    let offset = 0;
    
    // Parse header
    const slotHex = hexData.slice(offset, offset + 16);
    offset += 16;
    const slot = parseInt(slotHex, 16);
    console.log(`   - Slot: ${slot} (0x${slotHex})`);
    
    const timestampHex = hexData.slice(offset, offset + 16);
    offset += 16;
    const timestamp = parseInt(timestampHex, 16);
    console.log(`   - Timestamp: ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
    
    const numFeeds = parseInt(hexData.slice(offset, offset + 2), 16);
    offset += 2;
    console.log(`   - Number of Feeds: ${numFeeds}`);
    
    const numSigs = parseInt(hexData.slice(offset, offset + 2), 16);
    offset += 2;
    console.log(`   - Number of Signatures: ${numSigs}`);
    
    // Parse feeds
    console.log('   - Feed Data:');
    for (let i = 0; i < numFeeds; i++) {
      const feedHash = hexData.slice(offset, offset + 64);
      offset += 64;
      const valueHex = hexData.slice(offset, offset + 32);
      offset += 32;
      const minSamples = parseInt(hexData.slice(offset, offset + 2), 16);
      offset += 2;
      
      console.log(`     Feed ${i + 1}:`);
      console.log(`       - Hash: 0x${feedHash}`);
      console.log(`       - Value: 0x${valueHex}`);
      console.log(`       - Min Samples: ${minSamples}`);
    }
    
    // Parse signatures
    console.log('   - Signature Data:');
    for (let i = 0; i < numSigs; i++) {
      const signature = hexData.slice(offset, offset + 128);
      offset += 128;
      const recoveryId = parseInt(hexData.slice(offset, offset + 2), 16);
      offset += 2;
      
      console.log(`     Signature ${i + 1}:`);
      console.log(`       - Signature: 0x${signature.slice(0, 20)}...${signature.slice(-20)}`);
      console.log(`       - Recovery ID (v): ${recoveryId}`);
    }

    // Usage instructions
    console.log('\n📋 Usage Instructions:');
    console.log('   1. Use the encoded data with your EVM smart contract');
    console.log('   2. Call your contract\'s update function with this data');
    console.log('   3. The contract will parse and verify the oracle signatures');
    console.log('   4. Updated prices will be available for your dApp logic');

    console.log('\n💡 Example Solidity Usage:');
    console.log('   ```solidity');
    console.log('   // In your smart contract');
    console.log('   function updatePrices(bytes calldata updateData) external {');
    console.log('       switchboard.updatePriceFeeds(updateData);');
    console.log('       // Your business logic here');
    console.log('   }');
    console.log('   ```');

    console.log('\n🎉 Conversion completed successfully!');

  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

if (import.meta.main) {
  demonstrateSurgeToEvmConversion().catch(console.error);
}

export { demonstrateSurgeToEvmConversion };
