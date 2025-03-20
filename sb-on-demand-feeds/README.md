<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand: Solana Pull Feed
This example demonstrates the use of Switchboard's On-Demand Feed.

</div>

## Getting Started

Configure the `anchor.toml` file to point to your solana wallet and the Solana cluster of your choice - Devnet, Mainnet, etc.

Then, to see the power of on-demand feeds, run the following:

```bash
anchor build
```
After building, take note of your program address and insert it in your program `lib.rs` file here:
*Note:* an easy command to view your recently built programm address - `anchor keys list`.
```rust
declare_id!(“[YOUR_PROGRAM_ADDRESS]“);
```
Rebuild your program.
```bash
anchor build
```
Deploy your program, initialise the IDL.
Note: ensure you insert your program address in the IDL initialise command.

```bash
anchor deploy
anchor idl init --filepath target/idl/sb_on_demand_solana.json YOUR_PROGRAM_ADDRESS
```

Once deployed, you can run the demo script included here to test populating the feed:

```bash
bun i
bun update
bun run scripts/createFeed.ts
```
We also included two other scripts, *runFeed.ts* and *copyFeed.ts*

`runFeed.ts` is a super simple script to run an existing feed update that you like with just the feeds public key address!
```
bun run scripts/runFeed.ts --feed AXRydnjDeWUgR5VGFFqtzYv52u2MHqFCYcsHsnEgCD15
```
`copyFeed.ts` is a script that copies the job defitinion of an existing feed but creates a new feed that you own! All you need is an existing feeds public key address.
```
bun run scripts/copyFeed.ts --feed AXRydnjDeWUgR5VGFFqtzYv52u2MHqFCYcsHsnEgCD15
```
`runMany.ts` is a script demonstrating how to run an update for multiple feeds in a single transaction.
```
bun run scripts/runMany.ts
```

For documenation on how Switchboard On-Demand works click [here](https://switchboardxyz.gitbook.io/switchboard-on-demand)!
