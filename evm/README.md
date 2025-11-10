# EVM On-Demand Examples

This directory contains examples for using Switchboard On-Demand functionality on EVM-compatible chains.

## 📁 Directory Structure

```
evm/
├── src/               # Solidity smart contracts
│   ├── SwitchboardPriceConsumer.sol  # Production-ready price consumer
│   └── switchboard/                   # Switchboard interfaces & types
├── script/            # Foundry deployment scripts
│   └── DeploySwitchboardPriceConsumer.s.sol
├── scripts/           # TypeScript client examples
│   └── run.ts         # Complete integration example
├── examples/          # Additional examples
│   ├── updateFeed.ts
│   └── utils.ts
├── legacy/            # Previous examples (for reference)
├── package.json
└── README.md
```

## 🚀 Quick Start (30 seconds to first price)

```bash
# Clone and install
cd evm
bun install

# Build contracts
forge build

# Deploy (Monad Testnet example)
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  -vvvv

# Run the complete example
RPC_URL=https://testnet-rpc.monad.xyz \
PRIVATE_KEY=0x... \
CONTRACT_ADDRESS=0x... \
NETWORK=monad-testnet \
bun scripts/run.ts
```

That's it! You're now fetching and verifying real-time oracle prices on EVM. 🎉

## 📋 Prerequisites

- **Node.js** 16+ and **Bun** (or npm/yarn)
- **Foundry** for Solidity development
- A wallet with native tokens (MON, ETH, etc.)

## 🌐 Supported Networks

| Network | Chain ID | Switchboard Contract |
|---------|----------|---------------------|
| **Monad Mainnet** | 143 | `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |
| **Monad Testnet** | 10143 | `0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33` |
| **Hyperliquid Mainnet** | 999 | `0xcDb299Cb902D1E39F83F54c7725f54eDDa7F3347` |
| **Hyperliquid Testnet** | 998 | TBD |

> **Note**: For other EVM chains (Arbitrum, Core, etc.), see the [legacy examples](./legacy/) which use the previous Switchboard implementation.

## 🔥 Monad Integration

Monad is a high-performance EVM-compatible blockchain optimized for speed and efficiency. Switchboard On-Demand provides native oracle support for Monad with the same security guarantees and ease of use as other EVM chains.

### Network Information

| Network | Chain ID | RPC URL | Switchboard Contract |
|---------|----------|---------|---------------------|
| **Monad Mainnet** | 143 | `https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY` | `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |
| **Monad Testnet** | 10143 | `https://testnet-rpc.monad.xyz` | `0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33` |

### Quick Start on Monad

#### 1. Setup Environment

```bash
# Monad Testnet
export RPC_URL=https://testnet-rpc.monad.xyz
export PRIVATE_KEY=0xyour_private_key_here
export NETWORK=monad-testnet

# Monad Mainnet
export RPC_URL=https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY
export PRIVATE_KEY=0xyour_private_key_here  
export NETWORK=monad-mainnet
```

#### 2. Deploy Contract

```bash
# Monad Testnet deployment
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv

# Monad Mainnet deployment  
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

#### 3. Run Oracle Integration

```bash
# Complete example on Monad Testnet
RPC_URL=https://testnet-rpc.monad.xyz \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=monad-testnet \
bun scripts/run.ts

# Complete example on Monad Mainnet
RPC_URL=https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=monad-mainnet \
bun scripts/run.ts
```

### Monad-Specific Considerations

- **Native Token**: MON (for gas fees)
- **High Performance**: Monad's optimized execution enables faster oracle updates
- **Low Fees**: Efficient gas usage for frequent price updates
- **EVM Compatibility**: All existing Ethereum tooling works seamlessly

### Getting MON Tokens

**Testnet:**
- Use the [Monad Testnet Faucet](https://faucet.monad.xyz) to get testnet MON
- Connect your wallet and request tokens for testing

**Mainnet:**
- Acquire MON tokens through supported exchanges
- Bridge from other networks using official Monad bridges

### Example: DeFi Integration on Monad

```typescript
import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';

// Monad-specific setup
const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Switchboard contract on Monad Testnet
const switchboardAddress = '0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33';
const switchboard = new ethers.Contract(switchboardAddress, SWITCHBOARD_ABI, signer);

// Your deployed price consumer contract
const priceConsumer = new ethers.Contract(contractAddress, PRICE_CONSUMER_ABI, signer);

// Fetch and update prices
const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
const feedHash = '0xa0950ee5ee117b2e2c30f154a69e17bfb489a7610c508dc5f67eb2a14616d8ea'; // ETH/USD

const response = await crossbar.fetchOracleQuote([feedHash], 'mainnet');
const fee = await switchboard.getFee([response.encoded]);

// Submit update with Monad's fast finality
const tx = await priceConsumer.updatePrices([response.encoded], { value: fee });
const receipt = await tx.wait();

console.log(`Price updated on Monad! Block: ${receipt.blockNumber}`);
```

## 🔷 HyperEVM (Hyperliquid) Integration

Hyperliquid is a high-performance Layer 1 blockchain with native perpetual futures and spot trading. Switchboard On-Demand provides native oracle support for HyperEVM with the same security guarantees and ease of use as other EVM chains.

### Network Information

| Network | Chain ID | RPC URL | Switchboard Contract |
|---------|----------|---------|---------------------|
| **Hyperliquid Mainnet** | 999 | `https://rpc.hyperliquid.xyz/evm` | `0xcDb299Cb902D1E39F83F54c7725f54eDDa7F3347` |
| **Hyperliquid Testnet** | 998 | `https://rpc.hyperliquid-testnet.xyz/evm` | TBD |

### Quick Start on Hyperliquid

#### 1. Setup Environment

```bash
# Hyperliquid Mainnet
export RPC_URL=https://rpc.hyperliquid.xyz/evm
export PRIVATE_KEY=0xyour_private_key_here
export NETWORK=hyperliquid-mainnet

# Hyperliquid Testnet
export RPC_URL=https://rpc.hyperliquid-testnet.xyz/evm
export PRIVATE_KEY=0xyour_private_key_here  
export NETWORK=hyperliquid-testnet
```

#### 2. Deploy Contract

```bash
# Hyperliquid Mainnet deployment
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://rpc.hyperliquid.xyz/evm \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv

# Hyperliquid Testnet deployment  
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

#### 3. Run Oracle Integration

```bash
# Complete example on Hyperliquid Mainnet
RPC_URL=https://rpc.hyperliquid.xyz/evm \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=hyperliquid-mainnet \
bun scripts/run.ts

# Complete example on Hyperliquid Testnet
RPC_URL=https://rpc.hyperliquid-testnet.xyz/evm \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=hyperliquid-testnet \
bun scripts/run.ts
```

### Example: Perpetual Futures Integration on Hyperliquid

```typescript
import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';

// Hyperliquid-specific setup
const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Switchboard contract on Hyperliquid Mainnet
const switchboardAddress = '0xcDb299Cb902D1E39F83F54c7725f54eDDa7F3347';
const switchboard = new ethers.Contract(switchboardAddress, SWITCHBOARD_ABI, signer);

// Your deployed price consumer contract
const priceConsumer = new ethers.Contract(contractAddress, PRICE_CONSUMER_ABI, signer);

// Fetch and update prices for perpetual futures
const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
const btcFeedHash = '0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812'; // BTC/USD

const response = await crossbar.fetchOracleQuote([btcFeedHash], 'mainnet');
const fee = await switchboard.getFee([response.encoded]);

// Submit update with Hyperliquid's fast finality
const tx = await priceConsumer.updatePrices([response.encoded], { value: fee });
const receipt = await tx.wait();

console.log(`Price updated on Hyperliquid! Block: ${receipt.blockNumber}`);

// Query the updated price
const [value, timestamp, slotNumber] = await priceConsumer.getPrice(btcFeedHash);
console.log(`BTC/USD Price: $${ethers.formatUnits(value, 18)}`);
```

### Getting Started with Hyperliquid

**Documentation:**
- [Hyperliquid Docs](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [HyperEVM Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm)

**Testnet:**
- Use the Hyperliquid testnet to test your integration
- Request testnet tokens through the official faucet

**Mainnet:**
- Bridge ETH to Hyperliquid using the official bridge
- Start with small amounts to test your integration

## 🎯 What is Switchboard On-Demand?

Switchboard On-Demand provides secure, verified oracle data for EVM smart contracts:

- **Cryptographic Verification**: Oracle signatures verified on-chain
- **Multi-Oracle Consensus**: Aggregate data from multiple oracle sources
- **Configurable Security**: Set staleness limits and price deviation thresholds
- **Gas Efficient**: Optimized for low transaction costs

## 📊 Example: Price Consumer Contract

The `SwitchboardPriceConsumer.sol` contract demonstrates production-ready oracle integration:

```solidity
contract SwitchboardPriceConsumer {
    ISwitchboard public immutable switchboard;
    mapping(bytes32 => PriceData) public prices;
    
    // Update prices with oracle data
    function updatePrices(bytes[] calldata updates) external payable {
        uint256 fee = switchboard.getFee(updates);
        require(msg.value >= fee, "Insufficient fee");
        
        // Verify signatures and update
        switchboard.updateFeeds{value: fee}(updates);
        
        // Process and store verified prices
        // ... validation logic ...
    }
    
    // Get current price
    function getPrice(bytes32 feedId) external view 
        returns (int128 value, uint256 timestamp, uint64 slotNumber);
    
    // Business logic helpers
    function calculateCollateralRatio(...) external view returns (uint256);
    function shouldLiquidate(...) external view returns (bool);
}
```

## 🛠️ Environment Setup

### Configure Environment

Create a `.env` file or export variables:

```bash
# Required
export PRIVATE_KEY=0xyour_private_key_here
export RPC_URL=https://your_rpc_url_here

# Optional
export SWITCHBOARD_ADDRESS=0x...  # Override default
export NETWORK=monad-testnet      # Network name
export CONTRACT_ADDRESS=0x...     # Deployed contract
```

### Network-Specific RPC URLs

**Monad:**
- Testnet: `https://testnet-rpc.monad.xyz`
- Mainnet: `https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY`

## 📂 Examples Overview

### `/scripts/run.ts` - Complete Integration Example

Full end-to-end demonstration:
- Deploy or connect to existing contract
- Fetch oracle data from Crossbar
- Submit price updates on-chain
- Query and verify prices
- Demonstrate business logic

```bash
# Run with environment variables
RPC_URL=$RPC_URL \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=monad-testnet \
bun scripts/run.ts
```

### `/examples/updateFeed.ts` - Legacy Update Example

Basic price update example (legacy):

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export EXAMPLE_ADDRESS=0x...

# Run update
bun examples/updateFeed.ts
```

### `/examples/surgeToEvmConversion.ts` - Surge to EVM Format Converter

Convert Switchboard Surge updates to EVM-compatible format:

```bash
# Basic conversion with sample data
bun run surge-convert

# With custom surge data file
SURGE_DATA_FILE=path/to/surge-data.json bun run surge-convert
```

This utility demonstrates how to:
- Convert Surge update responses to EVM format
- Parse and validate the encoded data structure
- Use the converted data with EVM smart contracts

The conversion follows the tight-packed format:
- Header: slot(8) + timestamp(8) + numFeeds(1) + numSigs(1)
- Feed data: feedHash(32) + value(16) + minSamples(1) per feed
- Signatures: signature(64) + recoveryId(1) per signature

## 🏃‍♂️ Getting Started

### Step 1: Build the Contract

```bash
# Install Foundry dependencies
forge install

# Build contracts
forge build
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 3 files with 0.8.22
[⠢] Solc 0.8.22 finished in 1.23s
Compiler run successful!
```

### Step 2: Deploy the Contract

#### Option A: Using Foundry Script (Recommended)

```bash
# Monad Testnet
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv

# Monad Mainnet
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url $MONAD_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

#### Option B: Using npm Scripts

```bash
# Monad Testnet
bun run deploy:monad-testnet

# Monad Mainnet
MONAD_RPC_URL=https://... bun run deploy:monad-mainnet
```

#### Option C: Direct Forge Create

```bash
forge create src/SwitchboardPriceConsumer.sol:SwitchboardPriceConsumer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args 0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33  # Monad Testnet
```

**Save the deployed contract address!**

### Step 3: Run the Example

```bash
# Complete example with deployment, update, and queries
RPC_URL=$RPC_URL \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=monad-testnet \
bun scripts/run.ts
```

## 📊 Available Feeds

| Asset | Feed Hash |
|-------|-----------|
| BTC/USD | `0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812` |
| ETH/USD | `0xa0950ee5ee117b2e2c30f154a69e17bfb489a7610c508dc5f67eb2a14616d8ea` |
| SOL/USD | `0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9` |
| SUI/USD | `0x7ceef94f404e660925ea4b33353ff303effaf901f224bdee50df3a714c1299e9` |

Find more feeds at: [https://explorer.switchboard.xyz](https://explorer.switchboard.xyz)

## 💡 TypeScript SDK Usage

### Fetching and Submitting Updates

```typescript
import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';

// Setup
const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, ABI, signer);

// Fetch oracle data
const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
const response = await crossbar.fetchOracleQuote(
  [feedHash],
  'mainnet'
);

// Get fee and submit
const switchboard = new ethers.Contract(switchboardAddress, SWITCHBOARD_ABI, signer);
const fee = await switchboard.getFee([response.encoded]);

const tx = await contract.updatePrices([response.encoded], { value: fee });
await tx.wait();

// Query updated price
const [value, timestamp, slotNumber] = await contract.getPrice(feedId);
console.log(`Price: ${ethers.formatUnits(value, 18)}`);
```

## 🔧 Customizing for Your Use Case

### Example: Lending Protocol

```solidity
contract LendingProtocol {
    SwitchboardPriceConsumer public priceConsumer;
    
    function borrow(
        bytes32 collateralFeedId,
        uint256 collateralAmount,
        uint256 borrowAmount
    ) external {
        // Check collateral ratio
        uint256 ratio = priceConsumer.calculateCollateralRatio(
            collateralFeedId,
            collateralAmount,
            borrowAmount
        );
        
        require(ratio >= 15000, "Insufficient collateral"); // 150% minimum
        
        // Process borrow...
    }
    
    function liquidate(
        address borrower,
        bytes32 collateralFeedId
    ) external {
        // Check if liquidation is needed
        bool shouldLiq = priceConsumer.shouldLiquidate(
            collateralFeedId,
            positions[borrower].collateral,
            positions[borrower].debt,
            11000 // 110% threshold
        );
        
        require(shouldLiq, "Position is healthy");
        
        // Process liquidation...
    }
}
```

### Example: DEX Price Oracle

```solidity
contract DEX {
    SwitchboardPriceConsumer public priceConsumer;
    
    function getSwapRate(
        bytes32 tokenAFeedId,
        bytes32 tokenBFeedId
    ) external view returns (uint256) {
        (int128 priceA,,) = priceConsumer.getPrice(tokenAFeedId);
        (int128 priceB,,) = priceConsumer.getPrice(tokenBFeedId);
        
        require(priceConsumer.isPriceFresh(tokenAFeedId), "Stale price A");
        require(priceConsumer.isPriceFresh(tokenBFeedId), "Stale price B");
        
        return (uint128(priceA) * 1e18) / uint128(priceB);
    }
}
```

## 🐛 Troubleshooting

### "Insufficient fee"
- The update fee is dynamic based on oracle responses
- Always query `switchboard.getFee(updates)` before submitting
- Send exact fee amount or slightly more (excess is refunded)

### "Price deviation too high"
- Price changed > 10% from last update (default)
- Normal during high volatility
- Adjust `maxDeviationBps` via `updateConfig()` if needed

### "Price too old"
- Data is older than `maxPriceAge` (default: 5 minutes)
- Fetch fresh data before calling functions that check freshness
- Adjust `maxPriceAge` via `updateConfig()` if needed

### Build Errors
```bash
# Clean and rebuild
forge clean
forge build

# Update dependencies
forge update
```

## 📚 Additional Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Switchboard Explorer](https://explorer.switchboard.xyz)
- [Feed Builder Tool](https://explorer.switchboard.xyz/feed-builder)
- [Solidity SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand-solidity)
- [Discord Community](https://discord.gg/switchboardxyz)
- [GitHub Issues](https://github.com/switchboard-xyz/evm-on-demand/issues)

## 📖 Advanced Topics

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions and production checklist.

See [CHANGELOG.md](./CHANGELOG.md) for version history and migration guides.

---

For more examples and documentation, visit [docs.switchboard.xyz](https://docs.switchboard.xyz)
