# Surge Streaming - Real-time Signed Price Updates

Real-time WebSocket streaming of signed oracle price data with detailed latency metrics.

## Quick Start

```bash
# Default: stream BTC/USD prices
npx ts-node surge/runSurge.ts

# Custom ticker
npx ts-node surge/runSurge.ts -t ETH

# With program simulation (requires deployed basic_oracle_example)
npx ts-node surge/runSurge.ts -p
```

## CLI Options

| Flag | Alias | Description | Default |
|------|-------|-------------|---------|
| `--ticker` | `-t` | Trading pair symbol (USD quote assumed) | `BTC` |
| `--withProgram` | `-p` | Include program read instruction in simulation | `false` |

## Authentication

Two authentication modes are supported. Configure in the `surgeConfig` object:

```typescript
// Option 1: Keypair/connection (default, on-chain subscription)
const surgeConfig = {
  connection,
  keypair,
  verbose: false,
};

// Option 2: API key
const surgeConfig = {
  apiKey: process.env.SURGE_API_KEY,
  verbose: false,
};
```

## Output Example

```
🚀 Starting Surge streaming demo...
📊 Using ticker: BTC/USD
🔑 Loaded keypair: 2PnGjGspy5Hbe...
🌐 Connected to cluster: https://api.mainnet-beta.solana.com
📡 Listening for price updates (will simulate after 10 seconds)...

══════════════════════════════════════════════════════════════════════
📈 PRICE CHANGE | Update #1
──────────────────────────────────────────────────────────────────────
Bundle Metrics:
  • Emit Latency:              145ms (price source change → oracle broadcast)
  • Change Detection to Bcast: 11ms (price change detection → broadcast)
  • Oracle → Client:           12ms (network latency to your client)
──────────────────────────────────────────────────────────────────────

  BTC/USD - $89,868.62
    • Source → Oracle:  134ms (exchange to oracle reception)
    • Emit Latency:     145ms (price source change → oracle broadcast)

══════════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════════
⏰ HEARTBEAT | Update #2
──────────────────────────────────────────────────────────────────────
...
```

## Event Handling

```typescript
surge.on('signedPriceUpdate', (response: sb.SurgeUpdate) => {
  const prices = response.getFormattedPrices();   // { "BTC/USD": "$89,868.62" }
  const metrics = response.getLatencyMetrics();   // Detailed timing breakdown

  // Check update type
  if (metrics.isHeartbeat) {
    // No price change, just keeping connection alive
  } else {
    // Actual price change
  }

  // Per-feed metrics
  metrics.perFeedMetrics.forEach((feed) => {
    console.log(feed.symbol, feed.emitLatencyMs);
  });
});
```

## Simulation Modes

After 10 seconds of streaming, the script runs a transaction simulation:

- **Default**: Simulates oracle quote update only
- **With `-p` flag**: Simulates oracle update + reading from your program

Use `-p` to test the full flow of updating oracle data and consuming it in your program. Requires the `basic_oracle_example` program to be deployed.

## Related

- [`../../common/streaming/`](../../common/streaming/) - Chain-agnostic streaming (unsigned data)
