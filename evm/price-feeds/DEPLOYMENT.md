# Deployment Guide for EVM Price Feeds

This guide covers the packaged deployment flow for `evm/price-feeds`.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/)
- A funded wallet on the target Monad network

## Environment Contract

The example uses one network switch for deploys and runtime scripts:

- `NETWORK=monad-testnet` or `NETWORK=monad-mainnet`
- `RPC_URL` optional override
- `PRIVATE_KEY` required
- `SWITCHBOARD_ADDRESS` advanced override only

Defaults:

- `NETWORK=monad-testnet`
- Testnet RPC: `https://testnet-rpc.monad.xyz`
- Mainnet RPC: `https://rpc.monad.xyz`

Canonical Switchboard addresses:

| Network | Chain ID | Switchboard |
| --- | --- | --- |
| Monad Testnet | `10143` | `0x6724818814927e057a693f4e3A172b6cC1eA690C` |
| Monad Mainnet | `143` | `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |

Before broadcasting, the packaged deploy flow verifies:

- `NETWORK` is supported
- `RPC_URL` resolves to the chain ID implied by `NETWORK`
- Monad `SWITCHBOARD_ADDRESS` overrides match the canonical address
- The resolved Switchboard address already has bytecode

## Setup

```bash
bun install
(
  cd ../randomness/coin-flip
  [ -d lib/forge-std ] || forge install foundry-rs/forge-std --no-git --shallow
)
forge build
cp .env.example .env
```

Minimal `.env`:

```bash
PRIVATE_KEY=0xyour_private_key_here
NETWORK=monad-testnet
RPC_URL=
SWITCHBOARD_ADDRESS=
```

## Deploy With The Packaged Script

Default deploy:

```bash
bun run deploy
```

Explicit testnet:

```bash
bun run deploy:monad-testnet
```

Explicit mainnet:

```bash
NETWORK=monad-mainnet bun run deploy
# or
bun run deploy:monad-mainnet
```

The deploy wrapper resolves the correct RPC and Switchboard contract from `NETWORK`. `RPC_URL` is only needed when you want to override the default endpoint for that network.

## Direct Forge Execution

Use this only if you deliberately want to bypass the Bun wrapper. You still need to set `NETWORK` so the Solidity deploy script can enforce the same guardrails.

```bash
NETWORK=monad-testnet \
RPC_URL=https://testnet-rpc.monad.xyz \
forge script deploy/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvvv
```

Mainnet:

```bash
NETWORK=monad-mainnet \
RPC_URL=https://rpc.monad.xyz \
forge script deploy/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvvv
```

## After Deployment

Save the deployed consumer contract address:

```bash
CONTRACT_ADDRESS=0x_your_deployed_consumer
```

Then run the example flow:

```bash
CONTRACT_ADDRESS=$CONTRACT_ADDRESS bun run example
```

Or use the script to deploy a fresh contract and run the full flow in one step:

```bash
bun run example
```

## Verification

```bash
# Testnet
CHAIN_ID=10143 CONTRACT_ADDRESS=0x_your_deployed_consumer bun run verify

# Mainnet
CHAIN_ID=143 CONTRACT_ADDRESS=0x_your_deployed_consumer bun run verify
```

Use constructor args matching the selected network's Switchboard address when the explorer asks for them.

## Troubleshooting

### RPC and network mismatch

If you see a chain-ID mismatch error, your `RPC_URL` does not match `NETWORK`. Either:

- remove `RPC_URL` and use the default for that network
- or point `RPC_URL` at the correct network

### Invalid Switchboard override

If you see a `SWITCHBOARD_ADDRESS must match NETWORK` error, remove the override unless you are intentionally using the canonical address for that exact Monad network.

### No code at contract address

If the runtime script rejects `CONTRACT_ADDRESS`, the address is wrong for the selected network or the deployment failed.

### Insufficient funds

Check the deployer balance:

```bash
cast balance $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $RPC_URL
```
