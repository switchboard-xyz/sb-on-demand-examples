<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand: Solana Pull Feed x Secrets
This example demonstrates the use of Switchboard's On-Demand Feed using Secrets.

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

*Note:* in this example you will need to generate an API KEY from `https://openweathermap.org/` and create a `.env` file and insert it there under the name `OPEN_WEATHER_API_KEY`.

For example - `OPEN_WEATHER_API_KEY=XXXXXXXXXXXXXXXXX`.

```bash
pnpm i
pnpm update
ts-node scripts/pull.ts
```

For documenation on how Switchboard On-Demand Secrets works click [here!](https://docs.switchboard.xyz/docs/switchboard/secrets)
