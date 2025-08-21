# Switchboard On-Demand Scripts

This directory contains example scripts demonstrating various ways to interact with Switchboard On-Demand oracles on Solana.

## 📁 Directory Structure

```
scripts/
├── feeds/          # Oracle feed operations
├── streaming/      # Real-time price streaming
├── benchmarks/     # Performance testing
└── utils.ts        # Shared utilities
```

## 🚀 Quick Start

### Using npm scripts:
```bash
# Fetch price bundles (default BTC/USD)
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
# Fetch price bundles with specific feed
bun run scripts/feeds/runBundle.ts --feedHash f01cc150052ba08171863e5920bdce7433e200eb31a8558521b0015a09867630

# Stream prices with Surge
bun run scripts/streaming/runSurge.ts

# Run Crossbar streaming
bun run scripts/streaming/crossbarStream.ts

# Performance benchmarks
bun run scripts/benchmarks/benchmark.ts
```

### Direct execution with ts-node:
```bash
# Run any script directly
npx ts-node scripts/feeds/runBundle.ts --feedHash FEED_HASH
```

## 📂 Categories

### 1. Feeds (`/feeds/`)
Scripts for fetching and updating oracle price data.

- **`runBundle.ts`** - Fetch aggregated price bundles (90% cost reduction)
- **`runFeed.ts`** - Update individual feed accounts

[📖 Detailed Feeds Documentation](./feeds/README.md)

### 2. Streaming (`/streaming/`)
Real-time price streaming implementations.

- **`runSurge.ts`** - Demo streaming with single simulation after 10 seconds
- **`stream.ts`** - Full streaming with on-chain transactions
- **`crossbarStream.ts`** - Unsigned prices for UI/monitoring

[📖 Detailed Streaming Documentation](./streaming/README.md)

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
| Fetch prices for DeFi | `feeds/runBundle.ts` | Lowest cost, signed data |
| Real-time UI updates | `streaming/crossbarStream.ts` | Unsigned, lowest latency |
| Demo streaming integration | `streaming/runSurge.ts` | Clean demo with simulation |
| Production streaming | `streaming/stream.ts` | Full on-chain integration |
| Test performance | `benchmarks/benchmark.ts` | Compare oracle providers |
| Optimize gas costs | `benchmarks/benchmarkCU.ts` | Measure compute units |

## 📊 Example Outputs

### Bundle Fetching
```
🔧 Initializing bundle fetching demo...
🌐 RPC: https://api.devnet.solana.com
👤 Wallet: 7THdgryC8PL7GD6nPjWGxikfZisXdTsgPaXBz1Lzmtxh
Input feedHash: f01cc150052ba08171863e5920bdce7433e200eb31a8558521b0015a09867630
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
     const result = await fetchBundle();
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