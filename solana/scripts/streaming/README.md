# Streaming Scripts - Real-time Price Feed Examples

## Overview

This directory contains three different approaches to streaming real-time price data from Switchboard oracles:

1. **`crossbarStream.ts`** - Unsigned price streaming via Crossbar service for UI/monitoring
2. **`runSurge.ts`** - Surge API streaming with latency tracking and transaction simulation
3. **`stream.ts`** - Full streaming implementation with on-chain transaction submission

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

### 1. crossbarStream.ts - Unsigned Price Streaming

**Purpose**: Stream unsigned price data for frontend displays and monitoring dashboards.

**Usage**:
```bash
npx ts-node scripts/streaming/crossbarStream.ts
```

**Features**:
- Connects to Switchboard's Crossbar service for unsigned price data
- Subscribes to all available price feeds
- Displays formatted prices with latency metrics
- Ideal for UI components that need fast updates without on-chain verification

**Configuration**:
```typescript
const surge = new sb.Surge({
  apiKey: apiKey,                                        // Your Surge API key
  crossbarUrl: 'https://staging.crossbar.switchboard.xyz', // Crossbar endpoint
  crossbarMode: true,                                    // Enable Crossbar mode
  verbose: true,                                         // Enable detailed logging
});
```

### 2. runSurge.ts - Surge API with Transaction Simulation

**Purpose**: Stream signed price data with latency tracking and transaction simulation.

**Usage**:
```bash
npx ts-node scripts/streaming/runSurge.ts
```

**Features**:
- Connects to Surge API for BTC/USD prices
- Tracks detailed latency statistics (min, max, median, mean)
- Creates signature verification instructions
- Simulates transactions without submitting to network
- Perfect for testing and performance monitoring

**Output Example**:
```
Received BTC/USD price: $45123.45
Latency Stats - Min: 45ms, Max: 120ms, Median: 67ms, Mean: 72ms
Transaction simulation successful
```

### 3. stream.ts - Full Streaming with On-chain Submission

**Purpose**: Complete streaming implementation with throttled on-chain transaction submission.

**Usage**:
```bash
npx ts-node scripts/streaming/stream.ts
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
| `crossbarStream.ts` | Frontend displays | None (unsigned) | 50-150ms | UIs, dashboards, monitoring |
| `runSurge.ts` | Testing & monitoring | Simulated only | 50-200ms | Performance testing, debugging |
| `stream.ts` | Production integration | Submitted on-chain | 100-300ms | Live trading systems |

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
- For signed price data that can be verified on-chain, use the bundle method instead
- The Crossbar service is optimized for frontend applications requiring fast updates
- API keys can be obtained from the Switchboard team

## Related Examples

- `../feeds/runBundle.ts`: Fetch signed price bundles for on-chain verification
- `../feeds/runFeed.ts`: Direct feed queries without streaming
- `../benchmarks/benchmark.ts`: Performance comparison tools

## Support

For issues or questions:
- Check the [Switchboard documentation](https://docs.switchboard.xyz)
- Visit the [GitHub repository](https://github.com/switchboard-xyz/on-demand-examples)
- Contact the Switchboard team for API access