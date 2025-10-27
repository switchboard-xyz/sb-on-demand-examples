# Sui Switchboard Examples

This directory contains examples for using Switchboard On-Demand feeds on the Sui blockchain.

## 📁 Directory Structure

```
sui/
├── examples/          # TypeScript client examples
│   ├── quotes.ts     # Oracle Quotes - Simple on-demand feed updates
│   └── surge.ts      # Surge WebSocket streaming
├── package.json
└── README.md
```

## 📂 Examples Overview

The `examples/` directory contains two concise examples for Switchboard on Sui:

- **`quotes.ts`** - Oracle Quotes example showing zero-setup, on-demand oracle data fetching
- **`surge.ts`** - Surge WebSocket streaming for real-time price updates with sub-100ms latency

These examples demonstrate the modern, recommended approaches for integrating Switchboard oracles in your Sui applications.

## Table of Contents

- [Switchboard on Sui Overview](#switchboard-on-sui-overview)
- [Active Deployments](#active-deployments)
- [Setup](#setup)
- [Installation](#installation)
- [Creating Feeds and Aggregators](#creating-feeds-and-aggregators)
- [Updating Feeds](#updating-feeds)
- [Oracle Quotes (October 2025)](#oracle-quotes-october-2025)
- [Move Integration](#move-integration)
- [Feed Update Examples](#feed-update-examples)
- [Switchboard Surge Streaming](#switchboard-surge-streaming)
- [Key Sui Concepts](#key-sui-concepts)
- [Resources](#resources)

## Switchboard on Sui Overview

Switchboard provides decentralized oracle feeds on Sui through a pull-based model where:
- **Feeds are defined off-chain** with their own Feed Identifier linking them to customized logic
- **Updates are triggered on-demand** by calling oracle networks
- **Fresh data is fetched** from external APIs and verified by multiple oracles
- **Results are aggregated** and stored in the feed for immediate use

### Active Deployments

- **Mainnet**: `0xe6717fb7c9d44706bf8ce8a651e25c0a7902d32cb0ff40c0976251ce8ac25655`
- **Testnet**: `0x578b91ec9dcc505439b2f0ec761c23ad2c533a1c23b0467f6c4ae3d9686709f6`

## Setup

1. Install dependencies:
```bash
cd sui
npm install
```

2. Set environment variables:
```bash
export SUI_RPC_URL="https://fullnode.mainnet.sui.io:443"  # Optional, defaults to mainnet
export FEED_ID="your_feed_id_here"
```

## Installation

To use Switchboard in your Sui TypeScript projects, install the required packages:

**NPM:**
```bash
npm install @switchboard-xyz/sui-sdk @mysten/sui --save
```

**Bun:**
```bash
bun add @switchboard-xyz/sui-sdk @mysten/sui
```

**PNPM:**
```bash
pnpm add @switchboard-xyz/sui-sdk @mysten/sui
```

## Creating Feeds and Aggregators

Switchboard feeds can be created using the TypeScript SDK or through the [Feed Builder Tool](https://explorer.switchboard.xyz/feed-builder). Here's a complete example:

```typescript
import {
  SwitchboardClient,
  Aggregator,
} from "@switchboard-xyz/sui-sdk";
import { CrossbarClient, OracleJob } from "@switchboard-xyz/common";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

const keypair = new Ed25519Keypair();
const userAddress = keypair.getPublicKey().toSuiAddress();
const suiClient = new SuiClient({
    url: getFullnodeUrl('testnet'),
});

const crossbarClient = new CrossbarClient("https://crossbar.switchboard.xyz");

// Define oracle jobs - what data sources to fetch
const jobs: OracleJob[] = [
  OracleJob.fromObject({
    tasks: [
      {
        httpTask: {
          url: "https://binance.com/api/v3/ticker/price?symbol=BTCUSDT",
        }
      },
      {
        jsonParseTask: {
          path: "$.price"
        }
      }
    ],
  }),
];

const sb = new SwitchboardClient(suiClient);
const state = await sb.fetchState();
const queue = state.oracleQueueId;

// Store the job definition and get a feed hash
const { feedHash } = await crossbarClient.store(queue, jobs);

// Configure feed parameters
const feedName = "BTC/USDT";
const minSampleSize = 1;
const maxStalenessSeconds = 60;
const maxVariance = 1e9;
const minJobResponses = 1;

let transaction = new Transaction();

// Initialize the aggregator on-chain
await Aggregator.initTx(sb, transaction, {
  feedHash,
  name: feedName,
  authority: userAddress,
  minSampleSize,
  maxStalenessSeconds,
  maxVariance,
  minResponses: minJobResponses,
});

const res = await suiClient.signAndExecuteTransaction({
  signer: keypair,
  transaction,
  options: {
    showEffects: true,
  },
});

// Extract the created aggregator ID
let aggregatorId;
res.effects?.created?.forEach((c: any) => {
  if (c.reference.objectId) {
    aggregatorId = c.reference.objectId;
  }
});

await suiClient.waitForTransaction({
  digest: res.digest,
});

console.log("Aggregator created:", aggregatorId);
```

## Updating Feeds

Once you have an aggregator, you can update it with fresh oracle data:

```typescript
const aggregator = new Aggregator(sb, aggregatorId);

let feedTx = new Transaction();

// Fetch fresh oracle data and build update transaction
const response = await aggregator.fetchUpdateTx(feedTx);
console.log("Fetch Update Oracle Response: ", response);

const res = await suiClient.signAndExecuteTransaction({
  signer: keypair,
  transaction: feedTx,
  options: {
    showEffects: true,
  },
});

await suiClient.waitForTransaction({
  digest: res.digest,
});

console.log({ aggregatorId, res });
```

The `fetchUpdateTx()` method automatically handles:
- Contacting the oracle network off-chain
- Fetching fresh data from configured data sources
- Getting responses from multiple oracles for verification
- Aggregating the results into a single price/value
- Building the Sui transaction with the update instruction

## Oracle Quotes (October 2025)

Oracle Quotes is a new feature that provides a simpler integration pattern without requiring aggregator initialization. This is ideal for applications that need on-demand oracle data without managing feed state.

### Creating a Quote Verifier

First, create a quote verifier in your Move program:

```typescript
import { Quote, SwitchboardClient } from "@switchboard-xyz/sui-sdk";
import { Transaction } from "@mysten/sui/transactions";

const client = new SwitchboardClient(suiClient);
const tx = new Transaction();

const verifier = await Quote.createVerifierTx(client, tx, {
  queue: queueId,
});

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
```

### Fetching Quotes

Fetch oracle quotes for specific feed hashes on-demand:

```typescript
import { fetchQuoteUpdate } from "@switchboard-xyz/sui-sdk";

const tx = new Transaction();

// Fetch quotes for one or more feed hashes
const quotes = await fetchQuoteUpdate(
  client,
  ['0x7418dc6408f5e0eb4724dabd81922ee7b0814a43abc2b30ea7a08222cd1e23ee'],
  tx,
  {
    numOracles: 3,
  }
);

// Use the quotes in your Move function
tx.moveCall({
  target: 'YOUR_PACKAGE::your_module::use_quotes',
  arguments: [
    quotes,
  ],
});

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
```

### Benefits of Oracle Quotes

- **Zero Setup**: No need to initialize aggregators on-chain
- **On-Demand**: Fetch fresh oracle data only when needed
- **Flexible**: Use multiple feeds in a single transaction
- **Cost Effective**: Pay only when you need data

## Move Integration

To use Switchboard in your Move contracts, add the dependencies to your `Move.toml`:

### Move.toml Configuration

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

### Using Aggregators in Move

Here's how to consume oracle data from an aggregator in your Move contracts:

```move
module example::switchboard;

use switchboard::aggregator::{Aggregator, CurrentResult};
use switchboard::decimal::Decimal;

public entry fun use_switchboard_value(aggregator: &Aggregator) {
    let current_result = aggregator.current_result();

    let result: Decimal = current_result.result();
    let result_u128: u128 = result.value();
    let min_timestamp_ms: u64 = current_result.min_timestamp_ms();
    let max_timestamp_ms: u64 = current_result.max_timestamp_ms();
    let range: Decimal = current_result.range();
    let mean: Decimal = current_result.mean();
    let stdev: Decimal = current_result.stdev();
    let max_result: Decimal = current_result.max_result();
    let min_result: Decimal = current_result.min_result();
    let neg: bool = result.neg();

    // Use the price data in your logic
    // For example, check if price is above a threshold
    // let threshold: u128 = 50000 * 1000000000000000000; // $50k with 18 decimals
    // assert!(result_u128 > threshold, 0);
}
```

### Using Oracle Quotes in Move

For the new Oracle Quotes system, here's a complete integration example:

```move
module example::quote_consumer;

use switchboard::quote::{Self, QuoteVerifier, Quotes};
use switchboard::decimal::Decimal;
use sui::object::{Self, UID, ID};
use sui::tx_context::TxContext;
use sui::transfer;

public struct State has key {
    id: UID,
    quote_verifier: QuoteVerifier,
}

/// Initialize your program with a quote verifier
public fun init_with_verifier(ctx: &mut TxContext, queue: ID) {
    let verifier = switchboard::quote::new_verifier(ctx, queue);

    transfer::share_object(State {
        id: object::new(ctx),
        quote_verifier: verifier,
    });
}

/// Consume quotes in your Move function
public entry fun consume_quotes(
    program: &mut State,
    quotes: Quotes,
    ctx: &mut TxContext
) {
    // Verify the quotes against the oracle queue
    let quote_data = program.quote_verifier.verify_quotes(&quotes);

    // Look up a specific feed by its hash
    let feed_hash = b"7418dc6408f5e0eb4724dabd81922ee7b0814a43abc2b30ea7a08222cd1e23ee";

    if (quote_data.contains(feed_hash)) {
        let quote = quote_data.get(feed_hash);

        // Extract the price and metadata
        let result: Decimal = quote.result();
        let value_u128 = result.value();
        let timestamp: u64 = quote.timestamp_ms();

        // Use the oracle data in your application logic
        // For example, execute a trade if price meets conditions
        // execute_trade_logic(value_u128, timestamp);
    };
}
```

### Key Move Types

- **`Aggregator`**: The on-chain feed object storing oracle data
- **`CurrentResult`**: Contains the aggregated price and metadata
- **`Decimal`**: Fixed-point decimal representation with 18 decimals
- **`QuoteVerifier`**: Verifies oracle quotes against a specific queue
- **`Quotes`**: Collection of oracle quotes fetched on-demand

## Running the Examples

### Oracle Quotes Example

The simplest way to get oracle data on Sui - no feed initialization required:

```bash
# Simulate transaction (default)
npm run quotes

# Sign and send transaction
export SUI_PRIVATE_KEY="your_private_key_here"
npm run quotes -- --sign

# Or run directly
tsx examples/quotes.ts
tsx examples/quotes.ts --sign
```

**What it does:**
- Fetches oracle quotes for a BTC/USD feed on-demand
- No need to initialize or manage aggregators
- Simulates or executes the transaction
- Shows how to integrate quotes into your Move contracts

### Surge WebSocket Streaming Example

Real-time price updates with sub-100ms latency via WebSocket:

```bash
# Get a Surge API key from https://explorer.switchboard.xyz
export SURGE_API_KEY="sb_live_your_api_key_here"

# Run with default feeds (BTC/USD, ETH/USD)
npm run surge

# Subscribe to specific feeds
npm run surge -- --feeds=BTC/USD,ETH/USD,SOL/USD

# Sign and send transaction
export SUI_PRIVATE_KEY="your_private_key_here"
npm run surge -- --sign

# Or run directly
tsx examples/surge.ts
tsx examples/surge.ts --feeds=BTC/USD,SOL/USD --sign
```

**What it does:**
- Connects to Switchboard Surge WebSocket service
- Subscribes to real-time price feeds for specified symbols
- Receives live price updates with cryptographic signatures
- Converts Surge updates to Sui quote format
- Shows how to use streaming data in Sui transactions

**What is Surge?**

Surge is a WebSocket-based streaming service that provides:
- **Real-time price feeds** - Subscribe to live price updates across 1000+ trading pairs
- **Sub-100ms latency** - Direct WebSocket connections with millisecond-level latency
- **Multiple data sources** - Aggregate pricing from multiple exchanges and data providers
- **Flexible subscription** - Subscribe to specific symbols/sources or all available feeds
- **Built-in verification** - All prices are cryptographically signed by Switchboard oracles

#### Surge Integration with Sui Quotes

The example shows how to:

1. **Connect to Surge**
   ```typescript
   const surge = new Surge({
     apiKey: API_KEY,
     network: "mainnet",
     verbose: true,
   });
   await surge.connect();
   ```

2. **Subscribe to feeds**
   ```typescript
   await surge.subscribe([
     { symbol: "BTC/USD", source: "WEIGHTED" },
     { symbol: "ETH/USD", source: "WEIGHTED" }
   ]);
   ```

3. **Listen for price updates**
   ```typescript
   surge.on('signedPriceUpdate', (priceUpdate) => {
     // Process price update
   });
   ```

4. **Convert to Sui quotes**
   ```typescript
   const quoteData = await convertSurgeUpdateToQuotes(
     priceUpdate,
     QUEUE_ID
   );
   ```

5. **Use in a Sui transaction**
   ```typescript
   // You now have formatted quote data ready for Sui contracts:
   // - feedHashes: Array of feed identifiers
   // - values: 18-decimal price values
   // - valuesNeg: Boolean array for negative values
   // - timestampSeconds: Oracle timestamp
   // - slot: Current slot number
   ```

#### Available Feed Symbols

Surge supports hundreds of trading pairs. Common examples include:

**Cryptocurrencies:**
- BTC/USD, ETH/USD, SOL/USD, MATIC/USD, AVAX/USD
- BNB/USD, XRP/USD, ADA/USD, DOGE/USD

**Data Sources:**
- BINANCE, COINBASE, BYBIT, and more
- WEIGHTED (aggregated from multiple sources)

For the complete list of available feeds, call:
```typescript
const feedInfo = await surge.getFeedInfo("BTC/USD");
console.log(feedInfo); // Shows available sources
```

#### Example Output

```
Switchboard Surge Example for Sui
Feeds: BTC/USD, ETH/USD
Mode: Simulate Only

Connecting to Surge...
Connected to Surge!

Subscribing to feeds: BTC/USD, ETH/USD
Successfully subscribed to 1 bundles

Waiting for first price update from Surge...
Received price update from Surge!

Converting Surge update to Sui quotes...
Converted to quote format!
Feed hashes: 0x5f8fb5...,0x6f9cc6...
Values: 96245670000000000000,3245700000000000000
Timestamp (seconds): 1704067200

Price Data from Surge:
  0x5f8fb5...: $96,245.67
  0x6f9cc6...: $3,245.70

Simulating transaction...
Transaction simulation successful!
Gas costs: {
  computation: '1000000',
  storage: '2000000',
  storageRebate: '0'
}

Example completed successfully!
```


## Key Sui Concepts

### Aggregator Object
Each feed is represented as an `Aggregator` object on Sui that stores:
- Current price/value data
- Feed configuration (variance tolerance, minimum responses)
- Oracle network settings
- Update history and timestamps

### Update Transaction Flow
1. **fetchUpdateTx()** - Contacts oracles off-chain and builds update transaction
2. **Oracle Network** - Multiple oracles fetch data from configured sources
3. **Aggregation** - Results are combined using median or weighted average
4. **On-chain Update** - Transaction updates the Aggregator object with fresh data

### Surge WebSocket Flow
1. **Connection** - Establish secure WebSocket to Surge gateway
2. **Subscription** - Request specific feeds (symbol/source pairs)
3. **Streaming** - Receive real-time price updates via WebSocket
4. **Conversion** - Transform SurgeUpdate to Sui quote format
5. **On-chain Usage** - Integrate quotes into Sui contracts/transactions

### Move Contract Integration

For complete Move integration examples including Move.toml configuration, aggregator usage, and quote consumption patterns, see the [Move Integration](#move-integration) section above.

## Resources

- [Switchboard Sui Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/sui)
- [Oracle Quotes Documentation](https://docs.switchboard.xyz/product-documentation/oracle-quotes)
- [Switchboard Surge Documentation](https://docs.switchboard.xyz/product-documentation/surge/websocket-streaming)
- [Sui SDK NPM Package](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)
- [On-Demand NPM Package](https://www.npmjs.com/package/@switchboard-xyz/on-demand)
- [Sui Developer Documentation](https://docs.sui.io)
- [Feed Builder Tool](https://explorer.switchboard.xyz/feed-builder)
- [Switchboard Explorer](https://explorer.switchboard.xyz)