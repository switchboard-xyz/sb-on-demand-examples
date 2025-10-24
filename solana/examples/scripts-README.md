# Switchboard On-Demand Scripts

This directory contains example scripts demonstrating various ways to interact with Switchboard On-Demand oracles on Solana.

## 📁 Directory Structure

```
examples/
├── feeds/          # Oracle feed operations
├── benchmarks/     # Performance testing
└── utils.ts        # Shared utilities
surge/
└── runSurge.ts     # Real-time price streaming
```

## 🚀 Quick Start

### Using npm scripts:
```bash
# Fetch price quotes (default BTC/USD)
npm start

# Stream prices with Surge WebSocket
npm run stream:surge

# Run Crossbar streaming
npm run stream:crossbar

# Run performance benchmarks
npm run benchmark
```

### Using bun (recommended):
```bash
# Fetch price quotes with specific feed
bun run examples/feeds/advanced/runUpdate.ts --feedId 0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f

# X402 paywalled RPC access (inline feed with X402 headers)
bun run examples/feeds/x402Update.ts --url https://helius.api.corbits.dev --method getBlockHeight

# Stream prices with Surge
bun run surge/runSurge.ts

# Run Crossbar streaming (chain-agnostic)
bun run ../common/streaming/crossbarStream.ts

# Performance benchmarks
bun run examples/benchmarks/benchmark.ts
```

### Direct execution with ts-node:
```bash
# Run any script directly
npx ts-node examples/feeds/advanced/runUpdate.ts --feedId FEED_ID
```

## 📂 Categories

### 1. Feeds (`/feeds/`)
Scripts for fetching and updating oracle price data.

- **`feeds/basic/managedUpdate.ts`** - Simple oracle quote fetching (recommended for beginners)
- **`feeds/advanced/runUpdate.ts`** - Advanced aggregated price quotes (90% cost reduction)
- **`feeds/x402Update.ts`** - X402 authentication with inline feed definition (like prediction market)

[📖 Detailed Feeds Documentation](./feeds/README.md)

### 2. Streaming (`/surge/`)
Real-time price streaming implementations.

- **`runSurge.ts`** - Demo streaming with single simulation after 10 seconds
- See **[`../../common/streaming/crossbarStream.ts`](../../common/streaming/)** - Chain-agnostic unsigned prices for UI/monitoring

[📖 Detailed Streaming Documentation](../surge/README.md)

### 3. Benchmarks (`/benchmarks/`)
Performance testing and comparison tools.

- **`benchmark.ts`** - Compare latency vs other oracles
- **`benchmarkCU.ts`** - Measure compute unit usage

[📖 Detailed Benchmarks Documentation](./benchmarks/README.md)

## 🔧 Common Setup

### Environment Variables
```bash
# Required
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

# Optional (for Surge streaming)
export SURGE_API_KEY=your_api_key_here
```

### Prerequisites
- Node.js 16+
- Configured Solana wallet
- SOL for transaction fees
- Anchor Framework (for program interaction)

## 💡 Choosing the Right Script

| Need | Use This Script | Why |
|------|----------------|-----|
| Fetch prices for DeFi | `examples/feeds/advanced/runUpdate.ts` | Lowest cost, signed data |
| Access paywalled RPC | `examples/feeds/x402Update.ts` | X402 micropayments, premium RPC |
| Real-time UI updates | `../../common/streaming/crossbarStream.ts` | Unsigned, lowest latency (chain-agnostic) |
| Demo streaming integration | `surge/runSurge.ts` | Clean demo with simulation |
| Test performance | `examples/benchmarks/benchmark.ts` | Compare oracle providers |
| Optimize gas costs | `examples/benchmarks/benchmarkCU.ts` | Measure compute units |

## 📊 Example Outputs

### Quote Fetching
```
🔧 Initializing quote fetching demo...
🌐 RPC: https://api.devnet.solana.com
👤 Wallet: 7THdgryC8PL7GD6nPjWGxikfZisXdTsgPaXBz1Lzmtxh
Input feedId: 0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
Min latency: 245 ms
Median latency: 267 ms
Mean latency: 256.50 ms
✅ Simulation succeeded, sending transaction...
```

### Surge Streaming
```
🚀 Starting Surge streaming demo...
📡 Listening for price updates (will simulate after 10 seconds)...
📊 Update #1 | Price: 6771234500000 | Latency: 42ms | Avg: 42.0ms
📊 Update #2 | Price: 6771245600000 | Latency: 38ms | Avg: 40.0ms
⏰ 10 seconds elapsed - running simulation with latest data...
✅ Simulation succeeded!
```

### Benchmark Results
```
Switchboard Latency: 245 ms
Pyth Average: 4.52x Switchboard
Redstone Average: 3.21x Switchboard
```

## 🛠️ Development Tips

1. **Import Utilities**: All scripts use shared utilities from `utils.ts`
   ```typescript
   import { TX_CONFIG, sleep } from "../utils";
   ```

2. **Error Handling**: Scripts include retry logic and error handling
   ```typescript
   try {
     const result = await fetchUpdate();
   } catch (error) {
     console.error("Failed to fetch:", error);
   }
   ```

3. **Transaction Configuration**: Use consistent settings
   ```typescript
   const tx = await asV0Tx({
     connection,
     ixs: [sigVerifyIx, yourIx],
     signers: [wallet],
     ...TX_CONFIG
   });
   ```

## 📚 Additional Resources

- [Main Project README](../README.md)
- [Switchboard Documentation](https://docs.switchboard.xyz)
- [On-Demand UI](https://ondemand.switchboard.xyz)

## 🆘 Troubleshooting

### "Module not found"
```bash
npm install
```

### "Insufficient SOL"
```bash
solana airdrop 2  # Devnet only
```

### "Feed not found"
- Check network (devnet vs mainnet)
- Verify feed hash/address is correct
- Get valid feeds from [On-Demand UI](https://ondemand.switchboard.xyz)

---

For detailed documentation on each category, see the README files in the respective subdirectories.
