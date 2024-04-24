<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand: Solana Pull Feed
This example demonstrates the use of Switchboard's On-Demand Feed.

</div>

## Getting Started

To test feed creation and usage:
To see the power of on-demand feeds, run the following:

```bash
anchor build
anchor deploy
anchor idl init --filepath target/idl/sb_on_demand_solana.json 2uGHnRkDsupNnicE3btnqJbpus7DWKuniZcRmKAzHFv5
```

Once deployed, you can run the demo script included here to test populating the feed:

```bash
pnpm i
ts-node scripts/pull.ts
```
