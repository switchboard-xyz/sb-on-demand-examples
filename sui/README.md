# Sui Switchboard Examples

This directory contains examples for using Switchboard On-Demand feeds on the Sui blockchain.

## Switchboard on Sui Overview

Switchboard provides decentralized oracle feeds on Sui through a pull-based model where:
- **Feeds are stored on-chain** as Aggregator objects
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

## Feed Update Examples

### Single Feed Update

Fetch fresh oracle data and simulate a feed update by providing a feed ID:

```bash
# Using environment variable
npm run feed-example

# Or pass feed ID as argument
npm run feed-example 0x1234567890abcdef...
# Or with flag
ts-node scripts/crankFeed.ts --feedId 0x1234567890abcdef...
```

### Batch Crossbar Updates

Call Crossbar directly for multiple feed updates using `fetchManyUpdateTx`:

```bash
# Single feed via Crossbar (simulation only)
npm run crossbar-update 0x1234567890abcdef...

# Multiple feeds (comma-separated)
ts-node scripts/crossbarUpdate.ts --feedIds 0x1234...abcd,0x5678...efgh,0x9abc...ijkl

# Sign and send transaction (requires private key)
export SUI_PRIVATE_KEY="your_private_key_here"
ts-node scripts/crossbarUpdate.ts --feedId 0x1234...abcd --sign-and-send

# Batch update with signing
export SUI_PRIVATE_KEY="your_private_key_here"
ts-node scripts/crossbarUpdate.ts --feedIds 0x1234...abcd,0x5678...efgh --sign-and-send

# Using environment variable
export FEED_IDS="0x1234...abcd,0x5678...efgh"
npm run crossbar-update

# Custom Crossbar endpoint
export CROSSBAR_URL="https://crossbar.switchboardlabs.xyz"
npm run crossbar-update
```

### Batch Simulation of All Feeds

Test all predefined feed IDs at once using a comprehensive simulation:

```bash
# Simulate all feeds (summary output)
npm run simulate-all

# Simulate all feeds with detailed output
npm run simulate-all --details

# Sign and send batch update for all feeds
export SUI_PRIVATE_KEY="your_private_key_here"
npm run simulate-all --sign-and-send

# Detailed output with signing
npm run simulate-all --details --sign-and-send

# Direct script execution
ts-node scripts/simulateAll.ts --details
```

This script processes 9 predefined feed IDs and provides:
- **Batch Performance Metrics**: Success rates, throughput, timing
- **Oracle Response Summary**: Values, timestamps, configurations
- **Gas Cost Estimation**: For the entire batch transaction
- **Detailed Results**: Individual feed responses (with `--details` flag)
- **Transaction Execution**: Optional signing and sending (with `--sign-and-send` flag)

### Sui-Specific Flow:

#### Single Feed Update (`crankFeed.ts`)
1. **Load Aggregator**: Creates an `Aggregator` instance from the feed ID
2. **Fetch Oracle Data**: Calls `fetchUpdateTx()` which:
   - Contacts the oracle network off-chain
   - Fetches fresh data from configured data sources (APIs, exchanges)
   - Gets responses from multiple oracles for verification
   - Aggregates the results into a single price/value
3. **Build Transaction**: Creates a Sui transaction with the update instruction
4. **Simulate**: Dry-runs the transaction to show gas costs and effects
5. **Extract Results**: Displays the fresh oracle data and aggregated price

#### Batch Crossbar Update (`crossbarUpdate.ts`)
1. **Configure Crossbar**: Sets the Crossbar URL endpoint (defaults to `https://crossbar.switchboard.xyz`)
2. **Batch Request**: Calls `fetchManyUpdateTx()` with multiple feed IDs:
   - Sends a single request to Crossbar for multiple feeds
   - Crossbar coordinates with oracle networks for all feeds simultaneously
   - Returns responses for successful feeds and failures for problematic ones
3. **Process Results**: Extracts oracle data for each feed:
   - Individual oracle responses with timestamps and values
   - Feed configuration details (variance, minimum responses)
   - Performance metrics and error tracking
4. **Simulate Transaction**: Dry-runs the batch update transaction
5. **Performance Summary**: Shows timing, success rates, and per-feed metrics

### What the Script Does:

- **No private key required** - reads data and simulates transactions
- Loads the specified Switchboard feed (Aggregator object)
- Fetches **fresh oracle data** from external sources via oracle network
- Shows **detailed oracle responses** including individual oracle results
- Displays the **aggregated price** from multiple oracle sources
- Simulates the update transaction to show gas costs and effects

### Example Output:

#### Single Feed Update:
```
Oracle 1:
Full response: {
  "results": [
    {
      "value": "96245.67",
      "timestamp": 1672531200,
      "oracleId": "oracle_1"
    }
  ],
  "feedConfigs": {
    "feedHash": "0x5f8fb5...",
    "maxVariance": 1000000000,
    "minResponses": 1,
    "minSampleSize": 1
  },
  "failures": [],
  "fee": 0,
  "queue": "0x6e43354b..."
}

Simulation result: { status: 'success' }
✅ Feed update simulation successful!
Gas used: { computationCost: '1000000', storageCost: '2000000', storageRebate: '0' }
```

#### Batch Crossbar Update:
```
Using Crossbar URL: https://crossbar.switchboard.xyz
Updating 2 feed(s): [ '0x1234...abcd', '0x5678...efgh' ]

🔄 Calling Crossbar directly for oracle updates...
✅ Crossbar call completed in 1247ms
Received responses for 2 feed(s)

📊 Feed 1 (0x1234...abcd):
Queue: 0x6e43354b8ea2dfad98eadb33db94dcc9b1175e70ee82e42abc605f6b7de9e910
Fee: 0
Failures: 0

  Oracle Result 1:
    Value: 96245.67
    Timestamp: 2024-01-15T10:30:00.000Z
    Full result: {
        "value": "96245.67",
        "timestamp": 1672531200
    }

📈 Performance Summary:
- Feeds requested: 2
- Successful responses: 2
- Failed responses: 0
- Total fetch time: 1247ms
- Average per feed: 624ms
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

### Move Integration
To use feeds in Move contracts:
```move
use switchboard::aggregator::{Aggregator, current_result};

public fun consume_price_data(feed: &Aggregator) {
    let result = current_result(feed);
    let price = result.value();
    let timestamp = result.timestamp();
    // Use price data in your logic
}
```

## Resources

- [Switchboard Sui Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/sui)
- [Sui SDK NPM Package](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)
- [Sui Developer Documentation](https://docs.sui.io)
- [Feed Builder Tool](https://explorer.switchboardlabs.xyz/feed-builder)