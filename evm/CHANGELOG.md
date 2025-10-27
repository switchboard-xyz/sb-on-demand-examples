# Changelog

## [2.0.0] - 2025-10-27

### 🎉 Major Update: Modern Switchboard Integration

This release completely overhauls the EVM examples with a production-ready implementation using the latest Switchboard contracts.

### ✨ Added

#### Solidity Contract
- **`src/SwitchboardPriceConsumer.sol`**: Production-ready price consumer with:
  - Multi-feed support with efficient storage
  - Price deviation validation (prevents manipulation)
  - Staleness checks (configurable max age)
  - Business logic examples (collateral ratios, liquidations)
  - Comprehensive events and error handling
  - Gas-optimized implementation
  - Full NatSpec documentation

#### TypeScript Scripts
- **`scripts/run.ts`**: Complete end-to-end example
  - Automatic deployment or use existing contract
  - Fetch oracle data from Crossbar
  - Submit price updates on-chain
  - Query and verify prices
  - Demonstrate business logic
  - Support for multiple networks (Monad, Arbitrum, Core)

#### Deployment
- **`script/DeploySwitchboardPriceConsumer.s.sol`**: Foundry deployment script
  - Network-specific Switchboard addresses
  - Environment variable support
  - Deployment verification
  - Configuration display

#### Documentation
- **`README.md`**: Comprehensive guide with:
  - 30-second quick start
  - Expected output examples
  - Security features explanation
  - Business logic examples (lending, DEX, options)
  - Network-specific configurations
  - Troubleshooting guide
  - TypeScript SDK usage

- **`DEPLOYMENT.md`**: Step-by-step deployment guide
  - Multi-network support
  - Foundry script usage
  - Contract verification
  - Configuration after deployment
  - Production checklist

- **`CHANGELOG.md`**: Version history and migration guide

#### Configuration
- **`package.json`**: Updated with new scripts:
  - `bun run example`: Run complete example
  - `bun run build`: Build contracts
  - `bun run test`: Run tests
  - `bun run deploy`: Deploy to network
  - `bun run deploy:monad-testnet`: Deploy to Monad testnet
  - `bun run deploy:monad-mainnet`: Deploy to Monad mainnet

### 🔄 Changed

#### Project Structure
- Moved legacy examples to `legacy/` directory
  - `legacy/src/Example.sol`
  - `legacy/script/Deploy.s.sol`
  - `legacy/examples/`

#### Dependencies
- Added local Switchboard contract copies for better compatibility
  - `src/switchboard/interfaces/ISwitchboard.sol`
  - `src/switchboard/libraries/SwitchboardTypes.sol`

### 🔧 Fixed

#### Build System
- Resolved import path issues
- Fixed Foundry compilation errors
- Updated remappings for better compatibility

### 📊 Network Support

Added comprehensive support for:
- **Monad Mainnet** (Chain ID: 143)
  - Switchboard: `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67`
- **Monad Testnet** (Chain ID: 10143)
  - Switchboard: `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C`
- **Arbitrum One** (Chain ID: 42161)
  - Switchboard: `0xAd9b8604b6B97187CDe9E826cDeB7033C8C37198`
- **Arbitrum Sepolia** (Chain ID: 421614)
  - Switchboard: `0xA2a0425fA3C5669d384f4e6c8068dfCf64485b3b`
- **Core Mainnet** (Chain ID: 1116)
  - Switchboard: `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C`
- **Core Testnet** (Chain ID: 1114)
  - Switchboard: `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C`

### 🎯 Migration Guide

If you're upgrading from the old Example.sol:

#### Old Approach
```solidity
contract Example {
    ISwitchboard switchboard;
    bytes32 public aggregatorId;
    int256 public latestPrice;
    
    function getFeedData(bytes[] calldata updates) public payable {
        switchboard.updateFeeds{value: fee}(updates);
        Structs.Update memory update = switchboard.latestUpdate(aggregatorId);
        latestPrice = update.result;
    }
}
```

#### New Approach
```solidity
contract SwitchboardPriceConsumer {
    ISwitchboard public immutable switchboard;
    mapping(bytes32 => PriceData) public prices;
    
    function updatePrices(bytes[] calldata updates) external payable {
        // Automatic signature verification
        switchboard.updateFeeds{value: fee}(updates);
        
        // Process and validate each feed
        for (uint256 i = 0; i < updates.length; i++) {
            // Deviation check
            // Freshness validation
            // Store price data
        }
    }
    
    // Business logic helpers
    function calculateCollateralRatio(...) external view returns (uint256);
    function shouldLiquidate(...) external view returns (bool);
}
```

### 📈 Benefits of New Implementation

1. **Better Security**
   - Price deviation validation
   - Staleness checks
   - Multi-layer verification

2. **More Features**
   - Multi-feed support
   - Business logic examples
   - Configurable parameters

3. **Production Ready**
   - Comprehensive error handling
   - Gas optimizations
   - Full documentation

4. **Better DX**
   - Clear examples
   - Multiple deployment options
   - Network-specific configs

### 🔗 Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Solidity SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand-solidity)
- [Explorer](https://explorer.switchboard.xyz)
- [Discord](https://discord.gg/switchboardxyz)

---

## [1.0.0] - Previous Release

Initial release with basic Example.sol (moved to legacy/).

