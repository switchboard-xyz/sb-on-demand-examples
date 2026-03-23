# EVM Price Feeds Example

Switchboard price feed consumer example for the current EVM on-demand flow.

## What This Example Covers

- Deploying a `SwitchboardPriceConsumer` contract
- Fetching encoded price updates from Crossbar
- Reading the required oracle update fee from Switchboard
- Calling `updatePrices(encoded, [feedId], { value: fee })`
- Reading the stored on-chain price back from the consumer contract

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/)
- A funded wallet for the target network

## Standard Network Switch

This example uses the shared EVM env contract:

- `NETWORK=monad-testnet` or `NETWORK=monad-mainnet`
- `RPC_URL` optional override
- `PRIVATE_KEY` required
- `SWITCHBOARD_ADDRESS` advanced override only
- `CONTRACT_ADDRESS` optional existing consumer contract

Defaults:

- `NETWORK=monad-testnet`
- Testnet RPC: `https://testnet-rpc.monad.xyz`
- Mainnet RPC: `https://rpc.monad.xyz`

The deploy and runtime scripts enforce guardrails before broadcast:

- `NETWORK` must be one of the supported values
- `RPC_URL` must resolve to the chain ID implied by `NETWORK`
- Monad `SWITCHBOARD_ADDRESS` overrides must match the canonical address for the selected network
- Existing `CONTRACT_ADDRESS` values must already have bytecode on-chain

## Setup

```bash
bun install
forge build
cp .env.example .env
```

Edit `.env`:

```bash
PRIVATE_KEY=0xyour_private_key_here
NETWORK=monad-testnet
RPC_URL=
SWITCHBOARD_ADDRESS=
CONTRACT_ADDRESS=
FEED_HASH=0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
```

## Deploy

Use the standard deploy entrypoint:

```bash
bun run deploy
```

Monad-specific aliases are thin wrappers around the same deploy flow:

```bash
bun run deploy:monad-testnet
NETWORK=monad-mainnet bun run deploy
# or
bun run deploy:monad-mainnet
```

## Run The End-To-End Example

If `CONTRACT_ADDRESS` is unset, the example script deploys a fresh consumer contract with ethers and runs the full flow. If `CONTRACT_ADDRESS` is set, it reuses the deployed contract after verifying bytecode exists there.

```bash
bun run example
```

Switch to Monad mainnet with one env var:

```bash
NETWORK=monad-mainnet bun run example
```

Convert a sample Surge payload to EVM-encoded bytes:

```bash
bun run surge-convert
```

## Test

```bash
bun run test
```

## More Detail

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the deploy-specific runbook and troubleshooting notes.
