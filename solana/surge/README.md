# Streaming Scripts - Real-time Price Feed Examples

## Overview

This directory contains **Solana-specific** streaming examples that integrate real-time price data with Solana transactions:

1. **`runSurge.ts`** - Surge API streaming with latency tracking and transaction simulation
2. **`stream.ts`** - Full streaming implementation with on-chain transaction submission

For a **chain-agnostic** streaming example (unsigned price data), see: **[`../../common/streaming/crossbarStream.ts`](../../common/streaming/)**

## Key Features

- **Real-time WebSocket streaming** of price updates
- **Ultra-low latency** monitoring with millisecond precision
- **Unsigned price data** for fast frontend display
- **Multi-symbol support** with formatted price output
- **Built-in latency tracking** for performance monitoring

## Prerequisites

- Node.js 16+ installed
- TypeScript and ts-node
- A valid Switchboard Surge API key
- Network access to Switchboard's Crossbar service

## Installation

1. Install the required dependencies:
```bash
npm install @switchboard-xyz/on-demand
# or
yarn add @switchboard-xyz/on-demand
# or
pnpm add @switchboard-xyz/on-demand
```

2. Set up your environment variables:
```bash
export SURGE_API_KEY="your-api-key-here"
```

## Script Details

### 1. runSurge.ts - Surge Streaming Demo

**Purpose**: Demonstration of streaming with real-time price updates and single simulation.

**Usage**:
```bash
# Using bun (recommended)
bun run examples/streaming/runSurge.ts

# Using npm script
npm run stream:surge

# Using ts-node directly
npx ts-node examples/streaming/runSurge.ts
```

**Features**:
- Connects to Surge API for BTC/USD price streaming
- Shows real-time price updates with raw values
- Tracks detailed latency statistics (min, max, median, mean)  
- Runs a single simulation after 10 seconds
- Displays program logs showing feed values
- Clean demo flow with automatic exit

**Output Example**:
```
🚀 Starting Surge streaming demo...
📡 Listening for price updates (will simulate after 10 seconds)...
📊 Update #1 | Price: 6771234500000 | Latency: 42ms | Avg: 42.0ms
📊 Update #2 | Price: 6771245600000 | Latency: 38ms | Avg: 40.0ms
⏰ 10 seconds elapsed - running simulation with latest data...
✅ Simulation succeeded!
📈 Final stats: 15 updates, 43.2ms avg latency
```

### 2. stream.ts - Full Streaming with On-chain Submission

**Purpose**: Complete streaming implementation with throttled on-chain transaction submission.

**Usage**:
```bash
# Using bun (recommended)
bun run examples/streaming/stream.ts

# Using npm script
npm run stream

# Using ts-node directly
npx ts-node examples/streaming/stream.ts
```

**Features**:
- Streams BTC/USDT from Binance with 5-second transaction throttling
- Actually submits transactions to Solana network
- Runs for 30 seconds as a demo
- Tracks comprehensive metrics:
  - Total updates received
  - Heartbeats vs price changes
  - Transaction success rate
  - Oracle processing times
- Color-coded output for better visibility

**Output Example**:
```
🎉 Starting 30-second streaming demo...
💓 Heartbeat: $45,123.45 (unchanged)
📊 Price Update: $45,124.10 (+$0.65)
✅ Transaction confirmed: 3xY2z...
📈 Demo Statistics:
  - Total Updates: 142
  - Price Changes: 28
  - Transactions Sent: 6
  - Success Rate: 100%
```

## Choosing the Right Script

| Script | Use Case | Transaction | Latency | Best For |
|--------|----------|-------------|---------|----------|
| `runSurge.ts` | Demo & customer presentations | Single simulation after 10s | 50-200ms | Demonstrations, testing |
| `stream.ts` | Production integration | Submitted on-chain | 100-300ms | Live trading systems |
| [`../../common/streaming/crossbarStream.ts`](../../common/streaming/) | Frontend displays | None (unsigned) | 50-150ms | UIs, dashboards, monitoring (chain-agnostic) |

## Event Handling

The script listens for `unsignedPriceUpdate` events:

```typescript
surge.on('unsignedPriceUpdate', (update: sb.UnsignedPriceUpdate) => {
  // Access available data
  const symbols = update.getSymbols();        // Array of symbols
  const sources = update.getSources();        // Array of sources
  const formattedPrices = update.getFormattedPrices(); // Price map
  
  // Calculate latency
  const latency = Date.now() - update.data.seen_at_ts_ms;
});
```

### Available Data from Updates

- `update.getSymbols()`: Returns array of symbol strings
- `update.getSources()`: Returns array of data source names
- `update.getFormattedPrices()`: Returns object with symbol-to-price mapping
- `update.data.seen_at_ts_ms`: Timestamp when price was observed

## Use Cases

1. **Trading Dashboards**: Display live prices with latency metrics
2. **Backend Monitoring**: Track price feed health and performance
3. **Price Alerts**: Build notification systems for price movements
4. **Data Analysis**: Collect streaming data for analysis
5. **UI Components**: Power real-time price tickers and charts

## Performance Considerations

- **Latency**: Typical latency ranges from 50-150ms
- **Data Rate**: Updates stream as fast as new prices are available
- **Connection**: WebSocket connection automatically handles reconnection
- **Memory**: Minimal memory footprint for streaming

## Error Handling

The Surge client handles connection errors and automatic reconnection. For production use, consider adding:

```typescript
surge.on('error', (error) => {
  console.error('Streaming error:', error);
  // Implement your error handling logic
});

surge.on('disconnect', () => {
  console.log('Disconnected from Crossbar');
  // Implement reconnection logic if needed
});
```

## Notes

- This streams **unsigned** price data - suitable for display but not for on-chain use
- For signed price data that can be verified on-chain, use the quote method instead
- The Crossbar service is optimized for frontend applications requiring fast updates
- API keys can be obtained from the Switchboard team

## Related Examples

- `../feeds/advanced/runUpdate.ts`: Fetch signed price quotes for on-chain verification
- `../feeds/legacy/runFeed.ts`: (Legacy) Direct feed queries without streaming
- `../benchmarks/benchmark.ts`: Performance comparison tools

## Support

For issues or questions:
- Check the [Switchboard documentation](https://docs.switchboard.xyz)
- Visit the [GitHub repository](https://github.com/switchboard-xyz/on-demand-examples)
- Contact the Switchboard team for API access