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
