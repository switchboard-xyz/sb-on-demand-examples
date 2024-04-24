# Switchboard On-Demand: Randomness 

This example demonstrates the use of Switchboard's On-Demand Randomness functionality. 

## Getting Started

Welcome to Switchboard randomness on-demand.  The easiest and most secure
randomness solution on Solana.

To read more about the adversarial assumptions that Switchboard Randomness
On-Demand makes, please see: https://switchboardxyz.gitbook.io/switchboard-randomness-on-demand

Note: please ensure you add your private key in a .env file under the name SECRET_KEY!

## Installation and Setup

`pnpm i`

`cd sb-randomness`

`anchor build && anchor deploy`

Make note of your PROGRAM_ID and add it to your `program/src/lib.rs` file here:
`declare_id!("PROGRAM_ID");`

Re-run `anchor build && anchor deploy`

`anchor idl init --filepath target/idl/sb_randomness.json ${PROGRAM_ID}`

## Running the example

This example repo quickly demonstrates how to use Switchboard randomness.

Its as simple as running one command via our sdk to commit to using a slothash,
requesting the entropy from the oracle, and revealing said randomness.

Randomness is demonstrated through the simple Coin Flip Challenge game! You must guess the outcome of a coin-flip, either "heads" or "tails", and let Switchboards randomness do the rest - hopefully you win!

To run this example coin-flip game: 

`pnpm start {YOUR_GUESS}`


For a full explanation of the code, please see our gitbook tutorial [here!](https://switchboardxyz.gitbook.io/switchboard-randomness-on-demand/getting-started)
