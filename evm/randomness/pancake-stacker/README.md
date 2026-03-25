# Switchboard Randomness Example: Pancake Stacker

Pancake Stacker is a simple randomness game:

1. `flipPancake()` requests on-chain randomness
2. The client resolves the assigned oracle response through Crossbar
3. `catchPancake(encoded)` settles the randomness and updates the stack

Each flip has a `2/3` chance to land and a `1/3` chance to reset the stack.

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
- `PANCAKE_STACKER_CONTRACT_ADDRESS` required for the runtime script

Defaults:

- `NETWORK=monad-testnet`
- Testnet RPC: `https://testnet-rpc.monad.xyz`
- Mainnet RPC: `https://rpc.monad.xyz`

Guardrails:

- `NETWORK` must be supported
- `RPC_URL` must match the selected chain
- Monad `SWITCHBOARD_ADDRESS` overrides must match the canonical address for the selected network
- `PANCAKE_STACKER_CONTRACT_ADDRESS` must already contain deployed bytecode before `bun run flip` will continue

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
PANCAKE_STACKER_CONTRACT_ADDRESS=0x...
```

## Deploy

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

After deployment, save the emitted contract address into `PANCAKE_STACKER_CONTRACT_ADDRESS`.

## Run The CLI Flow

```bash
bun run flip
```

The CLI script validates the network selection, RPC chain ID, Switchboard contract, and target contract address before it submits any transactions.

## Run The Web UI

```bash
bun start
```

Then open [http://localhost:3000](http://localhost:3000).

The browser UI lets you choose the RPC endpoint directly. The `NETWORK` switch standardization applies to the CLI deploy and runtime scripts.

## Test

```bash
bun run test
```

## Direct Forge Deployment

If you need raw Foundry instead of the Bun wrapper:

```bash
NETWORK=monad-testnet \
RPC_URL=https://testnet-rpc.monad.xyz \
forge script deploy/PancakeStacker.s.sol:PancakeStackerScript \
  --rpc-url $RPC_URL \
  --broadcast
```
