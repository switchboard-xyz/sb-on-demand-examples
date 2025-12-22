# Sui Surge Streaming Example

This example demonstrates real-time price streaming using Switchboard's Surge WebSocket service on Sui.

## Overview

Surge provides low-latency, real-time price updates via WebSocket. This example:

- Connects to the Surge WebSocket gateway
- Subscribes to BTC/USD price updates
- Maps oracle public keys to Sui oracle IDs
- Queues and processes transactions sequentially
- Tracks latency statistics

## Prerequisites

- Node.js 18+
- Sui CLI configured with a funded wallet
- Surge API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set your Surge API key:

```bash
export SURGE_API_KEY=your_api_key
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

1. **WebSocket Connection**: Connects to Surge gateway for the selected network
2. **Oracle Mapping**: Fetches oracle key-to-ID mappings from Crossbar (cached for 10 minutes)
3. **Price Updates**: Receives real-time price updates with oracle signatures
4. **Transaction Queue**: Queues raw responses and processes transactions one at a time
5. **Statistics**: Tracks min/max/median/mean latencies

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SURGE_API_KEY` | Required. Your Surge API key |

## Network Configuration

| Network | RPC URL | Oracle Endpoint |
|---------|---------|-----------------|
| Mainnet | `https://fullnode.mainnet.sui.io:443` | `/oracles/sui` |
| Testnet | `https://fullnode.testnet.sui.io:443` | `/oracles/sui/testnet` |
