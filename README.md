<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand Examples
Example repositories for Switchboard's latest on-demand functionality across multiple blockchain ecosystems.

</div>

## Quick Links

- **[User Guide and Technical Documentation](https://docs.switchboard.xyz/tooling-and-resources/technical-resources-and-documentation)** - Detailed information on getting started, usage examples, and API references.
- **[TypeDoc Documentation](https://switchboard-docs.web.app/)** - Comprehensive TypeDoc generated documentation.
- **[Feed Builder](https://explorer.switchboardlabs.xyz/feed-builder)** - Build and verify custom price feeds with checksum validation.
- **[Explorer](https://explorer.switchboard.xyz)** - Browse feeds, verify integrity, and view historical data.

## 🌐 Examples by Chain

### Solana

The Solana examples demonstrate Switchboard On-Demand functionality on the Solana blockchain:

- **[📊 On-Demand Feeds](./solana)** - Price feeds and data oracles
- **[🎲 On-Demand Randomness](./solana/examples/randomness)** - Verifiable Random Function (VRF)
- **[🔧 Variable Overrides](./solana/examples/variable-overrides)** - Secure credential management with variable substitution

**JavaScript/TypeScript Client Code:**
- **[📁 Client Examples](./solana/scripts/)** - Complete JavaScript/TypeScript examples for integrating Switchboard On-Demand
  - Feed operations, streaming, job testing, benchmarks, and utilities
  - Ready-to-run scripts for oracle quotes, Surge WebSocket streaming, and more

**Resources:**
- [Rust Crate](https://crates.io/crates/switchboard-on-demand)
- [Solana SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand)

### Sui

The Sui examples demonstrate Switchboard On-Demand oracle functionality on the Sui blockchain:

- **[🔮 Oracle Feeds](./sui)** - Pull-based price feeds with fresh oracle data
- Real-time data fetching from external APIs through oracle networks
- On-demand feed updates with aggregated results from multiple oracles

**JavaScript/TypeScript Client Code:**
- **[📁 Feed Examples](./sui/scripts/)** - Complete TypeScript examples for Sui integration
  - Oracle data fetching, feed reading, transaction simulation
  - No private key required for data reading and simulation

**Resources:**
- [Sui Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/sui)
- [Sui SDK](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)

### EVM

The EVM examples showcase Switchboard functionality on Ethereum and EVM-compatible chains:

- **[📈 Price Feeds](./evm)** - Real-time price data for DeFi applications

**Supported Networks:**
- Ethereum, Hyperliquid, Arbitrum, Optimism, Base, Polygon, BNB Chain, Avalanche

**Resources:**
- [EVM Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/evm)
- [Solidity SDK](https://www.npmjs.com/package/@switchboard-xyz/evm.js)

## 🚀 Getting Started

Each directory contains specific examples with their own setup instructions. Choose your blockchain platform above to explore the relevant examples.

For comprehensive documentation and integration guides, visit our [official documentation](https://docs.switchboard.xyz/)
