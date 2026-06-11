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
