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