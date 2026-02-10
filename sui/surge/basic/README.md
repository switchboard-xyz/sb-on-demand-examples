# Sui Surge Streaming Example

This example demonstrates real-time price streaming using Switchboard's Surge WebSocket service on Sui.

## Overview

Surge provides low-latency, real-time price updates via WebSocket. This example:

- Connects to the Surge WebSocket gateway using your Solana keypair (subscription owner)
- Subscribes to BTC/USD price updates
- Maps oracle public keys to Sui oracle IDs
- Queues and processes transactions sequentially
- Tracks latency statistics

## Prerequisites

- Node.js 18+
- Sui CLI configured with a funded wallet
- Solana keypair with an active Surge subscription ([subscribe here](https://explorer.switchboardlabs.xyz/subscriptions))
- Sui keypair in your keystore (`~/.sui/sui_config/sui.keystore`) for signing Sui transactions

## Setup

1. Install dependencies:

```bash
npm install
```

2. Ensure your Solana keypair has an active subscription:

Your Solana keypair (default `~/.config/solana/id.json` or `SOLANA_KEYPAIR_PATH`) must have an active Surge subscription. The Sui keypair is only used to sign Sui transactions.

To use a non-default Solana keypair:

```bash
export SOLANA_KEYPAIR_PATH=/path/to/your/solana/id.json
```


## Usage

### Run on Mainnet (default)

```bash
npm run stream
# or
npm run stream:mainnet
```

### Run on Testnet

```bash
npm run stream:testnet
```

### CLI Options

```bash
tsx scripts/stream.ts --network mainnet|testnet
```

## How It Works

1. **Authentication**: Uses your Solana keypair to authenticate via on-chain subscription
2. **WebSocket Connection**: Connects to Surge gateway for the selected network
3. **Oracle Mapping**: Fetches oracle key-to-ID mappings from Crossbar (cached for 10 minutes)
4. **Price Updates**: Receives real-time price updates with oracle signatures
5. **Transaction Queue**: Queues raw responses and processes transactions one at a time
6. **Statistics**: Tracks min/max/median/mean latencies

## Network Configuration

| Network | RPC URL | Oracle Endpoint |
|---------|---------|-----------------|
| Mainnet | `https://fullnode.mainnet.sui.io:443` | `/oracles/sui` |
| Testnet | `https://fullnode.testnet.sui.io:443` | `/oracles/sui/testnet` |
