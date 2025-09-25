# Sui Switchboard Examples

This directory contains examples for using Switchboard On-Demand feeds on the Sui blockchain.

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

## Feed Example

Read current feed data and simulate a feed update by providing a feed ID:

```bash
# Using environment variable
npm run feed-example

# Or pass feed ID as argument
npm run feed-example 0x1234567890abcdef...
```

### What it does:

- Connects to Sui network (no private key required)
- Loads the specified Switchboard feed (aggregator)
- Displays the current feed price and timestamp
- Simulates a feed update transaction to show gas costs

### Example Output:

```
Reading feed: 0x1234567890abcdef...
Reading current feed data...
Current feed data: {
  value: "45123.45",
  timestamp: 2024-01-15T10:30:00.000Z
}
Simulating feed update transaction...
Simulation result: { status: 'success' }
✅ Feed update simulation successful!
Gas used: { computationCost: '1000000', storageCost: '2000000', storageRebate: '0' }
```

## Resources

- [Switchboard Sui Documentation](https://docs.switchboard.xyz/product-documentation/data-feeds/sui)
- [Sui SDK](https://www.npmjs.com/package/@switchboard-xyz/sui-sdk)