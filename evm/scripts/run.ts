#!/usr/bin/env bun
/**
 * Switchboard Price Consumer Example
 *
 * This script demonstrates the complete flow of using Switchboard oracles:
 * 1. Deploy the SwitchboardPriceConsumer contract
 * 2. Fetch oracle data from Crossbar
 * 3. Submit price updates on-chain
 * 4. Query and verify the updated prices
 *
 * Prerequisites:
 * - Bun runtime: https://bun.sh
 * - RPC URL for your target network
 * - Private key with native tokens for gas
 *
 * Installation:
 *   bun add ethers @switchboard-xyz/common
 *
 * Environment Variables:
 *   RPC_URL      - EVM RPC endpoint (required)
 *   PRIVATE_KEY  - Private key for transactions (required)
 *   NETWORK      - Network name (monad-testnet, monad-mainnet, arbitrum, etc.)
 *
 * Usage:
 *   # Deploy and run complete example
 *   RPC_URL=https://... PRIVATE_KEY=0x... bun scripts/run.ts
 *
 *   # Use existing contract
 *   RPC_URL=https://... PRIVATE_KEY=0x... CONTRACT_ADDRESS=0x... bun scripts/run.ts
 *
 * Examples:
 *   # Monad Testnet
 *   RPC_URL=https://testnet-rpc.monad.xyz PRIVATE_KEY=0x... NETWORK=monad-testnet bun scripts/run.ts
 *
 *   # Monad Mainnet
 *   RPC_URL=https://rpc-mainnet.monadinfra.com/rpc/YOUR_KEY PRIVATE_KEY=0x... NETWORK=monad-mainnet bun scripts/run.ts
 *
 * @author Switchboard Labs
 * @license MIT
 */

import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const sendTx = args.includes('--sendTx');

// ============================================================================
// Network Configurations
// ============================================================================

interface NetworkConfig {
  name: string;
  chainId: number;
  explorer: string;
  switchboard: string;
  crossbarNetwork: string; // 'mainnet' or 'testnet' for crossbar API
  verifier?: string;
  queue?: string;
}

const NETWORKS: Record<number, NetworkConfig> = {
  // Monad Testnet
  10143: {
    name: 'Monad Testnet',
    chainId: 10143,
    explorer: 'https://testnet.monadscan.io',
    switchboard: '0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C', // From docs.switchboard.xyz
    crossbarNetwork: 'monad-testnet',
  },
  // Monad Mainnet
  143: {
    name: 'Monad Mainnet',
    chainId: 143,
    explorer: 'https://mainnet-beta.monvision.io',
    switchboard: '0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67',
    crossbarNetwork: 'monad-mainnet',
  },
  // HyperEVM Mainnet
  999: {
    name: 'HyperEVM Mainnet',
    chainId: 999,
    explorer: 'https://hyperliquid.xyz',
    switchboard: '0x316fbe540c719970e6427ccd8590d7e0a2814c5d', // From docs.switchboard.xyz
    crossbarNetwork: 'hyperliquid-mainnet',
  },
};

// ============================================================================
// Configuration
// ============================================================================

const config = {
  rpcUrl: process.env.RPC_URL || '',
  privateKey: process.env.PRIVATE_KEY || '',
  contractAddress: process.env.CONTRACT_ADDRESS || '',

  // Feed configuration
  feedHash: process.env.FEED_HASH || '0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812', // BTC/USD

  // Price consumer configuration
  maxPriceAge: parseInt(process.env.MAX_PRICE_AGE || '300'), // 5 minutes
  maxDeviationBps: parseInt(process.env.MAX_DEVIATION_BPS || '1000'), // 10%
};

// ============================================================================
// Contract ABI
// ============================================================================

const PRICE_CONSUMER_ABI = [
  'constructor(address _switchboard)',
  'function updatePrices(bytes calldata update) external payable',  // New API - single bytes
  'function updatePricesLegacy(bytes[] calldata updates, bytes32[] calldata feedIds) external payable',  // Legacy API
  'function getPrice(bytes32 feedId) external view returns (int128 value, uint256 timestamp, uint64 slotNumber)',
  'function isPriceFresh(bytes32 feedId) external view returns (bool)',
  'function getPriceAge(bytes32 feedId) external view returns (uint256)',
  'function calculateCollateralRatio(bytes32 feedId, uint256 collateralAmount, uint256 debtAmount) external view returns (uint256)',
  'function shouldLiquidate(bytes32 feedId, uint256 collateralAmount, uint256 debtAmount, uint256 liquidationThreshold) external view returns (bool)',
  'function updateConfig(uint256 _maxPriceAge, uint256 _maxDeviationBps) external',
  'function maxPriceAge() external view returns (uint256)',
  'function maxDeviationBps() external view returns (uint256)',
  'function owner() external view returns (address)',
  'event PriceUpdated(bytes32 indexed feedId, int128 oldPrice, int128 newPrice, uint256 timestamp, uint64 slotNumber)',
  'event PriceValidationFailed(bytes32 indexed feedId, string reason)',
];

const SWITCHBOARD_ABI = [
  'function updateFeeds(bytes[] calldata updates) external payable',
  'function getFee(bytes[] calldata updates) external view returns (uint256)',
  'function latestUpdate(bytes32 feedId) external view returns (tuple(bytes32 feedId, int128 result, uint256 timestamp, uint64 slotNumber))',
];

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeFeedHash(hash: string): string {
  return hash.startsWith('0x') ? hash : '0x' + hash;
}

function formatValue(value: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}

async function fetchFeedData(feedHash: string, crossbarNetwork: string) {
  const normalizedHash = normalizeFeedHash(feedHash);
  const feedHashForCrossbar = normalizedHash.startsWith('0x')
    ? normalizedHash.slice(2)
    : normalizedHash;

  console.log('📡 Fetching feed data from Switchboard Crossbar...');
  console.log(`   Feed: ${normalizedHash}`);
  console.log(`   Network: ${crossbarNetwork}`);

  try {
    const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
    const response = await crossbar.fetchOracleQuote(
      [feedHashForCrossbar],
      crossbarNetwork
    );

    if (!response.encoded) {
      throw new Error('No encoded data in response');
    }

    const medianResponse = response.medianResponses?.[0];
    if (!medianResponse) {
      throw new Error('No median response in data');
    }

    console.log('✅ Feed data retrieved:');
    console.log(`   Value: ${formatValue(BigInt(medianResponse.value))}`);
    console.log(`   Timestamp: ${new Date(response.timestamp * 1000).toISOString()}`);
    console.log(`   Slot: ${response.slot}`);
    console.log(`   Oracles: ${response.oracleResponses.length}`);

    return {
      feedHash: normalizedHash,
      value: medianResponse.value,
      timestamp: response.timestamp,
      slot: response.slot,
      numOracles: response.oracleResponses.length,
      encoded: response.encoded,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch feed data: ${error.message}`);
  }
}

async function deployContract(signer: ethers.Wallet, networkConfig: NetworkConfig) {
  console.log('\n📝 Deploying SwitchboardPriceConsumer...');

  // Read the compiled contract
  const artifactPath = path.join(__dirname, '../out/artifacts/SwitchboardPriceConsumer.sol/SwitchboardPriceConsumer.json');

  if (!fs.existsSync(artifactPath)) {
    throw new Error('Contract not compiled. Run: forge build');
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode.object,
    signer
  );

  console.log(`   Switchboard: ${networkConfig.switchboard}`);
  console.log(`   Deployer: ${signer.address}`);

  const contract = await factory.deploy(networkConfig.switchboard);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ Contract deployed: ${address}`);
  console.log(`   Explorer: ${networkConfig.explorer}/address/${address}`);

  return address;
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('🚀 Switchboard Price Consumer Example\n');

  // Validate configuration
  if (!config.rpcUrl) {
    throw new Error('RPC_URL environment variable is required');
  }
  if (!config.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  // Auto-detect network from RPC
  console.log('🔍 Detecting network...');
  const tempProvider = new ethers.JsonRpcProvider(config.rpcUrl);
  const { chainId } = await tempProvider.getNetwork();
  const chainIdNum = Number(chainId);

  const networkConfig = NETWORKS[chainIdNum];
  if (!networkConfig) {
    throw new Error(`Unsupported chain ID: ${chainIdNum}. Supported: ${Object.keys(NETWORKS).join(', ')}`);
  }

  console.log('Configuration:');
  console.log(`  Network: ${networkConfig.name}`);
  console.log(`  Chain ID: ${networkConfig.chainId}`);
  console.log(`  RPC: ${config.rpcUrl}`);
  console.log(`  Feed: ${config.feedHash}`);
  console.log('');

  // Setup provider and signer
  const network = new ethers.Network(networkConfig.name, networkConfig.chainId);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, network, {
    staticNetwork: true,
  });
  const signer = new ethers.Wallet(config.privateKey, provider);

  console.log(`👤 Signer: ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} ${networkConfig.name.includes('Monad') ? 'MON' : 'ETH'}\n`);

  // ============================================================================
  // Step 1: Fetch Oracle Data
  // ============================================================================

  console.log('='.repeat(80));
  console.log('Step 1: Fetching Oracle Data');
  console.log('='.repeat(80) + '\n');

  const feedData = await fetchFeedData(config.feedHash, networkConfig.crossbarNetwork);

  // ============================================================================
  // Step 2: Update Price On-Chain
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('Step 2: Updating Price On-Chain');
  console.log('='.repeat(80) + '\n');

  // Get the Switchboard contract to check fee
  const switchboard = new ethers.Contract(
    networkConfig.switchboard,
    SWITCHBOARD_ABI,
    signer
  );

  const fee = await switchboard.getFee([feedData.encoded]);

  if (sendTx) {
    console.log('📤 Submitting update to Switchboard...');
    const tx = await switchboard.updateFeeds([feedData.encoded], { value: fee });
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const receipt = await tx.wait();
    const gasPrice = receipt.gasPrice ?? tx.gasPrice ?? 0n;
    const gasCost = receipt.gasUsed * gasPrice;
    console.log('\n✅ Transaction confirmed:');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Gas cost: ${ethers.formatEther(gasCost)} ${networkConfig.name.includes('Monad') ? 'MON' : 'ETH'}`);
    console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    console.log(`   Explorer: ${networkConfig.explorer}/tx/${tx.hash}`);
  } else {
    console.log('🔍 Simulating update (use --sendTx to submit on-chain)...');
    const gasEstimate = await switchboard.updateFeeds.estimateGas([feedData.encoded], { value: fee });
    console.log(`   Estimated gas: ${gasEstimate.toString()}`);
    console.log('\n✅ Simulation successful - transaction would succeed');
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('Oracle Price Data');
  console.log('='.repeat(80) + '\n');

  console.log(`   Feed ID: ${feedData.feedHash}`);
  console.log(`   Value: $${formatValue(BigInt(feedData.value))}`);
  console.log(`   Timestamp: ${new Date(feedData.timestamp * 1000).toISOString()}`);
  console.log(`   Slot: ${feedData.slot}`);
  console.log(`   Oracles: ${feedData.numOracles}`);

  console.log('\n' + '='.repeat(80));
  console.log(sendTx ? 'Transaction Submitted!' : 'Simulation Complete!');
  console.log('='.repeat(80));
  if (sendTx) {
    console.log('\nWhat happened:');
    console.log('1. Fetched real-time oracle data from Crossbar');
    console.log('2. Submitted signed oracle update to Switchboard on-chain');
    console.log('3. Switchboard verified oracle signatures cryptographically');
    console.log('\nThe price data is now available on-chain for your smart contracts!');
  } else {
    console.log('\nWhat happened:');
    console.log('1. Fetched real-time oracle data from Crossbar');
    console.log('2. Simulated submitting to Switchboard (dry run)');
    console.log('\nRun with --sendTx to submit on-chain.');
  }
  console.log(`\nSwitchboard: ${networkConfig.switchboard}`);
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

