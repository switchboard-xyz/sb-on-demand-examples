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

## Feed Update Example

Fetch fresh oracle data and simulate a feed update by providing a feed ID:

```bash
# Using environment variable
npm run feed-example

# Or pass feed ID as argument
npm run feed-example 0x1234567890abcdef...
# Or with flag
ts-node scripts/crankFeed.ts --feedId 0x1234567890abcdef...
```

### Sui-Specific Flow:

1. **Load Aggregator**: Creates an `Aggregator` instance from the feed ID
2. **Fetch Oracle Data**: Calls `fetchUpdateTx()` which:
   - Contacts the oracle network off-chain
   - Fetches fresh data from configured data sources (APIs, exchanges)
   - Gets responses from multiple oracles for verification
   - Aggregates the results into a single price/value
3. **Build Transaction**: Creates a Sui transaction with the update instruction
4. **Simulate**: Dry-runs the transaction to show gas costs and effects
5. **Extract Results**: Displays the fresh oracle data and aggregated price

### What the Script Does:

- **No private key required** - reads data and simulates transactions
- Loads the specified Switchboard feed (Aggregator object)
- Fetches **fresh oracle data** from external sources via oracle network
- Shows **detailed oracle responses** including individual oracle results
- Displays the **aggregated price** from multiple oracle sources
- Simulates the update transaction to show gas costs and effects

### Example Output:

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