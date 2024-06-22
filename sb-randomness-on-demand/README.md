<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/core-sdk/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard On-Demand: Randomness 
This example demonstrates the use of Switchboard's On-Demand Randomness functionality.

</div>


## Getting Started

Welcome to Switchboard randomness on-demand.  The easiest and most secure
randomness solution on Solana.

To read more about the adversarial assumptions that Switchboard Randomness
On-Demand makes, please see: [https://docs.switchboard.xyz/docs/switchboard/switchboard-randomness](https://docs.switchboard.xyz/docs/switchboard/switchboard-randomness)

#### PLEASE ENSURE YOU USE ANCHOR VERSION 0.30.0. 

Configure the `anchor.toml` file to point to your solana wallet and the Solana cluster of your choice - Devnet, Mainnet, etc.

Then, to see the power of on-demand feeds, run the following:

```bash
cd sb-randomness
anchor build
```
After building, take note of your program address and insert it in your program `lib.rs` file here:
*Note:* an easy command to view your recently built programm address - `anchor keys list`.
```typescript
declare_id!(“[YOUR_PROGRAM_ADDRESS]“);
```
Rebuild your program.
```bash
anchor build
```
Deploy your program, initialise the IDL.
*Note:* ensure you insert your program address in the IDL initialise command.

```bash
anchor deploy
anchor idl init --filepath target/idl/sb_randomness.json YOUR_PROGRAM_ADDRESS
```
Install deps:
```bash
cd ..
pnpm i 
pnpm update
```

## Running the example

This example repo quickly demonstrates how to use Switchboard randomness.

Its as simple as running one command via our sdk to commit to using a slothash,
requesting the entropy from the oracle, and revealing said randomness.

Randomness is demonstrated through the simple Coin Flip Challenge game! You must guess the outcome of a coin-flip, either "heads" or "tails", and let Switchboards randomness do the rest - hopefully you win!

To run this example coin-flip game: 

`pnpm start {YOUR_GUESS}`


For a full explanation of the code, please see our gitbook tutorial [here!](https://docs.switchboard.xyz/docs/switchboard/switchboard-randomness/getting-started)
