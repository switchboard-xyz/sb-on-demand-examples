<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand: Solana Pull Feed

**Get real-time oracle prices in your Solana program with sub-second latency and 90% lower costs.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Mainnet%20%7C%20Devnet-green)](https://solana.com)
[![Docs](https://img.shields.io/badge/docs-switchboard.xyz-orange)](https://docs.switchboard.xyz)

</div>

## 🚀 Quick Start (30 seconds to first price)

```bash
# Clone and install
git clone https://github.com/switchboard-xyz/sb-on-demand-examples.git
cd sb-on-demand-feeds
bun install

# Get a feed hash from https://ondemand.switchboard.xyz/solana/mainnet
# Run the example (replace with your feed hash)
bun run scripts/feeds/runBundle.ts --feedHash 0xf93c5a12f01a9ff1c8fb1c92e75e86f1e36b2a31ba3de26d32c837e93e9b7116
```

That's it! You're now fetching real-time oracle prices. 🎉

## 📋 Prerequisites

- **Node.js** 16+ and **Bun** (or npm/yarn)
- **Solana CLI** with a configured wallet
- **Anchor Framework** 0.31.1+
- A wallet with some SOL (devnet or mainnet)

## 🎯 What is Switchboard On-Demand?

Switchboard On-Demand revolutionizes oracle data delivery on Solana:
- **90% Lower Costs**: No feed maintenance or crank fees
- **Sub-second Updates**: Direct oracle-to-program data flow
- **No Write Locks**: Multiple programs can read prices simultaneously
- **Instant Setup**: No accounts to create or maintain

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Price Sources  │────▶│     Oracles     │────▶│    Gateway      │
│  (CEX, DEX)     │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        Your Transaction                         │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │ Secp256k1        │         │ Your Program     │              │
│  │ Signature Verify │────────▶│ verifyBundle()   │              │
│  │ Instruction      │         │ use prices       │              │
│  └──────────────────┘         └──────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Traditional Feeds (Higher Cost):
Oracle → Feed Account (write) → Your Program (read)

Bundle Method (90% Lower Cost):
Oracle → Bundle → Your Program (direct use)
```

## 📊 Comparison: Surge vs Bundle vs Traditional Feeds

| Feature | Surge (WebSocket) 🌊 | Bundle Method ✨ | Traditional Feeds |
|---------|---------------------|-----------------|-------------------|
| **Update Latency** | <100ms | <1 second | 2-10 seconds |
| **Transaction Cost** | Subscription | ~0.00015 SOL | ~0.002 SOL |
| **Connection Type** | WebSocket (persistent) | HTTP/RPC | HTTP/RPC |
| **Write Locks** | None | None | Required |
| **Setup Time** | API key required | Instant | 5-10 minutes |
| **Maintenance** | None | None | Crank required |
| **Parallelization** | Unlimited | Unlimited | Limited |
| **Best Use Case** | HFT, Real-time apps | DeFi, Smart contracts | Analytics, History |

*Surge requires a subscription but transactions still use the efficient bundle method

## 🏃‍♂️ Getting Started with Bundles (Recommended)

The easiest way to use Switchboard On-Demand is with **bundles** - no need to create accounts on-chain!

### Step 1: Setup Your Program

Configure the `Anchor.toml` file to point to your solana wallet and the Solana cluster of your choice - Devnet, Mainnet, etc.

Build and deploy your program:
```bash
anchor build
anchor deploy
anchor idl init --filepath target/idl/sb_on_demand_solana.json YOUR_PROGRAM_ADDRESS
```

*Note:* Use `anchor keys list` to view your program address, then update it in `programs/sb-on-demand-solana/src/lib.rs:6`.

### Step 2: Get a Feed Hash

Create a data feed using the [Switchboard On-Demand UI](https://beta.ondemand.switchboard.xyz/bundle-builder) and copy the **feed hash** from your feed.

### Step 3: Use Bundles

Run the bundle script with your feed hash:
```bash
bun install
bun run scripts/feeds/runBundle.ts --feedHash YOUR_FEED_HASH
```

The `scripts/feeds/runBundle.ts` script fetches live data for your feed and demonstrates how to verify it on-chain using the example program in `programs/sb-on-demand-solana/`. The program shows how to:
- Verify bundle signatures
- Extract feed values
- Access feed metadata

## 📁 Script Organization

The example scripts are organized into categories based on their functionality:

### `/scripts/feeds/` - Oracle Feed Operations
- **`runBundle.ts`** - Fetch aggregated price bundles (recommended for most use cases)
- **`runFeed.ts`** - Update individual feed accounts with detailed oracle responses

### `/scripts/streaming/` - Real-time Price Streaming
- **`runSurge.ts`** - WebSocket streaming with Surge API for ultra-low latency
- **`stream.ts`** - Full streaming implementation with on-chain transaction submission
- **`crossbarStream.ts`** - Unsigned price streaming via Crossbar for UI/monitoring

### `/scripts/benchmarks/` - Performance Testing
- **`benchmark.ts`** - Compare latency across different oracle providers
- **`benchmarkCU.ts`** - Measure compute unit consumption for various configurations

### `/scripts/utils.ts` - Shared Utilities
Common functions and configurations used across all scripts.

Each directory contains its own README with detailed documentation for the scripts within.

## Understanding the Bundle Method

### What Makes Bundles Efficient?

The bundle method (`scripts/feeds/runBundle.ts`) is significantly more efficient than traditional feed updates for several key reasons:

#### 1. **No Write Locks on Data Feeds**
- Traditional feed updates require write locks on feed accounts, limiting parallelization
- Bundles are stateless - they don't modify any on-chain accounts
- Multiple programs can read the same price data simultaneously without contention
- This eliminates bottlenecks in high-throughput scenarios

#### 2. **Streaming Price Updates**
- Bundles can stream real-time prices without storing them on-chain
- No need to wait for on-chain state updates
- Prices are verified and used immediately within your transaction
- Reduces latency from seconds to milliseconds

#### 3. **Composable Architecture**
The bundle method consists of two key components:

##### a) **Secp256k1 Precompile Instruction**
```typescript
const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(gateway, crossbar, [
  argv.feedHash,
]);
```
- Uses Solana's native secp256k1 precompile for signature verification
- Verifies oracle signatures without expensive on-chain compute
- Batches multiple signature verifications in a single instruction

##### b) **verifyBundle Call in User Code**
```rust
let verified_bundle = BundleVerifierBuilder::from(&bundle)
    .queue(&queue)
    .slothash_sysvar(&slothashes)
    .ix_sysvar(&instructions)
    .clock(&Clock::get()?)
    .max_age(50) // Maximum age in slots for bundle freshness
    .verify()
    .unwrap();
```
- Validates the bundle against authorized oracle keys
- Ensures data freshness using slot hashes
- Extracts verified price data for immediate use

### Performance Benefits

1. **Lower Transaction Costs**
   - No account rent fees
   - Reduced compute units (CU) usage
   - Efficient signature verification via precompile

2. **Higher Throughput**
   - No write lock contention
   - Parallel price reads across multiple programs
   - Can update hundreds of prices in a single transaction

3. **Reduced Latency**
   - Direct oracle-to-program data flow
   - No intermediate on-chain storage step
   - Sub-second price updates possible

### Example Usage Pattern

```typescript
// Fetch the latest price bundle
const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(gateway, crossbar, [
  feedHash1,
  feedHash2,
  // ... can batch multiple feeds
]);

// Create transaction with both instructions
const tx = await asV0Tx({
  connection,
  ixs: [
    sigVerifyIx,        // Verify oracle signatures
    yourProgramIx       // Use verified prices in your logic
  ],
  signers: [keypair],
  lookupTables: [lut],
});
```

### When to Use Bundles vs Traditional Feeds

**Use Bundles when:**
- You need real-time price updates
- Running high-frequency trading strategies
- Building composable DeFi protocols
- Optimizing for gas efficiency
- Requiring parallel price reads

**Use Traditional Feeds when:**
- You need persistent on-chain price history
- Other programs need to read your price data
- Building price archives or analytics

## 🌊 Switchboard Surge: WebSocket Streaming (NEW!)

Switchboard Surge takes real-time data delivery to the next level with **WebSocket-based price streaming** for ultra-low latency applications.

### What is Switchboard Surge?

Surge is a premium WebSocket streaming service that delivers price updates directly from oracles with the lowest possible latency:

- **Sub-100ms Latency**: Direct oracle-to-client streaming
- **Event-Driven Updates**: Receive prices as they change, not on a schedule
- **No Polling Required**: Persistent WebSocket connection eliminates request overhead
- **Bundle Compatible**: Seamlessly convert streaming updates to on-chain bundles

### Surge Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Price Sources  │────▶│  Oracle Network │────▶│  Surge Gateway  │
│  (CEX, DEX)     │     │                 │     │   (WebSocket)   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │                     │
                                              │  Your Application   │
                                              │                     │
                                              │ ┌─────────────────┐ │
                                              │ │ WebSocket Client│ │
                                              │ │ Event Listeners │ │
                                              │ │ Price Handler   │ │
                                              │ └────────┬────────┘ │
                                              │          │          │
                                              │          ▼          │
                                              │   On-Chain Bundle   │
                                              │   (when needed)     │
                                              └─────────────────────┘

Data Flow:
1. Oracle → Surge Gateway: ~10ms
2. Gateway → Your App: ~20-50ms
3. Total Latency: <100ms (vs 1000ms+ for traditional feeds)
```

### Getting Started with Surge

#### Step 1: Get Your API Key

Contact the Switchboard team to obtain a `SURGE_API_KEY` for accessing the WebSocket gateway.

#### Step 2: Set Environment Variables

```bash
# Add to your .env file
SURGE_API_KEY=your_surge_api_key_here
```

#### Step 3: Run the Surge Example

```bash
# Stream real-time BTC/USDT prices
bun run scripts/streaming/runSurge.ts

# Example output:
# ==================== Switchboard Surge ====================
# Gateway URL: https://92.222.100.185.xip.switchboard-oracles.xyz/devnet
# Subscribed to: BTC/USDT (Binance)
#
# Price Update: $128,542.10
# Latency: 42ms | Slot: 301234567
#
# Price Update: $128,541.85
# Latency: 38ms | Slot: 301234568
```

### Surge Implementation Example

```typescript
import * as sb from "@switchboard-xyz/on-demand";

// Initialize Surge client
const surge = new sb.Surge({
  apiKey: process.env.SURGE_API_KEY!,
  gatewayUrl: 'https://92.222.100.185.xip.switchboard-oracles.xyz/devnet',
  verbose: true,
});

// Connect and subscribe to price feeds
await surge.connectAndSubscribe([
  { symbol: 'BTC/USD' },
  { symbol: 'ETH/USD' },
  { symbol: 'SOL/USD' },
]);

// Handle real-time updates
surge.on('update', async (response: sb.SurgeUpdate) => {
  const latency = Date.now() - response.data.source_ts_ms;
  console.log(`${response.data.symbol}: $${response.data.price}`);
  console.log(`Latency: ${latency}ms`);

  // Option 1: Use price directly in your app
  await updatePriceDisplay(response.data.symbol, response.data.price);

  // Option 2: Convert to on-chain bundle when needed
  if (shouldExecuteTrade(response)) {
    const [sigVerifyIx, bundle] = response.toBundleIx();
    await executeTrade(sigVerifyIx, bundle);
  }
});

// Connection is established automatically in connectAndSubscribe
console.log('🚀 Listening for price updates...');
```

### Surge Use Cases

#### 1. **High-Frequency Trading Bots**
```typescript
// React instantly to price movements
surge.on('update', async (response: sb.SurgeUpdate) => {
  const opportunity = checkArbitrage(response.data);
  if (opportunity && opportunity.profit > MIN_PROFIT) {
    // Execute trade within milliseconds of price change
    const [ix, bundle] = response.toBundleIx();
    await executeArbitrageTrade(ix, bundle, opportunity);
  }
});
```

#### 2. **Real-Time Dashboards**
```typescript
// Update UI with zero latency
surge.on('update', (response: sb.SurgeUpdate) => {
  // Update price displays instantly
  dashboardPrices[response.data.symbol] = response.data.price;

  // Track performance metrics
  const latency = Date.now() - response.data.source_ts_ms;
  metrics.avgLatency = updateMovingAverage(latency);
  metrics.updatesPerSecond++;
});
```

#### 3. **MEV Protection**
```typescript
// Submit transactions at optimal moments
surge.on('update', async (response: sb.SurgeUpdate) => {
  if (pendingOrder && response.data.price <= pendingOrder.targetPrice) {
    // Execute immediately when price hits target
    const tx = await createLimitOrderTx(response);
    await sendTransactionWithMevProtection(tx);
  }
});
```

### When to Use Each Method

| Use Case | Surge 🌊 | Bundles 📦 | Traditional Feeds 📊 |
|----------|----------|------------|---------------------|
| **Latency** | <100ms ⚡ | <1000ms | 2-10s |
| **Best For** | HFT, Real-time Apps | DeFi, Smart Contracts | Analytics, History |
| **Connection** | WebSocket | HTTP/RPC | HTTP/RPC |
| **Cost Model** | Subscription | Per Transaction | Per Update |
| **Complexity** | Medium | Low | Low |

### Bundle Instruction Size Mathematics

Understanding the byte requirements helps optimize your transactions:

#### Base Instruction Components

For a bundle with **1 oracle signature** and **1 feed**:

```
Base instruction size = Fixed overhead + Oracle data + Feed data + Message + Account

Fixed overhead:
- 1 byte: Signature count
- 11 bytes: Signature offset data
Total fixed: 12 bytes

Oracle signature block:
- 64 bytes: Secp256k1 signature (r, s components)
- 1 byte: Recovery ID
- 20 bytes: Ethereum address (hashed pubkey)
Total per oracle: 85 bytes

Feed data in message (FeedInfo structure):
- 32 bytes: Checksum (feed hash)
- 16 bytes: Value (i128)
- 1 byte: Min oracle samples
Total per feed: 49 bytes

Common message overhead:
- 1 byte: Slot offset
Total message overhead: 1 byte

Account overhead:
- 32 bytes: Switchboard lookup table account
Total account overhead: 32 bytes

Base total = 12 + 85 + 49 + 1 + 32 = 179 bytes
```

#### Scaling Formula

For `n` oracles and `m` feeds:

```
Total bytes = 1 + (n × 11) + (n × 85) + (m × 49) + 1 + 32
            = 1 + (n × 96) + (m × 49) + 1 + 32
            = 34 + (n × 96) + (m × 49)
```

#### Examples

- **1 oracle, 1 feed**: ~179 bytes
- **3 oracles, 1 feed**: 34 + (3 × 96) + 49 = 371 bytes
- **1 oracle, 5 feeds**: 34 + 96 + (5 × 49) = 375 bytes
- **3 oracles, 10 feeds**: 34 + (3 × 96) + (10 × 49) = 812 bytes

#### Additional Bytes Per Component

- **Per additional oracle**: +96 bytes (11 bytes offset + 85 bytes signature block)
- **Per additional feed**: +49 bytes (in the message portion)

This efficient packing allows you to verify multiple price feeds from multiple oracles in a single instruction, making it ideal for DeFi protocols that need multiple price points.

## Alternative: Traditional Feed Accounts

While this example focuses on the more efficient bundle method, Switchboard also supports traditional on-chain feed accounts for use cases that require persistent price history.

## 🛠️ Environment Setup

### Configure Solana CLI
```bash
# Set to devnet (or mainnet-beta for production)
solana config set --url https://api.devnet.solana.com

# Check your wallet address
solana address

# Get some SOL from the faucet (devnet only)
solana airdrop 2
```

### Set Environment Variables
```bash
# Create a .env file (see .env.example)
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export SURGE_API_KEY=your_surge_api_key_here  # Optional: For Surge WebSocket streaming
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### "Program not deployed"
```bash
# Deploy the program first
anchor build
anchor deploy
anchor idl init --filepath target/idl/sb_on_demand_solana.json YOUR_PROGRAM_ADDRESS
```

#### "Invalid feed hash"
- Get a valid feed hash from [Switchboard On-Demand](https://beta.ondemand.switchboard.xyz/bundle-builder)
- Ensure you're using the correct format: `0x...` (32 bytes)
- Check you're on the right network (devnet/mainnet)

#### "Transaction too large"
- Reduce the number of oracles or feeds per transaction
- Use the scaling formula: `34 + (n × 96) + (m × 49)` bytes
- Consider batching large requests

#### "Insufficient funds"
```bash
# Check your balance
solana balance

# Get more SOL (devnet)
solana airdrop 2
```

#### "Simulation failed"
- Check the program logs: `solana logs | grep "YOUR_PROGRAM_ID"`
- Ensure all accounts are correctly passed
- Verify the bundle isn't stale (>150 slots old)

## ❓ FAQ

### What is a feed hash?
A feed hash uniquely identifies a price feed configuration. It's a 32-byte value (displayed as 0x...) that contains the job definitions for fetching price data. Get one from the [Switchboard On-Demand UI](https://beta.ondemand.switchboard.xyz/bundle-builder).

### How many oracles should I use?
- **Minimum**: 1 oracle (testing only)
- **Recommended**: 3 oracles (good balance of cost and security)
- **Maximum**: 10+ oracles (highest security, higher cost)

### What's the cost per update?
- **Bundle method**: ~0.00015 SOL per update
- **Traditional feeds**: ~0.002 SOL per update
- Costs vary based on compute units and priority fees

### Can I use this on mainnet?
Yes! Just update your configuration:
```bash
solana config set --url https://api.mainnet-beta.solana.com
# Use mainnet feed hashes from https://ondemand.switchboard.xyz/solana/mainnet
```

### How fresh is the price data?
- Bundle data must be used within your configured slot limit
- Actual price staleness depends on the oracle configuration
- Check `slots_stale()` in your program to verify freshness

### Can multiple programs read the same price?
Yes! The bundle method has no write locks, allowing unlimited parallel reads. This is a major advantage over traditional feeds.

### What is Switchboard Surge?
Surge is a WebSocket-based streaming service that provides ultra-low latency (<100ms) price updates. It's ideal for high-frequency trading, real-time dashboards, and applications that need the absolute fastest price data. Surge streams prices directly to your application via WebSocket and can convert updates to on-chain bundles when needed.

### How do I get a Surge API key?
Contact the Switchboard team through their [Discord](https://discord.gg/switchboard) or support channels to request access to Surge. The API key is required to authenticate with the WebSocket gateway.

### When should I use Surge vs regular bundles?
- **Use Surge** when you need the absolute lowest latency (<100ms), continuous price streaming, or are building high-frequency trading systems
- **Use regular bundles** for most DeFi applications, smart contracts, and when you don't need sub-second latency
- **Use traditional feeds** only when you need persistent on-chain price history

### Does Surge work offline?
No, Surge requires an active WebSocket connection. For offline or intermittent connectivity scenarios, use the standard bundle method which works with regular HTTP requests.

## 📚 Advanced Usage

### Custom Oracle Jobs
Create feeds with specific data sources:
```typescript
const CUSTOM_JOBS = [
  buildBinanceJob("BTCUSDT"),
  buildCoinbaseJob("BTC-USD"),
  buildPythJob("e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"),
];
```

### Error Handling Best Practices
```typescript
try {
  // Fetch bundle with proper error handling
  const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(
    gateway,
    crossbar,
    feedHashes
  );

  // Create your program instruction
  const ix = await program.methods
    .yourMethod(bundle)
    .accounts({
      queue: queue.pubkey,
      slothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      // ... other accounts
    })
    .instruction();

  // Execute with retry logic
  const tx = await asV0Tx({
    connection,
    ixs: [sigVerifyIx, ix],
    signers: [wallet],
  });

  await connection.sendTransaction(tx);
} catch (error) {
  if (error.message.includes("bundle too stale")) {
    // Fetch fresh bundle and retry
  } else if (error.message.includes("insufficient signatures")) {
    // Handle oracle consensus failure
  }
  // Implement appropriate fallback behavior
}
```

### Production Deployment Checklist
- [ ] Use mainnet endpoints and feed hashes
- [ ] Implement proper error handling and retries
- [ ] Set appropriate compute unit limits
- [ ] Monitor oracle response rates
- [ ] Use priority fees during high congestion
- [ ] Implement staleness checks in your program
- [ ] Set up monitoring and alerts

## 💡 Real-World Examples

### DeFi Lending Protocol
```rust
// In your Solana program
pub fn liquidate_position(ctx: Context<Liquidate>, bundle: Vec<u8>) -> Result<()> {
    // Verify the bundle
    let verified_bundle = BundleVerifierBuilder::from(&bundle)
        .queue(&ctx.accounts.queue)
        .slothash_sysvar(&ctx.accounts.slothashes)
        .ix_sysvar(&ctx.accounts.instructions)
        .clock(&Clock::get()?)
        .max_age(50)
        .verify()?;

    // Extract BTC price
    let btc_feed = verified_bundle.feed(BTC_FEED_ID)?;
    let btc_price = btc_feed.value();

    // Check if position is underwater
    let ltv = calculate_ltv(ctx.accounts.position, btc_price);
    require!(ltv > LIQUIDATION_THRESHOLD, ErrorCode::PositionHealthy);

    // Execute liquidation...
}
```

### Perpetual DEX
```typescript
// Client-side price fetching for a perps exchange
async function executeTrade(
  amount: number,
  leverage: number,
  feedHashes: string[]
) {
  // Fetch multiple prices in one bundle
  const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(
    gateway,
    crossbar,
    feedHashes // ["BTC/USD", "ETH/USD", "SOL/USD"]
  );

  // Create your trading instruction
  const tradeIx = await program.methods
    .openPosition(amount, leverage, bundle)
    .accounts({
      trader: wallet.publicKey,
      market: marketPda,
      queue: queue.pubkey,
      // ... other accounts
    })
    .instruction();

  // Execute atomically
  const tx = await asV0Tx({
    connection,
    ixs: [sigVerifyIx, tradeIx],
    signers: [wallet],
    computeUnitPrice: 50_000, // Higher priority for MEV protection
  });

  await connection.sendTransaction(tx);
}
```

### Gaming Item Pricing
```rust
// Dynamic NFT pricing based on in-game currency rates
pub fn price_game_item(
    ctx: Context<PriceItem>,
    bundle: Vec<u8>,
    item_id: u64
) -> Result<()> {
    let verified_bundle = verify_bundle(ctx, bundle)?;

    // Get both USD and in-game token prices
    let usd_price = get_feed_value(&verified_bundle, USD_FEED)?;
    let game_token_price = get_feed_value(&verified_bundle, GAME_TOKEN_FEED)?;

    // Calculate item price in game tokens
    let item_usd_value = ITEM_PRICES[item_id as usize];
    let price_in_tokens = (item_usd_value * DECIMALS) / game_token_price;

    // Update on-chain price
    ctx.accounts.item_listing.price = price_in_tokens;
    ctx.accounts.item_listing.last_update = Clock::get()?.slot;

    Ok(())
}
```

### Stablecoin Minting
```typescript
// Mint stablecoins with collateral
async function mintStablecoin(collateralAmount: number) {
  // Fetch collateral asset prices
  const collateralFeeds = [
    "0x...", // wBTC feed hash
    "0x...", // wETH feed hash
    "0x...", // SOL feed hash
  ];

  const [sigVerifyIx, bundle] = await queue.fetchUpdateBundleIx(
    gateway,
    crossbar,
    collateralFeeds
  );

  const mintIx = await stablecoinProgram.methods
    .mint(collateralAmount, bundle)
    .accounts({
      user: wallet.publicKey,
      collateralVault: vaultPda,
      mintAuthority: mintAuthorityPda,
      queue: queue.pubkey,
      slothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  // Bundle verification + minting in one atomic transaction
  const tx = await asV0Tx({
    connection,
    ixs: [sigVerifyIx, mintIx],
    signers: [wallet],
  });

  const sig = await connection.sendTransaction(tx);
}
```

## 📖 Additional Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [On-Demand Architecture Deep Dive](https://switchboardxyz.gitbook.io/switchboard-on-demand)
- [Discord Community](https://discord.gg/switchboard)
- [Example DeFi Integration](https://github.com/switchboard-xyz/switchboard-v2/tree/main/programs/anchor-defi)

---

For more examples and documentation, visit [docs.switchboard.xyz](https://docs.switchboard.xyz)
