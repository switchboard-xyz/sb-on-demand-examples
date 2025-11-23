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

> **Note**: All feeds listed below are **sponsored on Monad**, meaning oracle updates are subsidized and require no payment from users on the Monad network.

### Major Cryptocurrencies
| Asset | Feed ID |
|-------|---------|
| BTC/USD | `0xc982e4a199a32e2af854a0611fff614037d1227dbae9695a571d11c545821465` |
| ETH/USD | `0x53e74e6243e0ca032df64f3aaa824b63b45ede4a8cc74b8a5e2bceacdd8dc527` |
| SOL/USD | `0x87d45df168bbb669a0dfdb40d7f3fa783636f76ecdae84f5f429e81f6cf84dd2` |
| SUI/USD | `0xcb318ebfa28939342bf346cbd312c6198d018fc0bee0056ed69212bc84fc3d50` |
| XRP/USD | `0x5d63074ce9c2ee63884aa68a3afd18644e5fbee96eb3d1448264c90f2662b75e` |
| BNB/USD | `0xfb2e5814aa90b8cac7783a34e2eff9fb1c3d4c484e6954774b9963c66c5b5e2e` |
| DOGE/USD | `0x8e50f21c80712dd4983eff17f297f15e1fa972c7b41226f0c813153d72441e22` |
| ADA/USD | `0xed9b64610bd3c2810dee07eb5edc4409fd8e8500293232aac70920733bd3403a` |
| AVAX/USD | `0x3fa3bf1adf503c346665a2e85ea4e12a5bce54ccb3e2e18357a414d6044f6288` |

### Layer 1 & Layer 2
| Asset | Feed ID |
|-------|---------|
| TIA/USD | `0xfcb5e7dd8384afb4799e935120fe5138b94f1b91ecb1e1126e193dce38868a7f` |
| OP/USD | `0xa15bca0dd91090b8a339412ce41abd0e628bb9ff277ba1f7529a6653cba8efde` |
| ARB/USD | `0xc554fc5f64599e0dfdd1142af7a6290f2f83f9e878362032e7b414247a48fd37` |
| APT/USD | `0xba09209cbe07a26cfab693b7ff69492cd70ff8afe3c2a167efed0229f64aa9a2` |
| SEI/USD | `0x90b4d4ec44fa91e01479ff8daced948a5df4a4758c6e7f2fb1a7b27ee04b9ddd` |
| POL/USD | `0x19a4d3859540bcef14d41cdd1292331af58658ffde851515626993a75489ec49` |
| BERA/USD | `0xc5bd5c327228920191e2d6e0110ccc102c0a3e513d4247b1869b5b85dd13e993` |
| HYPE/USD | `0x63e105a067be323be6114d3b6c6d96293203c4b8ad3d0dee5e159ea2af77b59c` |
| S/USD | `0x0e2600ac0fc377ca808f50dc3f28a08615e3be40db54204c6d0c57946da9e97e` |

### Stablecoins
| Asset | Feed ID |
|-------|---------|
| USDT/USD | `0xf20148550722dac1457ec620799712be61ada7b7b7667190f57ad4cb785664dd` |
| USDC/USD | `0x3ecc9b8580e1505918ec457f48de663606b4dfbe6a0b573e4f14aecb92188288` |
| DAI/USD | `0x5bfcabdc3836d7e16038d225deac28f3ebd6275d6585a906dada1e3bab69ace7` |
| USDS/USD | `0xf2b757149298533cd4e27fe07ef5ef999a4b3383e3888f14bb28cf12a1e6a2c7` |
| PYUSD/USD | `0x9ac21ccc4e8778c25119fa13a1e876f24a4bc42ca4f5912a05bec75759fa66d9` |
| USDE/USD | `0xa1453c8e2454c1cb51b529e48f96cc86f7ca3e249aa5d8c9b5dc048d11e43fa3` |
| FDUSD/USD | `0xbed6981367231efa695de20057cf2fdb3dfb65f03024f514a333ad4a52a8968b` |
| AUSD/USD | `0x11ab2a6544fd8c4db4299dfd0ac30089cb2d0aac9752e57e816ccc5ab67549fe` |
| USR/USD | `0x1f5a6ebeb522f5ba544cb89697a58b96f19f4929da34a26587b4e3e344504066` |

### Wrapped & Liquid Staking Tokens
| Asset | Feed ID |
|-------|---------|
| WBTC/USD | `0x0b83fcfc4e041a3154d015f32aa08e07486c108bd5e87512ec914f88eed9e38b` |
| LBTC/USD | `0x16f88b6d98fa4b6be9109571db6ae27077d771fd838a2d74be54167086d1c5c2` |
| cbBTC/USD | `0x37e7b4a51ba4ee125be1d6b05705199490f5fcc250687357c57cd2ae57b088a6` |
| solvBTC/USD | `0xffc7b7f3fe02719f2deb324504d19ad3c801a2c16ac91d7a7e19e6a565d18065` |
| WETH/USD | `0x0defbb4974f1afc44e41b96e6d6e8feff8a4ada01307a0a189d90ca6557b2719` |
| STETH/USD | `0x75d4d4262e456396a66c780c0862ccaf759c568dcf42c41e70ced26dc78dbb75` |
| wstETH/USD | `0x865eb735e3fcf06f1ab4df86154dbc0c6e3fdcb7ccd3200f9e1c2fff7977e999` |
| WEETH/USD | `0x17ab4d2ed95630cc9936f5cb37624194ffb4fc0bda387cd2a682c3e0ecd04578` |
| rsETH/USD | `0xc75bd8c010fbfffa832a5827051b92cf02b2ce121fbd860bca5aa27289ad11f3` |
| ezETH/USD | `0x2bd5044aadddce1d28f96ff011b12ea59c565f1ae93505b23714957e81f76bb6` |
| STONE/USD | `0xf228c11fbee4509822ed4d880993040b608ea66e73c6b20e4223a0dcafe2eeab` |
| sUSDS/USD | `0x9e7412b2b399b4b5304a41ed18076bd15195e99d86e4fdeba5d75842c932bf94` |
| sUSDe/USD | `0x024505bcd3408298c7ecc9b4fa1ec227ff8149ec2226db14e37ed2a1bfd81874` |

### DeFi Tokens
| Asset | Feed ID |
|-------|---------|
| LINK/USD | `0x5716f423bdd0977a24384520982a6156feabb734255a486346ce97eba4db9bb5` |
| UNI/USD | `0xab3a6a71ebf9e08f2e5613a2da857fd3718cabd649566400c25f1339b0de5b23` |
| AAVE/USD | `0x2a279cd969e475234690072a3aedd24ea227653306d4ee13a03591c13eddf4d1` |
| CAKE/USD | `0x88ecdee5d25396097c6b07eae577d5e9db264baad344e50a5fbdcad68a72f9cf` |
| PYTH/USD | `0x66994123d22aa7d936047f2b30a947dc5380d33af34a0d8a510deda8b2b1de39` |

### Bridge & Cross-Chain
| Asset | Feed ID |
|-------|---------|
| AXL/USD | `0x308ae8b637663ffe5196d156a0f06b27f667e087c0050848d87aa5d68f4ebde9` |
| ZRO/USD | `0xec8ed9d9b5449a175ff357a38e08007699b628df5bea308afc5a279edd02ac02` |
| STG/USD | `0xfd7a2e4bac42db5ca96a8a50592aedbe5101c87ca46bb8da1565fe9a99102056` |
| W/USD | `0x7cef43e612e03552f9a106d258b45286b99c4d8d021acfc3fc362486e0e53fec` |
| RED/USD | `0x687f58993ff7cc81f9a025ba7d8397f9cb7655ca780bd2013c57ce8e6f153e91` |

### Commodities
| Asset | Feed ID |
|-------|---------|
| XAU/USD (Gold) | `0x8ba9dd33ff5a0c241d9868f019156f2fa7a6b35ff84c52826fcd86734a606b0d` |
| XAG/USD (Silver) | `0x806f186a854239b8f35576770333e169d0ea74712bd18acbe99466d79e49fcb4` |

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
