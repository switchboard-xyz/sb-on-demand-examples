# EVM On-Demand Examples

This directory contains examples for using Switchboard On-Demand functionality on EVM-compatible chains.

## 📁 Directory Structure

```
evm/
├── src/               # Solidity smart contracts
│   └── Example.sol
├── script/            # Foundry deployment scripts
│   └── Deploy.s.sol
├── examples/          # TypeScript client examples
│   ├── updateFeed.ts
│   └── utils.ts
├── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 16+ and npm/yarn/bun
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for Solidity development
- An EVM wallet with testnet ETH (we'll use Hyperliquid)

### Installation

#### 1. Install Dependencies

```bash
# Install Node.js dependencies
bun install

# Install Foundry dependencies (if needed)
forge install
```

#### 2. Set up Forge Remappings

The project uses Switchboard's On-Demand Solidity SDK. For Forge to properly resolve imports, create a `remappings.txt` file (already included) with:

```
@switchboard-xyz/on-demand-solidity/=node_modules/@switchboard-xyz/on-demand-solidity/
```

This allows you to import Switchboard contracts like:
```solidity
import {ISwitchboard} from "@switchboard-xyz/on-demand-solidity/ISwitchboard.sol";
import {Structs} from "@switchboard-xyz/on-demand-solidity/structs/Structs.sol";
```

#### 3. Verify Installation

You can verify that Forge can find the Switchboard contracts:

```bash
forge build
```

### Environment Setup

Create a `.env` file:

```bash
# Your private key (with 0x prefix)
PRIVATE_KEY=your_private_key_here

# Aggregator ID for the price feed you want to use (bytes32 format)  
AGGREGATOR_ID=0x354dc60a62426b6fb787b00ad0fb4d9a280f60e3ada8678cf2a6e940513100ea

# Switchboard on-demand contract address (network dependent)
# Hyperliquid: 0x316fbe540c719970e6427ccd8590d7e0a2814c5d
# See https://docs.switchboard.xyz for other networks
SWITCHBOARD_ADDRESS=0x316fbe540c719970e6427ccd8590d7e0a2814c5d

# Contract address (will be set after deployment)
EXAMPLE_ADDRESS=
```

Then run:
```bash
source .env
```


## Example Price Feed Integration

This example demonstrates how to integrate Switchboard on-demand price feeds into your smart contracts.

### 1. Deploy the Example Contract

```bash
# Deploy to Hyperliquid
forge script script/Deploy.s.sol:DeployScript --rpc-url https://rpc.hyperliquid.xyz/evm --broadcast -vv
```

The deployment script will:
- Deploy the `Example.sol` contract
- Configure it with the Switchboard oracle address
- Set up your chosen aggregator ID
- Output the deployed contract address

Then add `EXAMPLE_ADDRESS=0x...` with your deployed contract address to the environment file or export it. 

```bash
# add `EXAMPLE_ADDRESS=0x...` OR run `export EXAMPLE_ADDRESS=0x...`
source .env
```

### 2. Run the Price Update Example

```bash
# Update .env with the deployed EXAMPLE_ADDRESS
# Then run the price update script

# Using npm script
npm run update

# Or directly with bun
bun run examples/updateFeed.ts
```

This script demonstrates:
- Fetching signed price data from Switchboard's Crossbar instance
- Submitting the oracle update to your contract
- Reading the updated price from the contract
- Event parsing and logging

### Finding and Verifying Feeds

1. **Feed Builder**: Use [explorer.switchboardlabs.xyz/feed-builder](https://explorer.switchboardlabs.xyz/feed-builder) to:
   - Build custom feed Oracle Quotes
   - Verify feed checksums
   - Test feed updates before integration

2. **Explorer**: Visit [explorer.switchboard.xyz](https://explorer.switchboard.xyz) to:
   - Browse all available feeds
   - View feed configurations and history
   - Verify feed integrity and performance

3. **Network-Specific Feeds**: Find feeds for your network at:
   - Hyperliquid: [https://beta.ondemand.switchboard.xyz/hyperevm/mainnet](https://beta.ondemand.switchboard.xyz/hyperevm/mainnet)
   - Other networks: Use the explorer to filter by chain

## 🌐 Supported Networks

| Network | Chain ID | Switchboard Contract |
|---------|----------|---------------------|
| HyperEVM Mainnet | 999 | `0x316fbe540c719970e6427ccd8590d7e0a2814c5d` |
| Arbitrum One | 42161 | `0xAd9b8604b6B97187CDe9E826cDeB7033C8C37198` |
| Arbitrum Sepolia | 421614 | `0xA2a0425fA3C5669d384f4e6c8068dfCf64485b3b` |
| Core Mainnet | 1116 | `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C` |
| Core Testnet2 | 1114 | `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C` |
| Monad Testnet | 10143 | `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C` |

**⚠️ Important**: Always verify the current contract addresses at [docs.switchboard.xyz](https://docs.switchboard.xyz/product-documentation/data-feeds/evm/contract-addresses) as they may be updated.

## 📂 Examples Overview

The `examples/` directory contains TypeScript client code for interacting with Switchboard On-Demand:

- **`updateFeed.ts`** - Complete example of fetching and submitting oracle updates
- **`utils.ts`** - Shared utility functions and constants

These examples demonstrate the client-side integration patterns you'll use in your applications.

## Advanced Usage

### Custom Feed Integration

1. Find your desired feed at [ondemand.switchboard.xyz](https://ondemand.switchboard.xyz)
2. Copy the aggregator ID
3. Update your contract to use the new feed
4. Modify the examples to fetch your specific feed

### Error Handling

The example includes basic error handling:
- Insufficient fee errors
- Invalid result validation
- Transaction simulation before submission

## 📚 Resources

- [EVM Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/evm)
- [Solidity SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand-solidity)
- [TypeScript SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand)
- [Contract Addresses](https://docs.switchboard.xyz/product-documentation/data-feeds/evm/contract-addresses)
- [Available Feeds](https://ondemand.switchboard.xyz)

## 🤝 Support

- [Discord](https://discord.gg/switchboard)
- [GitHub Issues](https://github.com/switchboard-xyz/evm-on-demand/issues)
- [Documentation](https://docs.switchboard.xyz)