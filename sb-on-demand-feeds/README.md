<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand: Solana Pull Feed
This example demonstrates the use of Switchboard's On-Demand Feed.

</div>

## Quick Start with Bundles (Recommended)

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

### Step 2: Get a Feed Checksum

Create a data feed using the [Switchboard On-Demand UI](https://app.switchboard.xyz) and copy the **checksum** from your feed.

### Step 3: Use Bundles

Run the bundle script with your feed checksum:
```bash
bun i
bun run scripts/runBundle.ts --feedHash YOUR_FEED_CHECKSUM
```

The `runBundle.ts` script fetches live data for your feed and demonstrates how to verify it on-chain using the example program in `programs/sb-on-demand-solana/`. The program shows how to:
- Verify bundle signatures
- Extract feed values
- Access feed metadata

## Understanding the Bundle Method

### What Makes Bundles Efficient?

The bundle method (`runBundle.ts`) is significantly more efficient than traditional feed updates for several key reasons:

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
let verified_bundle = BundleVerifierBuilder::new()
    .queue(&queue.to_account_info())
    .slothash_sysvar(&slothashes.to_account_info())
    .ix_sysvar(&instructions.to_account_info())
    .bundle(bundle.as_slice())
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

## Alternative: Account-Based Feeds

For more advanced use cases, you can also create and manage feed accounts:

```bash
bun run scripts/createFeed.ts
```

Other available scripts:
- `runFeed.ts` - Run updates for existing feed accounts
- `copyFeed.ts` - Copy job definitions from existing feeds
- `runMany.ts` - Update multiple feeds in a single transaction

For documenation on how Switchboard On-Demand works click [here](https://switchboardxyz.gitbook.io/switchboard-on-demand)!
