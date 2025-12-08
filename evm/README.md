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

### Step 1: Install & Build

```bash
# Install all dependencies (JS + Solidity)
bun install

# Build contracts
forge build
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
| MON/USD | `0x2d5f0a89b34b1df59445c51474b6ec540e975b790207bfa4b4c4512bfe63ec47` |
| BTC/USD | `0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812` |
| ETH/USD | `0xa0950ee5ee117b2e2c30f154a69e17bfb489a7610c508dc5f67eb2a14616d8ea` |
| SOL/USD | `0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9` |
| SUI/USD | `0x7ceef94f404e660925ea4b33353ff303effaf901f224bdee50df3a714c1299e9` |
| XRP/USD | `0x4403dfe267ac4f30e15c10e21fb8ddfc4a4d42f69f2ca3d88c18c657f0ff8710` |
| BNB/USD | `0x962d4dbb6ae366e1de9315d7055a46bd363d529f54059f6a6c2e6a245bebf825` |
| DOGE/USD | `0x5bc6d1f034f43bb9fb09064ab68334c155d9af931fad52eb13119caa75b126c3` |
| ADA/USD | `0x695237a767cd572030dfecaf163b1e396fc622b739e4bf5b18429e96c7759392` |
| AVAX/USD | `0x816c9411e88fbaecb344754c55cb325db1923c37c2c58980da7c3287d3206697` |

### Layer 1 & Layer 2
| Asset | Feed ID |
|-------|---------|
| TIA/USD | `0x4a6072c172fcafd15e393b4428fea473135dafa52108870e8da12531ce44ce02` |
| OP/USD | `0x44296a1eda8f9ddc96da874ed8239d1a0d7e911ba267c953c059d3a51ed0f446` |
| ARB/USD | `0xdfb091ce2c14e99ade875c6d0a21761436864dae554e688917cca8d049825109` |
| APT/USD | `0x09e6d48cf5725b99da96c1722cf2319ea9a6aea89cc7451cbfd026d8368e58cb` |
| SEI/USD | `0x40fa0ee232f466da9d17579604ef8984ef672a89f1143388eb91afe252910f45` |
| POL/USD | `0x848c59f0b116434f254d46716d11f66e3fd6f8df1e578998d0d19b629eefd97f` |
| BERA/USD | `0x61d9b5f46c42482507bf862505e845494b5812131db3deacda71ca8302062333` |
| HYPE/USD | `0x63e105a067be323be6114d3b6c6d96293203c4b8ad3d0dee5e159ea2af77b59c` |
| S/USD | `0x7cffc1d82ed8f73b33e06830bb5979e63db793f9bfee7dd0e9a026ad96c2dc7b` |

### Stablecoins
| Asset | Feed ID |
|-------|---------|
| USDT/USD | `0x8327414619366bc88545bf72da9fb072d1c324fcd94deeea0bd189c8229e5bc9` |
| USDC/USD | `0x883ea8295f70ae506e894679d124196bb07064ea530cefd835b58c33a5ab6549` |
| DAI/USD | `0x5bfcabdc3836d7e16038d225deac28f3ebd6275d6585a906dada1e3bab69ace7` |
| USDS/USD | `0xf2b757149298533cd4e27fe07ef5ef999a4b3383e3888f14bb28cf12a1e6a2c7` |
| PYUSD/USD | `0x9ac21ccc4e8778c25119fa13a1e876f24a4bc42ca4f5912a05bec75759fa66d9` |
| USDE/USD | `0x048ce95123c42eecdb2b2185f5e711aaa4a3e3c1d27869ed271a8f67e294a333` |
| FDUSD/USD | `0xbed6981367231efa695de20057cf2fdb3dfb65f03024f514a333ad4a52a8968b` |
| AUSD/USD | `0x11ab2a6544fd8c4db4299dfd0ac30089cb2d0aac9752e57e816ccc5ab67549fe` |
| USR/USD | `0x1f5a6ebeb522f5ba544cb89697a58b96f19f4929da34a26587b4e3e344504066` |

### Wrapped & Liquid Staking Tokens
| Asset | Feed ID |
|-------|---------|
| WBTC/USD | `0x0b83fcfc4e041a3154d015f32aa08e07486c108bd5e87512ec914f88eed9e38b` |
| LBTC/USD | `0x16f88b6d98fa4b6be9109571db6ae27077d771fd838a2d74be54167086d1c5c2` |
| cbBTC/USD | `0x2c4138457be2c5e0bc82428240003cb49a2a7835f56d944b3a1e6de23d5414d4` |
| solvBTC/USD | `0xf09bd1f0c42ae5a1a409ada2aab8b9a6e76fc4eb5267eb9d6236c105bf7b247c` |
| WETH/USD | `0x0defbb4974f1afc44e41b96e6d6e8feff8a4ada01307a0a189d90ca6557b2719` |
| STETH/USD | `0x75d4d4262e456396a66c780c0862ccaf759c568dcf42c41e70ced26dc78dbb75` |
| wstETH/USD | `0xd5e712e5dda971f9544a7faf26edda464e558bb62c45cdfb2297b3507213f281` |
| WEETH/USD | `0x17ab4d2ed95630cc9936f5cb37624194ffb4fc0bda387cd2a682c3e0ecd04578` |
| rsETH/USD | `0xc75bd8c010fbfffa832a5827051b92cf02b2ce121fbd860bca5aa27289ad11f3` |
| ezETH/USD | `0x2bd5044aadddce1d28f96ff011b12ea59c565f1ae93505b23714957e81f76bb6` |
| STONE/USD | `0xf228c11fbee4509822ed4d880993040b608ea66e73c6b20e4223a0dcafe2eeab` |
| sUSDS/USD | `0x9e7412b2b399b4b5304a41ed18076bd15195e99d86e4fdeba5d75842c932bf94` |
| sUSDe/USD | `0x024505bcd3408298c7ecc9b4fa1ec227ff8149ec2226db14e37ed2a1bfd81874` |
| GMON/USD | `0x3569d06cfdcdfe181841d5582e09b264402bb49fe377b58ca644438fa59389e7` |

### DeFi Tokens
| Asset | Feed ID |
|-------|---------|
| LINK/USD | `0x8f4abf107a287e17fdd20055d328d74a30d4b636471552508dfb7c5432d4b7d5` |
| UNI/USD | `0x1c8ae5d2eaea755b3ef5146b75c74dc130be3d400d9859fb89407e829fc2d0d9` |
| AAVE/USD | `0x19c581a14f071f9cabab21166d37450203fff792c7937631d30372b3dcd15ad2` |
| CAKE/USD | `0x88ecdee5d25396097c6b07eae577d5e9db264baad344e50a5fbdcad68a72f9cf` |
| PYTH/USD | `0x50189d4b424c7ae432e4d050b4a7bca8816e9e6806932fee04efa79cc9cb9c46` |

### Bridge & Cross-Chain
| Asset | Feed ID |
|-------|---------|
| AXL/USD | `0x308ae8b637663ffe5196d156a0f06b27f667e087c0050848d87aa5d68f4ebde9` |
| ZRO/USD | `0xdaae1b232c2f41a2ebbe9add6644b10fb9535ab32f688d90364b0b3831c1801f` |
| STG/USD | `0xfd7a2e4bac42db5ca96a8a50592aedbe5101c87ca46bb8da1565fe9a99102056` |
| W/USD | `0xfbc53ad1560f56b5125607ae214950868cc7a45d7953d48175bcaccfdff362bb` |
| RED/USD | `0xe5fd72332a1e82394cba6527295cc7ec6b88985a825cba9e27f3050a649fdba0` |

### Commodities
| Asset | Feed ID |
|-------|---------|
| XAU/USD (Gold) | `0xce87065d6e7a7e7913fe01ffc1026500634e753e16df2afe593627aee57f06cf` |
| XAG/USD (Silver) | `0xc67736821132a0cd34c1d7fbc872868c808606666d1e54385dc8a6d60e437546` |

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
