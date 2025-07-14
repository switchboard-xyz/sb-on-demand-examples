# Feed Scripts - Oracle Data Fetching Examples

## Overview

This directory contains scripts demonstrating different approaches to fetching and submitting oracle price data on Solana:

1. **`runBundle.ts`** - Bundle-based oracle fetching for efficient multi-feed updates
2. **`runFeed.ts`** - Individual feed updates with granular control

## Prerequisites

- Node.js 16+ installed
- TypeScript and ts-node  
- Configured Solana wallet with SOL
- Valid RPC endpoint URL
- Network access to Switchboard Crossbar

## Script Details

### 1. runBundle.ts - Bundle-Based Oracle Updates

**Purpose**: Fetch aggregated oracle data bundles containing multiple price feeds in a single efficient transaction.

**Usage**:
```bash
# Default (BTC/USD feed)
npx ts-node scripts/feeds/runBundle.ts

# With specific feed hash
npx ts-node scripts/feeds/runBundle.ts 0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
```

**Key features**:
- **Bundle mechanism**: Aggregates multiple oracle responses
- **Feed hash input**: Specify feeds using hexadecimal identifiers
- **Signature verification**: Ed25519 signature validation
- **Performance tracking**: Latency statistics (min, median, mean)
- **V0 transactions**: Optimized with address lookup tables
- **Simulation mode**: Currently simulates only (production code commented)

**Architecture**:
```
Crossbar Network → Bundle Fetch → Signature Verification → Transaction
     ↓                   ↓                    ↓                  ↓
Oracle Nodes      Aggregated Data      Ed25519 Check      Simulation
```

**Sample output**:
```
Fetching update for feed: 0xef0d8b6f...
Fetch latency: 245ms
Simulation successful: true
Stats - Min: 212ms, Median: 245ms, Mean: 234ms
```

### 2. runFeed.ts - Individual Feed Updates  

**Purpose**: Update specific pull feed accounts with detailed oracle response visibility.

**Usage**:
```bash
# With feed public key
npx ts-node scripts/feeds/runFeed.ts GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR

# Interactive mode (prompts for feed)
npx ts-node scripts/feeds/runFeed.ts
```

**Key features**:
- **Direct feed updates**: Works with individual PullFeed accounts
- **Multiple signatures**: Requests 13 oracle signatures for consensus
- **Error visibility**: Shows individual oracle response errors
- **Event parsing**: Extracts price update events from logs
- **Active submission**: Sends transactions to network
- **3-second intervals**: Continuous updates with delay

**Workflow**:
```
Feed Account → Fetch Update → Check Responses → Submit Transaction
      ↓              ↓              ↓                   ↓
 Public Key    13 Signatures   Error Check      Network Confirmation
```

**Sample output**:
```
Fetching update for feed: GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR
Oracle responses received: 13
Oracle errors: []
Price Update Event - Feed: 0x1234..., Price: 45123.45, Confidence: 12.34
Transaction sent: 3xY2z...
Latency - Min: 189ms, Median: 234ms, Mean: 267ms, Max: 412ms
```

## Choosing Between Bundle and Feed Scripts

### Use runBundle.ts when:
- Fetching multiple price feeds together
- Optimizing for transaction efficiency
- Building aggregator services
- Minimizing network calls
- Testing oracle performance

### Use runFeed.ts when:
- Updating specific individual feeds
- Need detailed oracle response data
- Require event parsing for price updates
- Building feed-specific applications
- Debugging oracle issues

## Configuration

### Common environment variables:
```bash
# RPC endpoint
export RPC_URL="https://api.mainnet-beta.solana.com"

# Priority fees (micro-lamports)
export PRIORITY_FEE_MICRO_LAMPORTS=200000

# Compute unit limit
export COMPUTE_UNIT_LIMIT=150000
```

### Feed identifiers:

**Bundle script (uses feed hash)**:
```typescript
// BTC/USD mainnet feed hash
const feedHash = "0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f"
```

**Feed script (uses public key)**:
```typescript
// BTC/USD mainnet feed address
const feedKey = new PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")
```

## Performance Considerations

### Bundle fetching:
- **Latency**: Typically 200-400ms
- **Efficiency**: Single transaction for multiple feeds
- **Cost**: Lower per-feed when batching
- **Reliability**: Aggregated oracle consensus

### Individual feed updates:
- **Latency**: Typically 150-500ms per feed
- **Control**: Fine-grained feed management
- **Visibility**: Detailed oracle responses
- **Flexibility**: Per-feed update schedules

## Advanced Usage

### Customizing bundle fetches:
```typescript
// Fetch multiple feeds in one bundle
const feedHashes = [
  "0xef0d8b6f...", // BTC/USD
  "0x1234abcd...", // ETH/USD
  "0x5678efgh..."  // SOL/USD
];
```

### Adjusting oracle requirements:
```typescript
// Request different number of signatures
const update = await feed.fetchUpdateIx({
  numSignatures: 5,  // Minimum signatures
  gateway: gatewayUrl
});
```

### Error handling:
```typescript
// Check for oracle errors
const errors = responses.filter(r => r.error);
if (errors.length > 0) {
  console.warn("Oracle errors:", errors);
}
```

## Troubleshooting

### Common issues:

1. **"Feed not found"**
   - Verify feed hash/address is correct
   - Check network (mainnet vs devnet)

2. **"Insufficient signatures"**
   - Some oracles may be offline
   - Try reducing numSignatures requirement

3. **"Transaction too large"**
   - Reduce number of feeds in bundle
   - Use fewer signatures

4. **"Simulation failed"**
   - Check wallet SOL balance
   - Verify compute unit limits

## Testing Tips

### Local testing:
```bash
# Use devnet for testing
export SOLANA_CLUSTER=devnet

# Get devnet SOL
solana airdrop 2
```

### Performance testing:
```bash
# Run for extended period
timeout 300 npx ts-node scripts/feeds/runBundle.ts
```

### Debugging:
```typescript
// Enable verbose logging
process.env.DEBUG = "switchboard:*"
```

## Integration Examples

### Basic integration:
```typescript
import { fetchBundleData } from "./runBundle";

// In your application
const priceData = await fetchBundleData(feedHash);
console.log(`BTC Price: $${priceData.price}`);
```

### Production configuration:
```typescript
// Recommended settings
const config = {
  numSignatures: 5,      // Balance security/cost
  computeLimit: 200000,  // With buffer
  priorityFee: 100000,   // Adjust for congestion
  retryAttempts: 3       // Handle failures
};
```

## Related Examples

- `../streaming/`: Real-time WebSocket price streaming
- `../benchmarks/`: Performance comparison tools
- `../../programs/`: On-chain program examples

## Notes

- Bundle mechanism reduces costs by ~90% for multi-feed updates
- Feed updates provide more granular control and visibility
- Both methods support the same underlying oracle network
- Transaction fees vary based on network congestion
- Consider implementing retry logic for production use