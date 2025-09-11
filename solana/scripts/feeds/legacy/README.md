# Legacy Feed Scripts

This directory contains deprecated feed scripts that are maintained for compatibility but are no longer recommended for new projects.

## ⚠️ Deprecation Notice

The scripts in this directory represent older approaches to oracle data fetching that have been superseded by more efficient methods. These scripts are provided for:

- **Legacy compatibility**: Existing projects that rely on these implementations
- **Reference purposes**: Understanding the evolution of Switchboard oracle integration
- **Specialized use cases**: Rare scenarios where granular feed control is needed

## Recommended Alternative

For new projects, use **`../runUpdate.ts`** instead, which provides:

- ✅ **90% lower costs** through quote aggregation
- ✅ **Better performance** with reduced network calls
- ✅ **Simplified implementation** with fewer moving parts
- ✅ **Active maintenance** and ongoing improvements

## Scripts in This Directory

### runFeed.ts - Individual Feed Updates

**Status**: Legacy - Use `../runUpdate.ts` instead

**Purpose**: Update specific pull feed accounts with detailed oracle response visibility.

**Usage**:
```bash
# Using bun (recommended)
bun run scripts/feeds/legacy/runFeed.ts GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR

# Using ts-node directly
npx ts-node scripts/feeds/legacy/runFeed.ts GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR

# Interactive mode (prompts for feed)
bun run scripts/feeds/legacy/runFeed.ts
```

**Key limitations compared to quote method**:
- Higher transaction costs (10x more expensive)
- Individual feed updates vs efficient batching
- More complex error handling required
- Slower update cycles

### runJob.ts - Oracle Consensus Job Runner

**Status**: Oracle consensus utility

**Purpose**: Execute oracle jobs using Switchboard's consensus mechanism with fallback to direct execution. Attempts to fetch multiple oracle signatures for data verification, with automatic fallback for testing.

**Usage**:
```bash
# Run Binance BTC/USDT with 3 oracle signatures
npx tsx runJob.ts --job binance --param BTCUSDT

# Use 5 oracle signatures for higher consensus
npx tsx runJob.ts --job binance --param BTCUSDT --numSignatures 5

# Run with custom gateway and intervals
npx tsx runJob.ts --job binance --param BTCUSDT --gateway https://crossbar.switchboard.xyz --interval 5000

# Single execution test
npx tsx runJob.ts --job binance --param BTCUSDT --count 1

# Show help and available options
npx tsx runJob.ts --help
```

**Key Features**:
- 🏆 **Oracle Consensus**: Attempts to fetch multiple oracle signatures
- 🔄 **Smart Fallback**: Falls back to direct execution if consensus fails
- 📊 **Consensus Calculation**: Uses median of valid oracle responses
- ⚡ **Performance Tracking**: Latency statistics and consensus metrics
- 🔧 **Configurable**: Adjustable signature count and gateway URLs
- 📈 **Statistical Analysis**: Price and latency statistics over time

**Available Jobs**:
- `binance` - Binance price feeds (e.g., BTCUSDT)

**Options**:
- `--job` - Job type to execute (required)
- `--param` - Parameter for the job (required) 
- `--numSignatures` - Number of oracle signatures to request (default: 3)
- `--gateway` - Crossbar gateway URL (default: https://crossbar.switchboard.xyz)
- `--interval` - Interval between executions in milliseconds (default: 3000)
- `--count` - Number of executions (omit for infinite loop)

**Example Output**:
```
🚀 Running binance job with oracle consensus
📋 Parameter (pair): BTCUSDT
🔢 Oracle signatures: 3

=== Execution #1 (2025-09-11T18:18:21.027Z) ===
🔗 Requesting 3 oracle signatures via Crossbar...
🌐 Gateway: https://crossbar.switchboard.xyz
🔄 Falling back to direct job execution...
🌐 Fetching: https://www.binance.com/api/v3/ticker/price
🔍 Parsing: $[?(@.symbol == 'BTCUSDT')].price
✅ Direct execution result: 114172.65
🏆 Final result: 114172.65
📈 Signatures received: 1
```

**Consensus Behavior**:
1. **Primary**: Attempts to fetch oracle signatures via Crossbar
2. **Fallback**: If consensus fails, executes job directly
3. **Calculation**: Uses median of valid responses for consensus
4. **Reporting**: Shows signature count and consensus confidence

## Migration Guide

If you're currently using `runFeed.ts`, here's how to migrate to the quote method:

### Before (Legacy):
```typescript
// Individual feed update
const feedKey = new PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR");
const response = await feed.fetchUpdateIx({
  numSignatures: 5,
  gateway: gatewayUrl
});
```

### After (Recommended):
```typescript
// Quote-based update
const feedHash = "0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f";
const [sigVerifyIx, quote] = await queue.fetchUpdateQuoteIx(
  gateway,
  crossbar,
  [feedHash]
);
```

## Support

These legacy scripts are provided as-is with minimal support. For assistance with modern implementations, please:

- Use the current scripts in the parent directory
- Consult the main documentation
- Join the Switchboard community for help with migrations

---

**⚡ Recommendation**: Start new projects with `../runUpdate.ts` for the best experience and lowest costs.