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

// ============================================================================
// Network Configurations
// ============================================================================

interface NetworkConfig {
  name: string;
  chainId: number;
  explorer: string;
  switchboard: string;
  verifier?: string;
  queue?: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  'monad-testnet': {
    name: 'Monad Testnet',
    chainId: 10143,
    explorer: 'https://testnet.monadscan.io',
    switchboard: '0x6724818814927e057a693f4e3A172b6cC1eA690C',
  },
  'monad-mainnet': {
    name: 'Monad Mainnet',
    chainId: 143,
    explorer: 'https://mainnet-beta.monvision.io',
    switchboard: '0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67',
  },
};

// ============================================================================
// Configuration
// ============================================================================

const config = {
  rpcUrl: process.env.RPC_URL || '',
  privateKey: process.env.PRIVATE_KEY || '',
  network: (process.env.NETWORK || 'monad-testnet') as keyof typeof NETWORKS,
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
  'function updatePrices(bytes[] calldata updates, bytes32[] calldata feedIds) external payable',
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

const SWITCHBOARD_CONTRACT_ABI = [
  'function getFee(bytes[] calldata updates) external view returns (uint256)',
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

async function fetchFeedData(feedHash: string, networkConfig: NetworkConfig) {
  const normalizedHash = normalizeFeedHash(feedHash);

  console.log('📡 Fetching feed data from Switchboard Crossbar...');
  console.log(`   Feed: ${normalizedHash}`);
  console.log(`   Chain ID: ${networkConfig.chainId}`);

  const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');

  try {
    const response = await crossbar.fetchEVMResults({
      chainId: networkConfig.chainId,
      aggregatorIds: [normalizedHash],
    });
    const failures = (response as { failures?: string[] }).failures;

    if (!response.encoded.length) {
      throw new Error(
        failures?.join('; ') || 'No encoded data returned for this feed'
      );
    }

    const latestResult = response.results?.[0];
    if (failures?.length) {
      console.warn(`⚠️  Crossbar reported failures: ${failures.join('; ')}`);
    }

    console.log('✅ Feed data retrieved:');
    if (latestResult?.result) {
      console.log(`   Value: ${formatValue(BigInt(latestResult.result))}`);
    }
    if (latestResult?.timestamp) {
      console.log(`   Timestamp: ${new Date(latestResult.timestamp * 1000).toISOString()}`);
    }
    console.log(`   Encoded updates: ${response.encoded.length}`);

    return {
      feedHash: normalizedHash,
      value: latestResult?.result,
      timestamp: latestResult?.timestamp,
      encoded: response.encoded,
    };
  } catch (error: any) {
    console.warn(`⚠️  Chain-specific Crossbar lookup failed: ${error.message}`);
    console.warn('   Falling back to the network-agnostic oracle quote endpoint...');

    const response = await crossbar.fetchOracleQuote([normalizedHash], 'mainnet');
    if (!response.encoded) {
      throw new Error('Fallback oracle quote did not return encoded data');
    }

    const latestResult = response.medianResponses?.[0];

    console.log('✅ Feed data retrieved via fallback endpoint:');
    if (latestResult?.value) {
      console.log(`   Value: ${formatValue(BigInt(latestResult.value))}`);
    }
    console.log(`   Timestamp: ${new Date(response.timestamp * 1000).toISOString()}`);
    console.log('   Encoded updates: 1');

    return {
      feedHash: normalizedHash,
      value: latestResult?.value,
      timestamp: response.timestamp,
      encoded: [response.encoded],
    };
  }
}

async function deployContract(signer: ethers.Wallet, networkConfig: NetworkConfig) {
  console.log('\n📝 Deploying SwitchboardPriceConsumer...');
  
  // Read the compiled contract
  const artifactPath = path.join(__dirname, '../out/SwitchboardPriceConsumer.sol/SwitchboardPriceConsumer.json');
  
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

  const networkConfig = NETWORKS[config.network];
  if (!networkConfig) {
    throw new Error(`Unknown network: ${config.network}`);
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

  const switchboardCode = await provider.getCode(networkConfig.switchboard);
  if (switchboardCode === '0x') {
    throw new Error(
      `No bytecode found at configured Switchboard address ${networkConfig.switchboard} on chain ${networkConfig.chainId}`
    );
  }

  // Deploy or use existing contract
  let contractAddress = config.contractAddress;
  if (!contractAddress) {
    contractAddress = await deployContract(signer, networkConfig);
  } else {
    console.log(`📋 Using existing contract: ${contractAddress}\n`);
  }

  const contract = new ethers.Contract(contractAddress, PRICE_CONSUMER_ABI, signer);

  // ============================================================================
  // Step 1: Fetch Oracle Data
  // ============================================================================

  console.log('='.repeat(80));
  console.log('Step 1: Fetching Oracle Data');
  console.log('='.repeat(80) + '\n');

  const feedData = await fetchFeedData(config.feedHash, networkConfig);

  // ============================================================================
  // Step 2: Update Price On-Chain
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('Step 2: Updating Price On-Chain');
  console.log('='.repeat(80) + '\n');

  // Get the Switchboard contract to check fee
  const switchboard = new ethers.Contract(
    networkConfig.switchboard,
    SWITCHBOARD_CONTRACT_ABI,
    signer
  );

  const fee = await switchboard.getFee(feedData.encoded);
  console.log(`💰 Update fee: ${ethers.formatEther(fee)} ${networkConfig.name.includes('Monad') ? 'MON' : 'ETH'}`);

  console.log('\n📤 Submitting transaction...');
  const feedIdForUpdate = normalizeFeedHash(config.feedHash);
  const tx = await contract.updatePrices(feedData.encoded, [feedIdForUpdate], { value: fee });
  console.log(`   Transaction hash: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();
  console.log('\n✅ Transaction confirmed:');
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);

  // Parse events
  console.log('\n📢 Events:');
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      
      if (parsed?.name === 'PriceUpdated') {
        console.log(`   🎯 PriceUpdated:`);
        console.log(`      Feed ID: ${parsed.args.feedId}`);
        console.log(`      Old Price: ${parsed.args.oldPrice === 0n ? 'N/A' : formatValue(parsed.args.oldPrice)}`);
        console.log(`      New Price: ${formatValue(parsed.args.newPrice)}`);
        console.log(`      Timestamp: ${new Date(Number(parsed.args.timestamp) * 1000).toISOString()}`);
        console.log(`      Slot: ${parsed.args.slotNumber}`);
      }
    } catch (e) {
      // Skip logs we can't parse
    }
  }

  // ============================================================================
  // Step 3: Query and Verify
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('Step 3: Querying and Verifying Price');
  console.log('='.repeat(80) + '\n');

  const feedId = normalizeFeedHash(config.feedHash);
  const [value, timestamp, slotNumber] = await contract.getPrice(feedId);
  const isFresh = await contract.isPriceFresh(feedId);
  const age = await contract.getPriceAge(feedId);

  console.log('📊 On-Chain Price Data:');
  console.log(`   Feed ID: ${feedId}`);
  console.log(`   Value: ${formatValue(value)}`);
  console.log(`   Timestamp: ${new Date(Number(timestamp) * 1000).toISOString()}`);
  console.log(`   Slot: ${slotNumber}`);
  console.log(`   Fresh: ${isFresh ? '✅ Yes' : '❌ No'}`);
  console.log(`   Age: ${age} seconds`);

  // ============================================================================
  // Step 4: Example Business Logic
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('Step 4: Example Business Logic');
  console.log('='.repeat(80) + '\n');

  // Example: Calculate collateral ratio
  const collateralAmount = ethers.parseEther('1'); // 1 BTC
  const debtAmount = ethers.parseEther('50000'); // $50,000 debt

  const ratio = await contract.calculateCollateralRatio(
    feedId,
    collateralAmount,
    debtAmount
  );

  console.log('💼 Collateral Ratio Example:');
  console.log(`   Collateral: ${ethers.formatEther(collateralAmount)} BTC`);
  console.log(`   Debt: $${ethers.formatEther(debtAmount)}`);
  console.log(`   Ratio: ${Number(ratio) / 100}%`);

  // Example: Check liquidation
  const liquidationThreshold = 11000n; // 110%
  const shouldLiq = await contract.shouldLiquidate(
    feedId,
    collateralAmount,
    debtAmount,
    liquidationThreshold
  );

  console.log(`\n🔍 Liquidation Check:`);
  console.log(`   Threshold: ${Number(liquidationThreshold) / 100}%`);
  console.log(`   Should Liquidate: ${shouldLiq ? '⚠️  Yes' : '✅ No'}`);

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('✨ Example Completed Successfully!');
  console.log('='.repeat(80));
  console.log('\nWhat just happened:');
  console.log('1. ✅ Deployed/Connected to SwitchboardPriceConsumer contract');
  console.log('2. ✅ Fetched real-time oracle data from Crossbar');
  console.log('3. ✅ Submitted and verified price update on-chain');
  console.log('4. ✅ Demonstrated business logic with price data');
  console.log('\nYour contract now has access to verified, real-time oracle data!');
  console.log(`\nContract: ${contractAddress}`);
  console.log(`Explorer: ${networkConfig.explorer}/address/${contractAddress}`);
  console.log(`Transaction: ${networkConfig.explorer}/tx/${tx.hash}`);
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
