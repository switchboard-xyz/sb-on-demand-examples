# Solana Randomness - Coin Flip Example

Switchboard randomness integration for on-chain games on Solana.

## Overview

This example demonstrates how to use Switchboard's verifiable randomness for on-chain gaming applications. The coin flip game uses cryptographically secure randomness that can be verified on-chain.

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- Node.js 18+

## Setup

```bash
npm install
```

## Build & Deploy

### 1. Generate Program Keypair

```bash
mkdir -p target/deploy
solana-keygen new -o target/deploy/sb_randomness-keypair.json --no-bip39-passphrase
```

### 2. Sync Program ID

This updates the program ID in both `lib.rs` and `Anchor.toml`:

```bash
anchor keys sync
```

### 3. Build and Deploy

```bash
anchor build
anchor deploy
```

## Usage

### Run on Solana Mainnet/Devnet

```bash
npm run start
```

### Run on Eclipse

```bash
npm run start-eclipse
```

## Test

```bash
npm run test
# or
cargo test
```

## Project Structure

```
coin-flip/
├── programs/
│   └── sb-randomness/   # Anchor program with randomness integration
├── scripts/
│   ├── index.ts         # Main Solana script
│   └── eclipse.ts       # Eclipse network script
├── Anchor.toml
├── Cargo.toml
└── package.json
```
