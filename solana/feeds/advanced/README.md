# Solana Feeds - Advanced Example

Advanced Switchboard oracle integration using Pinocchio framework with Address Lookup Table (ALT) optimization.

## Overview

This example demonstrates an optimized approach to integrating Switchboard price feeds on Solana using the Pinocchio framework instead of Anchor. This approach provides better performance and smaller program size.

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

NOTE: program and its IDL should be deployed before running this.

Run the update script:

```bash
npm run update
# or
npm run start
```

## Test

```bash
npm run test
# or
cargo test
```

## Project Structure

```
advanced/
├── programs/
│   └── advanced-oracle-example/   # Rust program using Pinocchio
├── scripts/
│   └── runUpdate.ts               # TypeScript update script
├── Anchor.toml
├── Cargo.toml
└── package.json
```
