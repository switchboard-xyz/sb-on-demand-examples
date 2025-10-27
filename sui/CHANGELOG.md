# Changelog

## [2.0.0] - 2025-10-27

### 🎉 Major Update: Quote Verifier Integration

This release completely overhauls the Sui examples to use the new **Quote Verifier** approach introduced in the October 2025 Switchboard upgrade.

### ✨ Added

#### Move Contract
- **`sources/example.move`**: Complete Quote Consumer implementation with Quote Verifier
  - `QuoteConsumer` struct with embedded `QuoteVerifier`
  - `create_quote_consumer()`: Initialize with oracle queue verification
  - `update_price()`: Verify and update prices with security checks
  - `get_current_price()`: Read current verified price
  - `is_price_fresh()`: Check if price data is within max age
  - `calculate_collateral_ratio()`: Example DeFi logic
  - `should_liquidate()`: Example liquidation check
  - Full test suite with Move unit tests

#### TypeScript Scripts
- **`scripts/run.ts`**: Complete end-to-end example
  - Creates QuoteConsumer with Quote Verifier
  - Fetches oracle data from Crossbar
  - Verifies signatures on-chain
  - Updates price with validation
  - Displays events and results

#### Configuration
- **`Move.toml`**: Mainnet configuration with correct Switchboard address
- **`Move.testnet.toml`**: Testnet configuration with correct Switchboard address
- **`tsconfig.json`**: TypeScript configuration for scripts
- **`package.json`**: Updated with new scripts and dependencies

#### Documentation
- **`README.md`**: Comprehensive guide with:
  - Quick start guide (30 seconds to deployment)
  - Expected output examples
  - Key concepts explanation
  - Security checks documentation
  - Multiple use case examples
  - Troubleshooting guide
  - Available feeds table
  - Move integration guide
  - TypeScript SDK usage
  
- **`DEPLOYMENT.md`**: Step-by-step deployment guide
  - Network configuration
  - Build and test instructions
  - Deployment steps for testnet and mainnet
  - Troubleshooting common issues
  - Upgrade instructions
  - Network information

### 🔄 Changed

#### Updated Examples
- **`examples/quotes.ts`**: Enhanced with:
  - Network selection (mainnet/testnet)
  - Switchboard state fetching
  - Better error messages
  - Links to complete example
  - Improved documentation

- **`examples/surge.ts`**: Maintained for WebSocket streaming
  - No changes (already up-to-date)

#### Package Updates
- Updated `@switchboard-xyz/sui-sdk` to `^0.1.9`
- Removed local link dependencies
- Added proper `@switchboard-xyz/on-demand` dependency
- Added new npm scripts:
  - `npm run example`: Run complete Move integration example
  - `npm run build`: Build Move contract
  - `npm run build:testnet`: Build for testnet
  - `npm run test`: Run Move tests
  - `npm run deploy`: Deploy to mainnet
  - `npm run deploy:testnet`: Deploy to testnet

### 🔧 Fixed

#### Addresses
- **Mainnet**: Updated to `0xa81086572822d67a1559942f23481de9a60c7709c08defafbb1ca8dffc44e210`
- **Testnet**: Updated to `0x28005599a66e977bff26aeb1905a02cda5272fd45bb16a5a9eb38e8659658cff`

### 🎯 Migration Guide

If you're upgrading from the old aggregator-based approach:

#### Old Approach (Aggregator)
```typescript
// Create aggregator on-chain
const aggregator = new Aggregator(sb, aggregatorId);
await aggregator.fetchUpdateTx(tx);
```

```move
use switchboard::aggregator::Aggregator;
let result = aggregator.current_result();
```

#### New Approach (Quote Verifier)
```typescript
// Create quote consumer with verifier
const quotes = await Quote.fetchUpdateQuote(sb, tx, {
  feedHashes: [feedHash],
  numOracles: 3,
});

tx.moveCall({
  target: `${packageId}::example::update_price`,
  arguments: [consumer, quotes, feedHash, clock],
});
```

```move
use switchboard::quote::{QuoteVerifier, Quotes};

// Initialize with verifier
let verifier = switchboard::quote::new_verifier(ctx, queue);

// Verify and use quotes
verifier.verify_quotes(&quotes, clock);
let quote = verifier.get_quote(feed_hash);
let price = quote.result();
```

### 📊 Benefits of Quote Verifier

1. **Better Security**: Automatic queue verification and replay protection
2. **Simpler Code**: No need to manage aggregator state
3. **More Flexible**: Fetch multiple feeds in one transaction
4. **Cost Effective**: Pay only when you need data
5. **Fresher Data**: On-demand fetching ensures latest prices

### 🔗 Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Sui SDK](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)
- [Explorer](https://explorer.switchboard.xyz)
- [Discord](https://discord.gg/switchboardxyz)

---

## [1.0.0] - Previous Release

Initial release with aggregator-based approach (deprecated).

