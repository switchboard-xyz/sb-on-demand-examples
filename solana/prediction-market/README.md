# Solana Prediction Market Example

Switchboard integration for prediction market feeds (Kalshi) on Solana.

## Overview

This example demonstrates how to integrate Switchboard oracle feeds for prediction market data sources like Kalshi. Use this to verify and consume prediction market outcomes on-chain.

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- Node.js 18+

## Setup

```bash
npm install
```

Current SDK install:

```bash
npm install @switchboard-xyz/common@^5.8.2 @switchboard-xyz/on-demand@^3.10.3
```

Current on-chain SDKs:

```toml
switchboard-on-demand = { version = "0.13.0", features = ["anchor", "devnet"] }
switchboard-protos = { version = "0.2.6", features = ["serde"] }
```

Verified local commands:

```bash
npm test
cargo build-sbf
```

`npm test` runs help mode and does not require Kalshi credentials. Full Kalshi verification still requires API credentials, a private key PEM, and live Solana RPC access.

## Build

```bash
npm run build
# or
cargo build-sbf
```

## Usage

Test Kalshi feed verification:

```bash
npm run start
# or
npm run test
```

## Project Structure

```
prediction-market/
├── programs/
│   └── prediction-market/              # Anchor program
├── scripts/
│   └── testKalshiFeedVerification.ts   # Test script
├── Anchor.toml
├── Cargo.toml
└── package.json
```
