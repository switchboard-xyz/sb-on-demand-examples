# Switchboard Randomness Example: Coin Flip

This example shows the standard EVM randomness flow with a simple wagering game:

1. Call `coinFlip()` to create a randomness request on-chain
2. Read the assigned oracle and settlement timing from the contract
3. Ask Crossbar for the encoded randomness reveal
4. Call `settleFlip(encoded)` to verify and use the result on-chain

The contract accepts any positive wager. The packaged CLI uses a `0.01 MON` smoke-test wager by default.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/)
- A funded wallet on Monad testnet or Monad mainnet

## Standard Network Switch

This example uses the shared EVM env contract:

- `NETWORK=monad-testnet` or `NETWORK=monad-mainnet`
- `RPC_URL` optional override
- `PRIVATE_KEY` required
- `SWITCHBOARD_ADDRESS` advanced override only
- `COIN_FLIP_CONTRACT_ADDRESS` required for the runtime script

Defaults:

- `NETWORK=monad-testnet`
- Testnet RPC: `https://testnet-rpc.monad.xyz`
- Mainnet RPC: `https://rpc.monad.xyz`

Guardrails:

- `NETWORK` must be supported
- `RPC_URL` must match the selected network's chain ID
- Monad `SWITCHBOARD_ADDRESS` overrides must match the canonical address for the selected network
- `COIN_FLIP_CONTRACT_ADDRESS` must already contain deployed bytecode before `bun run flip` will continue

> Running this example on mainnet is operationally possible after the network switch, but the game economics are unchanged. A losing flip still burns the wager.

## Setup

```bash
bun install
[ -d lib/forge-std ] || forge install foundry-rs/forge-std --no-git --shallow
forge build
cp .env.example .env
```

Edit `.env`:

```bash
PRIVATE_KEY=0xyour_private_key_here
NETWORK=monad-testnet
RPC_URL=
SWITCHBOARD_ADDRESS=
COIN_FLIP_CONTRACT_ADDRESS=0x...
```

## Deploy

Use the packaged deploy wrapper:

```bash
bun run deploy
```

Switch to mainnet with one env var:

```bash
NETWORK=monad-mainnet bun run deploy
```

Aliases are also available:

```bash
bun run deploy:monad-testnet
bun run deploy:monad-mainnet
```

After deployment, save the emitted contract address into `COIN_FLIP_CONTRACT_ADDRESS`.

Before running the CLI, fund the contract with a separate bankroll so it can pay winning flips. For the packaged `0.01 MON` smoke test, a minimal example is:

```bash
cast send $COIN_FLIP_CONTRACT_ADDRESS \
  --rpc-url ${RPC_URL:-https://testnet-rpc.monad.xyz} \
  --private-key $PRIVATE_KEY \
  --value 0.01ether
```

## Run The Coin Flip

```bash
bun run flip
```

The runtime script will:

- verify the selected `NETWORK`
- verify the RPC chain ID
- verify the Switchboard contract exists on that chain
- verify `COIN_FLIP_CONTRACT_ADDRESS` exists on that chain
- check the contract bankroll for the default `0.01 MON` wager
- submit the flip with a `0.01 MON` wager
- resolve the randomness through Crossbar
- settle the result on-chain

## Test

```bash
bun run test
```

## Direct Forge Deployment

If you need raw Foundry instead of the Bun wrapper, keep the same env contract:

```bash
NETWORK=monad-testnet \
RPC_URL=https://testnet-rpc.monad.xyz \
forge script deploy/CoinFlip.s.sol:CoinFlipScript \
  --rpc-url $RPC_URL \
  --broadcast
```

After the Forge deploy completes, save the emitted contract address into `COIN_FLIP_CONTRACT_ADDRESS`, fund the bankroll, and then run `bun run flip` with the same `.env` file.
