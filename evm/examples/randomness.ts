/**
 * @fileoverview Example demonstrating Switchboard On-Demand Randomness on EVM chains
 *
 * This script shows the complete randomness flow:
 * 1. Create a randomness request on-chain (auto-selects oracle)
 * 2. Wait for the settlement delay
 * 3. Fetch the randomness reveal from Crossbar
 * 4. Settle the randomness on-chain
 * 5. Read and use the verified random value
 *
 * Use Cases:
 * - Gaming: Fair loot drops, random encounters, card shuffling
 * - NFTs: Random trait generation, blind box reveals
 * - DeFi: Random liquidation selection, lottery mechanisms
 *
 * Run with:
 *   PRIVATE_KEY=0x... bun examples/randomness.ts
 *   PRIVATE_KEY=0x... NETWORK=monad-mainnet bun examples/randomness.ts
 *   PRIVATE_KEY=0x... NETWORK=hyperliquid-mainnet bun examples/randomness.ts
 */

import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';
import { sleep } from './utils';

// =============================================================================
// Configuration
// =============================================================================

interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  switchboard: string;
  blockExplorer: string;
  symbol: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  'monad-testnet': {
    name: 'Monad Testnet',
    chainId: 10143,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    switchboard: '0x90E0B788EfA1986D49c587223b30C8Cb4A3F5c99',
    blockExplorer: 'https://testnet.monadexplorer.com',
    symbol: 'MON',
  },
  'monad-mainnet': {
    name: 'Monad Mainnet',
    chainId: 143,
    rpcUrl: process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz',
    switchboard: '0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67',
    blockExplorer: 'https://monadexplorer.com',
    symbol: 'MON',
  },
  'hyperliquid-mainnet': {
    name: 'Hyperliquid Mainnet',
    chainId: 999,
    rpcUrl: 'https://rpc.hyperliquid.xyz/evm',
    switchboard: '0xcDb299Cb902D1E39F83F54c7725f54eDDa7F3347',
    blockExplorer: 'https://explorer.hyperliquid.xyz',
    symbol: 'ETH',
  },
};

// Switchboard ABI for randomness functions
const SWITCHBOARD_ABI = [
  // Create randomness with auto-selected oracle
  'function createRandomness(bytes32 randomnessId, uint64 minSettlementDelay) external returns (address oracle)',
  // Get randomness data
  'function getRandomness(bytes32 randomnessId) external view returns (tuple(bytes32 randId, uint256 createdAt, address authority, uint256 rollTimestamp, uint64 minSettlementDelay, address oracle, uint256 value, uint256 settledAt))',
  // Check if ready to settle
  'function isRandomnessReady(bytes32 randomnessId) external view returns (bool ready)',
  // Settle randomness
  'function settleRandomness(bytes calldata encodedRandomness) external payable',
  // Get update fee
  'function updateFee() external view returns (uint256)',
  // Events
  'event RandomnessCreated(bytes32 indexed randomnessId, address indexed authority, address indexed oracle, uint64 minSettlementDelay)',
  'event RandomnessSettled(bytes32 indexed randomnessId, address indexed oracle, uint256 value)',
];

interface RandomnessData {
  randId: string;
  createdAt: bigint;
  authority: string;
  rollTimestamp: bigint;
  minSettlementDelay: bigint;
  oracle: string;
  value: bigint;
  settledAt: bigint;
}

// =============================================================================
// Main Example
// =============================================================================

async function main() {
  console.log('\n🎲 Switchboard On-Demand Randomness Example');
  console.log('═'.repeat(60));

  // Get configuration
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const networkName = process.env.NETWORK || 'monad-testnet';
  const network = NETWORKS[networkName];
  if (!network) {
    const available = Object.keys(NETWORKS).join(', ');
    throw new Error(`Unknown network: ${networkName}. Available: ${available}`);
  }

  const crossbarUrl = process.env.CROSSBAR_URL || 'https://crossbar.switchboard.xyz';

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const switchboard = new ethers.Contract(network.switchboard, SWITCHBOARD_ABI, wallet);

  console.log(`\n📋 Configuration:`);
  console.log(`   Network:      ${network.name} (${networkName})`);
  console.log(`   Chain ID:     ${network.chainId}`);
  console.log(`   Switchboard:  ${network.switchboard}`);
  console.log(`   Wallet:       ${wallet.address}`);
  console.log(`   Crossbar:     ${crossbarUrl}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`   Balance:      ${ethers.formatEther(balance)} ${network.symbol}`);

  if (balance === 0n) {
    throw new Error(`Wallet has no balance. Get ${network.symbol} first.`);
  }

  // Get update fee
  const updateFee = await switchboard.updateFee();
  console.log(`   Update Fee:   ${ethers.formatEther(updateFee)} ${network.symbol}`);

  // =========================================================================
  // STEP 1: Create Randomness Request
  // =========================================================================
  console.log('\n\n📝 STEP 1: Create Randomness Request');
  console.log('─'.repeat(60));

  // Generate a unique randomness ID (in production, use a meaningful identifier)
  const randomnessId = ethers.keccak256(
    ethers.toUtf8Bytes(`randomness-${Date.now()}-${Math.random()}`)
  );

  // Min delay before settlement (5 seconds is safe for clock skew)
  const minSettlementDelay = 5;

  console.log(`   Randomness ID: ${randomnessId}`);
  console.log(`   Min Delay:     ${minSettlementDelay} seconds`);
  console.log('\n   Creating randomness request...');

  const createTx = await switchboard.createRandomness(randomnessId, minSettlementDelay);
  console.log(`   TX Hash:  ${createTx.hash}`);
  console.log(`   Explorer: ${network.blockExplorer}/tx/${createTx.hash}`);

  const createReceipt = await createTx.wait();
  console.log(`   ✅ Confirmed in block ${createReceipt.blockNumber}`);

  // Parse event to get assigned oracle
  const iface = new ethers.Interface(SWITCHBOARD_ABI);
  let assignedOracle: string | null = null;

  for (const log of createReceipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'RandomnessCreated') {
        assignedOracle = parsed.args.oracle;
        console.log(`   🎯 Assigned Oracle: ${assignedOracle}`);
        break;
      }
    } catch {
      // Not our event
    }
  }

  // Get randomness data
  const randomnessData: RandomnessData = await switchboard.getRandomness(randomnessId);
  console.log(`\n   📊 Randomness Data:`);
  console.log(`      Authority:      ${randomnessData.authority}`);
  console.log(`      Oracle:         ${randomnessData.oracle}`);
  console.log(`      Roll Timestamp: ${randomnessData.rollTimestamp}`);

  // =========================================================================
  // STEP 2: Wait for Settlement Delay
  // =========================================================================
  console.log('\n\n⏳ STEP 2: Waiting for Settlement Delay');
  console.log('─'.repeat(60));

  const settlementTime = Number(randomnessData.rollTimestamp) + Number(randomnessData.minSettlementDelay);
  const now = Math.floor(Date.now() / 1000);
  // Add buffer for clock skew between local machine and oracle
  const waitTime = Math.max(0, settlementTime - now + 10);

  console.log(`   Settlement time: ${new Date(settlementTime * 1000).toISOString()}`);
  console.log(`   Adding 10s buffer for oracle clock sync...`);

  for (let i = waitTime; i > 0; i--) {
    process.stdout.write(`\r   Waiting... ${i} seconds remaining   `);
    await sleep(1000);
  }
  console.log('\n   ✅ Ready to settle!');

  // =========================================================================
  // STEP 3: Fetch Randomness Reveal from Crossbar
  // =========================================================================
  console.log('\n\n🌐 STEP 3: Fetch Randomness Reveal');
  console.log('─'.repeat(60));

  console.log(`   Fetching from Crossbar...`);

  const crossbar = new CrossbarClient(crossbarUrl);
  const { encoded: encodedRandomness, response: crossbarResponse } = await crossbar.resolveEVMRandomness({
    chainId: network.chainId,
    randomnessId,
    timestamp: Number(randomnessData.rollTimestamp),
    minStalenessSeconds: Number(randomnessData.minSettlementDelay),
    oracle: randomnessData.oracle,
  });

  console.log(`   ✅ Received encoded randomness`);
  console.log(`   Preview value: ${crossbarResponse.value}`);

  // =========================================================================
  // STEP 4: Settle Randomness On-Chain
  // =========================================================================
  console.log('\n\n🔐 STEP 4: Settle Randomness');
  console.log('─'.repeat(60));

  console.log(`   Submitting settlement transaction...`);

  const settleTx = await switchboard.settleRandomness(encodedRandomness, { value: updateFee });
  console.log(`   TX Hash:  ${settleTx.hash}`);
  console.log(`   Explorer: ${network.blockExplorer}/tx/${settleTx.hash}`);

  const settleReceipt = await settleTx.wait();
  console.log(`   ✅ Settled in block ${settleReceipt.blockNumber}`);

  // Parse settlement event
  for (const log of settleReceipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'RandomnessSettled') {
        console.log(`\n   📦 RandomnessSettled Event:`);
        console.log(`      Value: ${parsed.args.value}`);
        break;
      }
    } catch {
      // Not our event
    }
  }

  // =========================================================================
  // STEP 5: Read and Use the Random Value
  // =========================================================================
  console.log('\n\n📖 STEP 5: Read Final Result');
  console.log('─'.repeat(60));

  const finalData: RandomnessData = await switchboard.getRandomness(randomnessId);

  console.log(`   Randomness ID: ${finalData.randId}`);
  console.log(`   Oracle:        ${finalData.oracle}`);
  console.log(`   Raw Value:     ${finalData.value}`);
  console.log(`   Settled At:    ${new Date(Number(finalData.settledAt) * 1000).toISOString()}`);

  // Example: Convert to usable random numbers
  console.log(`\n   🎲 Example Random Values:`);
  console.log(`      0-99:       ${Number(finalData.value % 100n)}`);
  console.log(`      0-999:      ${Number(finalData.value % 1000n)}`);
  console.log(`      Coin flip:  ${finalData.value % 2n === 0n ? 'Heads' : 'Tails'}`);
  console.log(`      D6 roll:    ${Number((finalData.value % 6n) + 1n)}`);
  console.log(`      D20 roll:   ${Number((finalData.value % 20n) + 1n)}`);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n\n' + '═'.repeat(60));
  console.log('✅ RANDOMNESS EXAMPLE COMPLETE');
  console.log('═'.repeat(60));
  console.log(`
Summary:
  • Network:       ${network.name}
  • Randomness ID: ${randomnessId}
  • Oracle:        ${finalData.oracle}
  • Random Value:  ${finalData.value}

Transactions:
  • Create: ${network.blockExplorer}/tx/${createTx.hash}
  • Settle: ${network.blockExplorer}/tx/${settleTx.hash}

Integration Tips:
  • Use the raw 256-bit value (finalData.value) for maximum entropy
  • Apply modulo for bounded ranges: value % range
  • For multiple random values, hash the result with different salts
  • Store randomnessId to verify the result matches your request
`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message || error);
  process.exit(1);
});

