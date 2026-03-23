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

## Build

```bash
npm run build
# or
cargo build-sbf
```

Deploy the example program before running the verification flow:

```bash
anchor build
anchor deploy --provider.cluster devnet
```

## Usage

Show the CLI and required flags:

```bash
npm run test
```

Run Kalshi feed verification:

```bash
npm run start -- \
  --api-key-id YOUR_KALSHI_API_KEY_ID \
  --private-key-path /path/to/kalshi/private-key.pem \
  --order-id YOUR_KALSHI_ORDER_ID
```

## Project Structure

```
prediction-market/
├── programs/
│   └── prediction-market/              # Anchor program
├── scripts/
│   ├── testKalshiFeedVerification.ts   # Verification script
│   └── utils.ts                        # Program loader helpers
├── Anchor.toml
├── Cargo.toml
└── package.json
```
