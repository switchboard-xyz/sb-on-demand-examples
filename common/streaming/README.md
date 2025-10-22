# Switchboard Streaming Examples

Chain-agnostic examples for streaming real-time oracle data using Switchboard's Surge WebSocket service.

## What's Here

### `crossbarStream.ts` - Unsigned Price Streaming

**Chain-Agnostic WebSocket Streaming** - Works with any blockchain

A minimal example demonstrating how to stream unsigned price updates from Switchboard's Crossbar service:

```bash
cd common/streaming
SURGE_API_KEY=your_api_key bun run crossbarStream.ts
```

#### Features:
- **Chain-agnostic** - No blockchain-specific dependencies
- **WebSocket streaming** - Real-time price updates via Surge
- **Unsigned data** - Suitable for UI/monitoring, not for on-chain use
- **Ultra-low latency** - Millisecond-level price updates

#### What it demonstrates:
- Connecting to Switchboard Surge in Crossbar mode
- Subscribing to specific price feeds
- Receiving and displaying unsigned price updates
- Measuring data latency

#### Output Example:
```
Received unsigned price update for BTC/USD:
BTC/USD (BINANCE): $64,234.56 | Latency: 42ms
```

## Why Chain-Agnostic?

This example uses only the `@switchboard-xyz/on-demand` package's Surge client, which works identically across all supported chains (Solana, EVM, Sui). The unsigned price stream is the same regardless of which blockchain you're building on.

## Use Cases

- **Price monitoring dashboards** - Display real-time prices in UIs
- **Trading interfaces** - Show live market data to users
- **Analytics tools** - Track price movements and trends
- **Testing** - Verify oracle data feeds are working

## Chain-Specific Examples

For examples that integrate streaming data with on-chain transactions:

- **Solana**: See `solana/examples/streaming/runSurge.ts` - Demonstrates signed price updates with Solana program integration
- **Sui**: See `sui/examples/surge/surgeUpdate.ts` - Shows how to use Surge with Sui transactions
- **EVM**: Coming soon

## Requirements

### API Key
Get a Surge API key from [Switchboard Dashboard](https://explorer.switchboard.xyz)

### Environment Setup
```bash
export SURGE_API_KEY="sb_live_your_api_key_here"
```

### Installation
```bash
# From repository root
cd common/streaming
bun install  # or npm install
```

## Technical Details

### Crossbar Mode

This example uses Surge in "Crossbar mode", which streams unsigned price data:

```typescript
const surge = new sb.Surge({
  apiKey: apiKey,
  crossbarUrl: "https://crossbar.switchboardlabs.xyz",
  crossbarMode: true,  // ← Enables unsigned streaming
  verbose: true,
});
```

**Unsigned vs Signed:**
- **Unsigned** (this example): Fast, low-overhead, suitable for display
- **Signed** (chain-specific): Cryptographically verified, required for on-chain use

### WebSocket Events

The example listens for unsigned price updates:

```typescript
surge.on("unsignedPriceUpdate", (update: sb.UnsignedPriceUpdate) => {
  const symbols = update.getSymbols();
  const formattedPrices = update.getFormattedPrices();
  // Display prices...
});
```

## Next Steps

1. **Run the example** to see live price streaming
2. **Modify the symbols** in `crossbarStream.ts` to track different assets
3. **Explore chain-specific examples** to integrate prices into smart contracts

## Related Examples

- **Job Testing**: `../job-testing/` - Test custom oracle job definitions
- **Solana Streaming**: `../../solana/examples/streaming/` - Signed updates with Solana integration
- **Sui Streaming**: `../../sui/examples/surge/surgeUpdate.ts` - Surge integration for Sui

---

**Note**: This example streams unsigned data for monitoring purposes. For on-chain oracle data, use the chain-specific signed streaming examples.
