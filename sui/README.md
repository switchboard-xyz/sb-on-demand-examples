# Switchboard Oracle Quote Verifier Example for Sui

<div align="center">
  <img src="https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png" width="120" />
  
  <h3>Get up and running with Switchboard oracles in 5 minutes</h3>
  
  <p>
    <a href="https://discord.gg/switchboardxyz">
      <img alt="Discord" src="https://img.shields.io/discord/841525135311634443?color=blueviolet&logo=discord&logoColor=white" />
    </a>
    <a href="https://twitter.com/switchboardxyz">
      <img alt="Twitter" src="https://img.shields.io/twitter/follow/switchboardxyz?label=Follow+Switchboard" />
    </a>
  </p>
</div>

## 🚀 Quick Start Guide

This example demonstrates how to integrate Switchboard's on-demand oracle data into your Sui Move contracts using the **Quote Verifier** pattern.

### What You'll Build

A smart contract that:
- ✅ Fetches real-time BTC/USD price from multiple oracles
- ✅ Verifies oracle signatures cryptographically
- ✅ Validates data freshness and price deviation
- ✅ Stores verified prices for your DeFi logic

## 📋 Prerequisites

- Sui CLI installed ([Installation Guide](https://docs.sui.io/guides/developer/getting-started/sui-install))
- Node.js 18+ or Bun
- Testnet or Mainnet SUI tokens

## ⚡ 30-Second Setup

```bash
# 1. Clone and navigate
cd sb-on-demand-examples/sui

# 2. Install dependencies
npm install
# or
bun install

# 3. Build the Move contract
npm run build

# 4. Deploy to testnet
npm run deploy:testnet

# 5. Run the example (replace with your deployed package ID)
EXAMPLE_PACKAGE_ID=0xYOUR_PACKAGE_ID npm run example
```

## 📊 Expected Output

```
🚀 Switchboard Oracle Quote Verifier Example

Configuration:
  Network: mainnet
  RPC URL: https://fullnode.mainnet.sui.io:443
  Package: 0xYOUR_PACKAGE_ID
  Feed: 0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
  Oracles: 3

📡 Connecting to Switchboard...
✅ Switchboard Connected:
   Oracle Queue: 0xe9324b82374f18d17de601ae5a19cd72e8c9f57f54661bf9e41a76f8948e80b5
   Guardian Queue: 0x...
   Network: Mainnet

📝 Step 1: Creating QuoteConsumer with Quote Verifier...
   Max Age: 300000ms (300s)
   Max Deviation: 1000 bps (10%)
✅ QuoteConsumer Created: 0x...

🔍 Step 2: Fetching Oracle Data from Switchboard...
   Feed Hash: 0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
   Requesting data from 3 oracles...
✅ Oracle data fetched successfully

🔐 Step 3: Verifying and Updating Price...
   The Quote Verifier will:
   1. Verify oracle signatures
   2. Check quote freshness (<10s old)
   3. Validate price deviation (<10%)
   4. Store the verified price

📊 Results:

✅ Price Update Successful!

📢 Events Emitted:

🎯 PriceUpdated Event:
   Feed Hash: 4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
   Old Price: N/A
   New Price: 98765432100
   Timestamp: 2025-10-27T10:30:00.000Z
   Oracles Confirmed: 3

================================================================================
✨ Example completed successfully!
================================================================================

What just happened:
1. ✅ Created a QuoteConsumer with a Quote Verifier
2. ✅ Fetched real-time price data from multiple Switchboard oracles
3. ✅ Verified oracle signatures on-chain
4. ✅ Validated price freshness and deviation
5. ✅ Stored the verified price in your contract

Your contract now has access to verified, real-time oracle data!
QuoteConsumer ID: 0x...
```

## 🎯 What Just Happened?

1. **Created a QuoteConsumer**: Your on-chain oracle data consumer with built-in verification
2. **Fetched Oracle Data**: Got signed price data from 3 Switchboard oracles via Crossbar
3. **Verified Signatures**: Cryptographically proved data authenticity on-chain
4. **Validated Freshness**: Ensured data is < 10 seconds old
5. **Stored Price**: Saved verified BTC/USD price in your contract state

## 🔑 Key Concepts

### Quote Verifier

The security layer that ensures oracle data is legitimate:

```move
// Creates a verifier tied to an oracle queue
let verifier = switchboard::quote::new_verifier(ctx, queue);

// Verifies signatures and timestamp
verifier.verify_quotes(&quotes, clock);
```

### Why It Matters

**Without verification:**
- ❌ Anyone could submit fake prices (if you don't check the queue id)
- ❌ You'd have to track last update for each price feed yourself
- ❌ Stale data could be replayed to manipulate prices

**With verification:**
- ✅ Only data from authorized oracle queue is accepted
- ✅ Automatic freshness checks prevent stale data
- ✅ Replay attacks are prevented
- ✅ You don't need to store update age or check against it

### Security Checks

The example performs 4 security validations:

```move
// 1. Verify oracle signatures and queue membership
verifier.verify_quotes(&quotes, clock);

// 2. Check quote exists for the requested feed
assert!(verifier.quote_exists(feed_hash), EInvalidQuote);

// 3. Validate freshness (< 10 seconds)
assert!(quote.timestamp_ms() + 10000 > clock.timestamp_ms(), EQuoteExpired);

// 4. Check price deviation (< 10%)
validate_price_deviation(&last_price, &new_price, max_deviation_bps);
```

## 📁 Project Structure

```
sui/
├── Move.toml              # Mainnet configuration
├── Move.testnet.toml      # Testnet configuration
├── sources/
│   └── example.move       # Quote Consumer contract with verifier
├── scripts/
│   └── run.ts            # Complete TypeScript example
├── examples/
│   ├── quotes.ts         # Simple quote fetching example
│   └── surge.ts          # WebSocket streaming example
├── package.json
└── README.md
```

## 🛠️ Available Scripts

```bash
# Build the Move contract
npm run build

# Build for testnet
npm run build:testnet

# Run Move tests
npm run test

# Deploy to mainnet
npm run deploy

# Deploy to testnet
npm run deploy:testnet

# Run the complete example with Move integration
npm run example

# Run simple quote fetching example
npm run quotes

# Run Surge WebSocket streaming example
npm run surge
```

## 📖 Detailed Examples

### 1. Complete Example with Move Integration

The `scripts/run.ts` file demonstrates the full workflow:

```bash
# Set your deployed package ID
export EXAMPLE_PACKAGE_ID=0xYOUR_PACKAGE_ID

# Run the example
npm run example

# Customize parameters
export FEED_HASH=0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
export NUM_ORACLES=5
export MAX_AGE_MS=300000
export MAX_DEVIATION_BPS=1000
npm run example
```

### 2. Simple Quote Fetching

The `examples/quotes.ts` file shows how to fetch quotes without Move integration:

```bash
# Simulate transaction (default)
npm run quotes

# Sign and send transaction
export SUI_PRIVATE_KEY="your_private_key_here"
npm run quotes -- --sign

# Use a custom feed hash
npm run quotes -- --feedHash 0x1234567890abcdef...

# Request data from 5 oracles
npm run quotes -- --numOracles 5

# Use testnet
npm run quotes -- --network testnet
```

### 3. Surge WebSocket Streaming

The `examples/surge.ts` file demonstrates real-time price monitoring:

```bash
# Get a Surge API key from https://explorer.switchboard.xyz
export SURGE_API_KEY="sb_live_your_api_key_here"

# Stream for 10 seconds (default)
npm run surge

# Subscribe to specific feeds
npm run surge -- --feeds BTC/USD,ETH/USD,SOL/USD

# Stream for 30 seconds
npm run surge -- --duration 30

# Stream continuously (until Ctrl+C)
npm run surge -- --duration 0
```

## 🔧 Customizing for Your Use Case

### Example: Lending Protocol

```move
public fun check_liquidation(
    consumer: &QuoteConsumer,
    position: &Position,
    clock: &Clock
): bool {
    // Ensure fresh data
    assert!(is_price_fresh(consumer, clock), EQuoteExpired);
    
    let price = consumer.last_price.borrow();
    let collateral_value = position.collateral * price.value();
    let debt_value = position.debt;
    
    // Liquidate if under 110% collateralization
    collateral_value < debt_value * 110 / 100
}
```

### Example: DEX Trading

```move
public fun execute_swap(
    btc_consumer: &QuoteConsumer,
    eth_consumer: &QuoteConsumer,
    amount: u64,
    clock: &Clock
): u64 {
    // Ensure both prices are fresh
    assert!(is_price_fresh(btc_consumer, clock), EQuoteExpired);
    assert!(is_price_fresh(eth_consumer, clock), EQuoteExpired);
    
    let btc_price = btc_consumer.last_price.borrow();
    let eth_price = eth_consumer.last_price.borrow();
    
    // Calculate swap rate
    let rate = btc_price.value() / eth_price.value();
    amount * rate
}
```

### Example: Options Settlement

```move
public fun settle_option(
    consumer: &QuoteConsumer,
    option: &Option,
    clock: &Clock
): bool {
    // Get current spot price
    let spot_price = get_current_price(consumer);
    assert!(spot_price.is_some(), EQuoteExpired);
    
    let price = spot_price.borrow();
    
    // Determine if option is in-the-money
    price.value() > option.strike_price
}
```

## 🌐 Active Deployments

The Switchboard On-Demand service is currently deployed on:

- **Mainnet**: [`0xa81086572822d67a1559942f23481de9a60c7709c08defafbb1ca8dffc44e210`](https://suiscan.xyz/mainnet/object/0xa81086572822d67a1559942f23481de9a60c7709c08defafbb1ca8dffc44e210)
- **Testnet**: [`0x28005599a66e977bff26aeb1905a02cda5272fd45bb16a5a9eb38e8659658cff`](https://suiscan.xyz/testnet/object/0x28005599a66e977bff26aeb1905a02cda5272fd45bb16a5a9eb38e8659658cff)

## 📊 Available Feeds

| Asset | Feed Hash |
|-------|-----------|
| BTC/USD | `0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812` |
| ETH/USD | `0xa0950ee5ee117b2e2c30f154a69e17bfb489a7610c508dc5f67eb2a14616d8ea` |
| SOL/USD | `0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9` |
| SUI/USD | `0x7ceef94f404e660925ea4b33353ff303effaf901f224bdee50df3a714c1299e9` |

Find more feeds at: [https://explorer.switchboard.xyz](https://explorer.switchboard.xyz)

## 🔐 Move Integration

### Adding Switchboard to Your Move.toml

```toml
[dependencies.Switchboard]
git = "https://github.com/switchboard-xyz/sui.git"
subdir = "on_demand/"
rev = "mainnet" # or "testnet" for testnet

[dependencies.Sui]
git = "https://github.com/MystenLabs/sui.git"
subdir = "crates/sui-framework/packages/sui-framework"
rev = "framework/mainnet" # or "framework/testnet" for testnet
```

### Using Quotes in Move

```move
module example::my_protocol;

use switchboard::quote::{QuoteVerifier, Quotes};
use switchboard::decimal::Decimal;
use sui::clock::Clock;

public struct MyProtocol has key {
    id: UID,
    quote_verifier: QuoteVerifier,
    last_price: Option<Decimal>,
}

/// Initialize with a quote verifier
public fun init_protocol(queue: ID, ctx: &mut TxContext) {
    let verifier = switchboard::quote::new_verifier(ctx, queue);
    
    transfer::share_object(MyProtocol {
        id: object::new(ctx),
        quote_verifier: verifier,
        last_price: option::none(),
    });
}

/// Update price using oracle quotes
public fun update_price(
    protocol: &mut MyProtocol,
    quotes: Quotes,
    feed_hash: vector<u8>,
    clock: &Clock,
) {
    // Verify oracle signatures
    protocol.quote_verifier.verify_quotes(&quotes, clock);
    
    // Get the verified quote
    assert!(protocol.quote_verifier.quote_exists(feed_hash), 0);
    let quote = protocol.quote_verifier.get_quote(feed_hash);
    
    // Validate freshness
    assert!(quote.timestamp_ms() + 10000 > clock.timestamp_ms(), 1);
    
    // Store the price
    protocol.last_price = option::some(quote.result());
}
```

## 💡 TypeScript SDK Usage

### Fetching Quotes

```typescript
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SwitchboardClient, Quote } from "@switchboard-xyz/sui-sdk";

const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });
const sb = new SwitchboardClient(client);

const tx = new Transaction();

// Fetch quotes for one or more feeds
const quotes = await Quote.fetchUpdateQuote(sb, tx, {
  feedHashes: [
    "0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812", // BTC/USD
  ],
  numOracles: 3,
});

// Use the quotes in your Move call
tx.moveCall({
  target: `${packageId}::example::update_price`,
  arguments: [
    tx.object(quoteConsumerId),
    quotes,
    tx.pure.vector("u8", feedHashBytes),
    tx.object("0x6"), // Clock
  ],
});

// Execute transaction
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
```

## 🐛 Troubleshooting

### "Quote Consumer ID not found"
- Check that the transaction was successful
- Ensure you have sufficient gas
- Wait a few seconds for the object to be available

### "EInvalidQueue"
- Verify you're using the correct queue ID for your network
- Check that you're on the right network (testnet vs mainnet)

### "EQuoteExpired"
- Data is > 10 seconds old
- Fetch fresh data before calling update
- Consider increasing the staleness threshold if needed

### "EPriceDeviationTooHigh"
- Price changed > 10% from last update
- Normal during high volatility periods
- Adjust `max_deviation_bps` if needed for your use case

### Build Errors
```bash
# Clean and rebuild
rm -rf build/
npm run build

# For testnet
npm run build:testnet
```

## 📚 Additional Resources

- 📖 [Switchboard Documentation](https://docs.switchboard.xyz)
- 🌐 [Switchboard Explorer](https://explorer.switchboard.xyz)
- 🔧 [Feed Builder Tool](https://explorer.switchboard.xyz/feed-builder)
- 📦 [Sui SDK NPM Package](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)
- 💬 [Discord Community](https://discord.gg/switchboardxyz)
- 🐦 [Twitter Updates](https://x.com/switchboardxyz)
- 🐛 [Report Issues](https://github.com/switchboard-xyz/sui/issues)

## 🎉 Success!

You now have a working oracle integration with:
- ✅ Verified price feeds
- ✅ Security best practices
- ✅ Production-ready code
- ✅ Multiple validation layers

Ready to build the next generation of DeFi on Sui!

---

<div align="center">
  <p>Built with ❤️ by <a href="https://switchboard.xyz">Switchboard</a></p>
</div>
