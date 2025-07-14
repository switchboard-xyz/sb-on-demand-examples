# Benchmark Scripts - Performance Testing Tools

## Overview

This directory contains benchmarking tools to measure and compare the performance of Switchboard On-Demand oracles:

1. **`benchmark.ts`** - Oracle latency comparison across multiple providers
2. **`benchmarkCU.ts`** - Compute unit consumption analysis for different configurations

## Prerequisites

- Node.js 16+ installed
- TypeScript and ts-node
- Configured Solana wallet with devnet SOL
- Network access to oracle endpoints

## Script Details

### 1. benchmark.ts - Oracle Latency Comparison

**Purpose**: Compare real-time latency performance between Switchboard and other major oracle providers (Pyth, Redstone, Supra).

**Usage**:
```bash
npx ts-node scripts/benchmarks/benchmark.ts
```

**What it measures**:
- **Switchboard**: Direct oracle-to-consumer latency (typically sub-second)
- **Pyth**: Time from price publish to availability via Hermes API
- **Redstone**: Primary production feed query latency
- **Supra**: Cryptographic proof fetch and verification time

**Key features**:
- Continuous sampling with running averages
- Relative performance metrics (e.g., "4.52x Switchboard")
- Real-time latency tracking
- Demonstrates Switchboard's architectural advantages

**Sample output**:
```
========== Samples (25) ==========
Switchboard Latency: 245 ms
Pyth Average: 4.52x Switchboard
Redstone Average: 3.21x Switchboard
Supra Average: 2.87x Switchboard
```

**Technical details**:
- Uses BTC/USD as the benchmark price feed
- Maintains arrays of samples for accurate averaging
- Handles network errors gracefully
- Updates every few seconds with new measurements

### 2. benchmarkCU.ts - Compute Unit Analysis

**Purpose**: Measure compute unit consumption for Switchboard oracle updates with various configurations.

**Usage**:
```bash
npx ts-node scripts/benchmarks/benchmarkCU.ts
```

**What it measures**:
- Compute units consumed by different feed/signature combinations
- Fetch time for oracle updates
- Transaction success rates
- Scaling characteristics

**Test matrix**:
| Feeds | Signatures | Use Case |
|-------|------------|----------|
| 1 | 1-5 | Single price, varying security |
| 2 | 1-5 | Price pair updates |
| 3 | 1-5 | Multi-asset updates |
| 4 | 1-5 | Portfolio pricing |
| 5 | 1-5 | Maximum batch size |

**Key parameters**:
- **Network**: Solana devnet
- **Priority fee**: 200,000 micro-lamports
- **CU buffer**: 1.3x (30% safety margin)
- **Test delay**: 3 seconds between runs

**Sample output**:
```
========================================
Running test with 2 feed(s) and 3 signature(s)...
Time to fetch update: 387ms
Compute units used: 145,230
Transaction sent: 5xY9ZKqF...
Test completed successfully
========================================
```

## Performance Insights

### Latency Comparison Results

Typical performance multipliers (relative to Switchboard):
- **Pyth**: 3-5x slower due to intermediate infrastructure
- **Redstone**: 2-4x slower with relay-based architecture
- **Supra**: 2-3x slower with proof verification overhead

### Compute Unit Scaling

Approximate CU consumption:
- **Base overhead**: ~50,000 CU
- **Per feed**: ~20,000 CU
- **Per signature**: ~15,000 CU

Example calculations:
- 1 feed, 3 signatures: ~95,000 CU
- 3 feeds, 3 signatures: ~155,000 CU
- 5 feeds, 5 signatures: ~225,000 CU

## Use Cases

### When to use benchmark.ts:
- Evaluating oracle providers for your application
- Understanding latency requirements
- Demonstrating performance advantages
- Monitoring oracle health

### When to use benchmarkCU.ts:
- Planning transaction compute budgets
- Optimizing feed/signature configurations
- Estimating transaction costs
- Testing scalability limits

## Configuration Tips

### For lowest latency:
- Use minimum required signatures (1-2)
- Batch related feeds in single transactions
- Choose geographically close RPC endpoints

### For highest security:
- Use 3-5 signatures per feed
- Accept higher compute costs
- Monitor oracle reputation scores

### For cost optimization:
- Balance signatures vs security needs
- Batch updates when possible
- Use appropriate compute unit limits

## Running Custom Benchmarks

### Modify oracle selections:
```typescript
// In benchmark.ts, change the feeds being compared
const PYTH_FEED = "0xef0d8b6f..." // Different Pyth feed
const REDSTONE_URL = "https://..." // Alternative endpoint
```

### Adjust test parameters:
```typescript
// In benchmarkCU.ts, modify the test ranges
const maxFeeds = 10; // Test up to 10 feeds
const maxSignatures = 7; // Test up to 7 signatures
```

## Interpreting Results

### Latency metrics:
- **< 500ms**: Excellent for real-time applications
- **500ms - 1s**: Good for most DeFi use cases
- **1s - 2s**: Acceptable for less time-sensitive apps
- **> 2s**: May impact user experience

### Compute unit guidelines:
- **< 100k CU**: Low cost, suitable for frequent updates
- **100k - 200k CU**: Moderate cost, good for regular updates
- **200k - 300k CU**: Higher cost, use for critical updates
- **> 300k CU**: Consider splitting into multiple transactions

## Troubleshooting

### Common issues:

1. **"Insufficient SOL balance"**
   - Add devnet SOL: `solana airdrop 2`

2. **"Transaction simulation failed"**
   - Check compute unit limits
   - Verify feed addresses are correct

3. **"Network timeout"**
   - Check RPC endpoint health
   - Increase timeout values

4. **"Oracle not responding"**
   - Verify API keys if required
   - Check oracle service status

## Related Examples

- `../streaming/`: Real-time price streaming implementations
- `../feeds/`: Bundle and feed fetching examples
- `../../README.md`: Main project documentation

## Notes

- Benchmarks use devnet by default - results may vary on mainnet
- Network conditions significantly impact measurements
- Run multiple samples for accurate averages
- Consider time-of-day effects on latency