# Solana Feeds - Basic Example

Basic Switchboard oracle integration using managed feeds with the Anchor framework.

## Overview

This example demonstrates the simplest way to integrate Switchboard price feeds on Solana using the Anchor framework and managed feeds. Ideal for getting started with Switchboard oracles.

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- Node.js 18+

## Setup

```bash
npm install
```

## Build

```bash
npm run build
# or
anchor build
```

## Usage

### Create a Managed Feed

```bash
npm run create-feed
```

### Update Feed Prices

NOTE: program and its IDL should be deployed before running this.

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
basic/
├── programs/
│   └── basic-oracle-example/   # Anchor program
├── scripts/
│   ├── createManagedFeed.ts    # Create new managed feed
│   └── managedUpdate.ts        # Update feed prices
├── Anchor.toml
├── Cargo.toml
└── package.json
```
