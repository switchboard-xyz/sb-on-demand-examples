<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand Examples
Example repositories for Switchboard's latest on-demand functionality across multiple blockchain ecosystems.

</div>

## Quick Links

- **[User Guide and Technical Documentation](https://docs.switchboard.xyz/)** - Detailed information on getting started, usage examples, and API references.
- **[Common TypeDoc Documentation](https://switchboardxyz-common.netlify.app/)** - TypeDoc for @switchboard-xyz/common shared utilities.
- **[Feed Builder](https://explorer.switchboardlabs.xyz/feed-builder)** - Build and verify custom price feeds with checksum validation.
- **[Feed Builder Documentation](https://explorer.switchboardlabs.xyz/task-docs)** - Documentation for oracle tasks and feed building.
- **[Explorer](https://explorer.switchboard.xyz)** - Browse feeds, verify integrity, and view historical data.

## 🌐 Examples by Chain

### Solana

The Solana examples demonstrate Switchboard On-Demand functionality on the Solana blockchain:

- **[📊 On-Demand Feeds](./solana)** - Price feeds and data oracles
- **[🎲 On-Demand Randomness](./solana/randomness)** - Verifiable Random Function (VRF)
- **[🔧 Variable Overrides](./common/variable-overrides)** - Secure credential management with variable substitution

**JavaScript/TypeScript Client Code:**
- **[📁 Client Examples](./solana/)** - Complete JavaScript/TypeScript examples for integrating Switchboard On-Demand
  - Feed operations, streaming, benchmarks, and utilities
  - Ready-to-run examples for oracle quotes, Surge WebSocket streaming, and more

**Resources:**
- [Rust Crate](https://crates.io/crates/switchboard-on-demand)
- [Solana SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand)
- [TypeDoc Documentation](https://switchboard-docs.web.app/)

### Sui

The Sui examples demonstrate Switchboard On-Demand oracle functionality on the Sui blockchain:

- **[🔮 Oracle Feeds](./sui)** - Pull-based price feeds with fresh oracle data
- Real-time data fetching from external APIs through oracle networks
- On-demand feed updates with aggregated results from multiple oracles

**JavaScript/TypeScript Client Code:**
- **[📁 Feed Examples](./sui/)** - Complete TypeScript examples for Sui integration
  - Oracle data fetching, feed reading, transaction simulation
  - No private key required for data reading and simulation

**Resources:**
- [Sui Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/sui)
- [Sui SDK](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)

### EVM

The EVM examples showcase Switchboard functionality on EVM-compatible chains:

- **[📈 Price Feeds](./evm)** - Real-time price data for DeFi applications
- **[🎲 On-Demand Randomness](./evm/randomness/)** - Verifiable Random Function (VRF)

**Supported Networks:**
- Monad (Mainnet & Testnet)
- Hyperliquid (Mainnet)

**Resources:**
- [EVM Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/evm)
- [Solidity SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand-solidity)

## 🌍 Chain-Agnostic Resources

The **[`common/`](./common/)** directory contains tools and examples that work across all blockchain platforms:

- **[Variable Overrides](./common/variable-overrides/)** - Secure credential management for oracle feeds
  - Use variables for API keys/auth tokens only
  - Maintain feed verifiability with hardcoded data sources
  - Works identically on Solana, EVM, and Sui

- **[Job Testing](./common/job-testing/)** - Test and develop custom oracle job definitions
  - Works identically on Solana, EVM, and Sui
  - Validate API integrations before on-chain deployment

- **[Streaming](./common/streaming/)** - Real-time unsigned price streaming via WebSocket
  - Chain-agnostic price monitoring for UIs and dashboards
  - Ultra-low latency data feeds

These resources let you design and test oracle functionality once, then deploy on any supported blockchain.

## 🚀 Getting Started

Each directory contains specific examples with their own setup instructions. Choose your blockchain platform above to explore the relevant examples.

For comprehensive documentation and integration guides, visit our [official documentation](https://docs.switchboard.xyz/)
