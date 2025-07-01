# EVM On-Demand Examples

This directory contains examples for using Switchboard On-Demand functionality on EVM-compatible chains.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm/yarn/bun
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for Solidity development
- An EVM wallet with testnet ETH (we'll use Arbitrum Sepolia)

### Installation

```bash
# Install dependencies
bun install

# Install Foundry dependencies
forge install
```

### Environment Setup

Create a `.env` file:

```bash
# Your private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Aggregator ID for the price feed you want to use
AGGREGATOR_ID=0x755c0da00f939b04266f3ba3619ad6498fb936a8bfbfac27c9ecd4ab4c5d4878

# Contract address (will be set after deployment)
EXAMPLE_ADDRESS=
```

## 📋 Example: Price Feed Integration

This example demonstrates how to integrate Switchboard on-demand price feeds into your smart contracts.

### 1. Deploy the Example Contract

```bash
# Deploy to Arbitrum Sepolia
forge script script/Deploy.s.sol:DeployScript --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast -vv
```

The deployment script will:
- Deploy the `Example.sol` contract
- Configure it with the Switchboard oracle address
- Set up your chosen aggregator ID
- Output the deployed contract address

### 2. Run the Bundle Example

```bash
# Update .env with the deployed EXAMPLE_ADDRESS
# Then run the price update script
bun run scripts/runBundle.ts
```

This script demonstrates:
- Fetching signed price data from Switchboard's Crossbar network
- Submitting the oracle update to your contract
- Reading the updated price from the contract
- Performance monitoring and statistics

### 3. Single Update Example

For a one-time price update:

```bash
bun run index.ts
```

## 📁 Project Structure

```
evm-on-demand/
├── src/
│   └── Example.sol          # Example contract consuming oracle data
├── script/
│   └── Deploy.s.sol         # Foundry deployment script
├── scripts/
│   ├── runBundle.ts         # Continuous price update example
│   └── utils.ts             # Helper utilities
├── index.ts                 # Single update example
├── foundry.toml            # Foundry configuration
├── package.json            # Node dependencies
└── tsconfig.json           # TypeScript configuration
```

## 🔧 Key Components

### Smart Contract (`src/Example.sol`)

The example contract demonstrates:
- Integrating with the Switchboard ISwitchboard interface
- Storing aggregator IDs for price feeds
- Processing oracle updates with proper fee handling
- Emitting events for price updates

### TypeScript Client (`scripts/runBundle.ts`)

Shows how to:
- Connect to Switchboard's Crossbar network
- Fetch encoded oracle updates
- Submit updates to your contract
- Monitor performance and latency

## 📊 Available Price Feeds

Popular feeds on Arbitrum Sepolia:
- **UNI/USD**: `0x755c0da00f939b04266f3ba3619ad6498fb936a8bfbfac27c9ecd4ab4c5d4878`
- **Carbon Intensity GB**: `0xba2c99cb1c50d8c77209adc5a45f82e561c29f5b279dca507b4f1324b6586572`

### Finding and Verifying Feeds

1. **Bundle Builder**: Use [beta.ondemand.switchboard.xyz/bundle-builder](https://beta.ondemand.switchboard.xyz/bundle-builder) to:
   - Build custom feed bundles
   - Verify feed checksums
   - Test feed updates before integration

2. **Explorer**: Visit [explorer.switchboard.xyz](https://explorer.switchboard.xyz) to:
   - Browse all available feeds
   - View feed configurations and history
   - Verify feed integrity and performance

3. **Network-Specific Feeds**: Find feeds for your network at:
   - Arbitrum Sepolia: [ondemand.switchboard.xyz/arbitrum/sepolia](https://ondemand.switchboard.xyz/arbitrum/sepolia)
   - Other networks: Use the explorer to filter by chain

## 🌐 Supported Networks

| Network | Chain ID | Switchboard Contract |
|---------|----------|---------------------|
| Arbitrum Sepolia | 421614 | `0xA2a0425fA3C5669d384f4e6c8068dfCf64485b3b` |
| Arbitrum One | 42161 | See [docs](https://docs.switchboard.xyz) |
| Ethereum Mainnet | 1 | See [docs](https://docs.switchboard.xyz) |
| Optimism | 10 | See [docs](https://docs.switchboard.xyz) |
| Base | 8453 | See [docs](https://docs.switchboard.xyz) |

## 🛠️ Advanced Usage

### Custom Feed Integration

1. Find your desired feed at [ondemand.switchboard.xyz](https://ondemand.switchboard.xyz)
2. Copy the aggregator ID
3. Update your contract to use the new feed
4. Modify the scripts to fetch your specific feed

### Gas Optimization

- Use multicall to update multiple feeds in one transaction
- Implement caching to avoid unnecessary updates
- Set appropriate staleness thresholds

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