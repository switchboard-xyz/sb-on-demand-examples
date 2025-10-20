# Switchboard On-Demand Feed Examples

This directory contains examples for integrating Switchboard On-Demand oracles into your Solana programs, organized by complexity level and use case.

## Directory Structure

### 📄 Feed Creation
- **`createManagedFeed.ts`** - Create a new managed feed, store on IPFS, and test oracle updates

### 📁 `basic/` - Getting Started Examples
Simple, easy-to-understand examples perfect for learning:
- **`managedUpdate.ts`** - Complete managed update flow with detailed comments and comprehensive documentation

**Use when**: Learning Switchboard, building your first integration, need minimal setup

### 📁 `advanced/` - Production-Ready Examples
Compute-optimized examples with performance best practices:
- **`runUpdate.ts`** - Full production example with LUT optimization, performance monitoring

**Use when**: Building production apps, need maximum performance, handling high transaction volume

### 📁 `legacy/` - Previous Generation Examples
Examples using the older Pull Feed system (still supported):
- **`runFeed.ts`** - Individual feed updates with granular control

## Quick Start

### Create a New Feed
```bash
ts-node feeds/createManagedFeed.ts --name "BTC/USD" --base BTC --quote USD
```

### For Beginners (Recommended)
```bash
cd basic/
npm run feeds:managed --feedId=0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
```

### For Advanced Users
```bash
cd advanced/
npm run feeds:advanced --feedId=0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
```

## Key Differences

| Feature | Basic Examples | Advanced Examples | Legacy Examples |
|---------|----------------|-------------------|-----------------|
| **Setup Time** | 5 minutes | 15 minutes | 10 minutes |
| **Code Lines** | ~50 lines | ~150 lines | ~100 lines |
| **Compute Units** | < 600 CU | < 70 CU | ~30,000 CU |
| **Transaction Size** | Standard | 90% smaller with LUT | Standard |
| **Error Handling** | Basic | Comprehensive | Moderate |
| **Monitoring** | None | Performance metrics | Basic stats |
| **Network Detection** | ✅ Automatic | ✅ Automatic | ❌ Manual |
| **Best For** | Learning, simple apps | Production, high-volume | Legacy migration |

## New vs Legacy Approaches

### 🆕 New Managed Update System (Recommended)
The new system uses the **quote program** to provide:
- **Automatic network detection**: Detects mainnet/devnet and selects appropriate queue
- **Automatic account management**: Oracle accounts are derived deterministically
- **Simplified integration**: Two instructions handle everything
- **Better performance**: Optimized for compute units and transaction size
- **Built-in verification**: Quote program handles signature verification

Examples: `basic/` and `advanced/` directories

### 🔄 Legacy Pull Feed System
The legacy system provides:
- **Granular control**: Individual feed management
- **Direct feed accounts**: Work with specific PullFeed accounts
- **Detailed responses**: Visibility into individual oracle responses
- **Backwards compatibility**: Existing integrations continue to work

Examples: `legacy/` directory

## Integration Patterns

### Basic Integration (New System)
```typescript
// 1. Auto-detect network and load appropriate queue
const queue = await sb.Queue.loadDefault(program);
const gateway = await queue.fetchGatewayFromCrossbar(crossbar);

// 2. Derive canonical oracle account
const [oracleAccount] = OracleQuote.getCanonicalPubkey([feedId]);

// 3. Get managed update instructions
const instructions = await queue.fetchManagedUpdateIxs(
  crossbar,
  [feedId],
  {
    gateway: gateway,
    numSignatures: 1,
    variableOverrides: {},
    instructionIdx: 0,
    payer: keypair.publicKey,
  }
);

// 4. Add your program instruction
const readIx = await myProgram.methods.readOracle()
  .accounts({ oracle: oracleAccount })
  .instruction();

// 5. Send transaction
const tx = await sb.asV0Tx({
  connection,
  ixs: [...instructions, readIx],
  signers: [keypair],
});
```

### Advanced Integration (Production)
```typescript
// Auto-detect network and load queue with optimized gateway
const queue = await sb.Queue.loadDefault(program);
const gateway = await queue.fetchGatewayByLatestVersion(crossbar);

// Full optimization with LUT, monitoring, and error handling
const lut = await queue.loadLookupTable();
const start = Date.now();

const instructions = await queue.fetchManagedUpdateIxs(
  crossbar,
  feedIds,
  {
    gateway: gateway,
    numSignatures: 3,
    variableOverrides: {},
    instructionIdx: 0,
    payer: keypair.publicKey,
  }
);

const tx = await sb.asV0Tx({
  connection,
  ixs: [...instructions, ...businessLogicIxs],
  signers: [keypair],
  computeUnitPrice: 20_000,
  computeUnitLimitMultiple: 1.3,
  lookupTables: [lut], // 90% transaction size reduction
});

// Performance monitoring
const latency = Date.now() - start;
trackMetrics({ latency, computeUnits: sim.value.unitsConsumed });
```

## Prerequisites

- Node.js 16+ installed
- TypeScript and ts-node
- Configured Solana wallet with SOL
- Valid RPC endpoint URL
- Network access to Switchboard Crossbar

## Finding Feed IDs

Find feed IDs in the [Switchboard Explorer](https://ondemand.switchboard.xyz/)

## Environment Configuration

```bash
# RPC endpoint
export RPC_URL="https://api.mainnet-beta.solana.com"

# Priority fees (micro-lamports)
export PRIORITY_FEE_MICRO_LAMPORTS=200000

# Compute unit limit
export COMPUTE_UNIT_LIMIT=150000

# Use devnet for testing
export SOLANA_CLUSTER=devnet
```

## Program Integration

Your Anchor program should accept oracle accounts and verify the data:

```rust
use switchboard_on_demand::{
    QuoteVerifier, SwitchboardQuote, default_queue, get_slot
};

#[derive(Accounts)]
pub struct UseOracleData<'info> {
    // The managed oracle account containing verified quote data
    // Validates it's the canonical account for the contained feeds
    #[account(address = quote_account.canonical_key(&default_queue()))]
    pub quote_account: InterfaceAccount<'info, SwitchboardQuote>,

    /// CHECK: Switchboard queue - validated in QuoteVerifier
    pub queue: AccountInfo<'info>,

    // Your program's state
    #[account(mut)]
    pub state: Account<'info, YourState>,

    // Required sysvars for verification
    pub clock: Sysvar<'info, Clock>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}

pub fn use_oracle_data(ctx: Context<UseOracleData>) -> Result<()> {
    // Verify the oracle data
    let quote = QuoteVerifier::new()
        .queue(&ctx.accounts.queue)
        .slothash_sysvar(&ctx.accounts.slothashes)
        .ix_sysvar(&ctx.accounts.instructions)
        .clock_slot(get_slot(&ctx.accounts.clock))
        .max_age(20) // Max 20 slots old
        .verify_account(&ctx.accounts.quote_account)?;

    // Use the verified data
    for feed in quote.feeds() {
        msg!("Feed: {}, Value: {}", feed.hex_id(), feed.value());
        // Your business logic here
    }

    Ok(())
}
```

## Performance Optimization

### Compute Unit Savings
- **Basic**: ~25,000 CU per update
- **With LUT**: ~18,000 CU per update (28% reduction)
- **Multi-feed batching**: Linear scaling with feeds

### Transaction Size Optimization
- **Standard transaction**: ~1,232 bytes
- **With Address Lookup Table**: ~150 bytes (88% reduction)
- **Impact**: Lower fees, better throughput

### Latency Optimization
- **Quote fetch**: 200-400ms typical
- **Parallel processing**: Fetch multiple feeds simultaneously
- **Caching**: Cache oracle accounts and LUTs

## Troubleshooting

### Common Issues:

1. **"Oracle account not found"**
   - Ensure the feed has been updated recently
   - Verify the feed ID is correct

2. **"Signature verification failed"**
   - Oracle data may be too old
   - Try increasing max_age parameter

3. **"Transaction too large"**
   - Use Address Lookup Tables
   - Reduce number of feeds per transaction

4. **"Insufficient compute units"**
   - Increase compute unit limit
   - Use compute unit multiplier

### Debug Mode:
```typescript
// Enable verbose logging
process.env.DEBUG = "switchboard:*"
```

## Migration from Legacy

If migrating from legacy Pull Feeds:

1. **Replace** `feed.fetchUpdateIx()` with `queue.fetchManagedUpdateIxs()`
2. **Derive** oracle accounts with `OracleQuote.getCanonicalPubkey()`
3. **Update** program to use managed oracle accounts
4. **Test** with basic examples first
5. **Optimize** with advanced patterns

## Related Documentation

- [Switchboard On-Demand Docs](https://docs.switchboard.xyz/on-demand)
- [SDK Reference](https://docs.switchboard.xyz/on-demand/sdk)
- [Program Examples](../../programs/)
- [Performance Benchmarks](../benchmarks/)