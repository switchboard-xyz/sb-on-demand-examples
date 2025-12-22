# EVM Price Feeds Example

Switchboard price feed consumer example for EVM chains (Ethereum, Monad, Arbitrum, etc.).

## Overview

This example demonstrates how to integrate Switchboard On-Demand oracle price feeds into a Solidity smart contract. The `SwitchboardPriceConsumer` contract includes:

- Secure price updates with signature verification
- Staleness checks to prevent old data usage
- Price deviation validation
- Multi-feed support

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/) or Node.js

## Setup

```bash
npm install
forge install
```

## Build

```bash
npm run build
# or
forge build
```

## Deploy

Deploy to a network:

```bash
npm run deploy
```

Deploy to specific networks:

```bash
# Monad Testnet
npm run deploy:monad-testnet

# Monad Mainnet (requires MONAD_RPC_URL env var)
npm run deploy:monad-mainnet
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Usage

Run the example script:

```bash
npm run example
```

## Test

```bash
npm run test
# or
forge test
```
