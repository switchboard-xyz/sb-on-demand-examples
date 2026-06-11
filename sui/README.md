# Sui Examples

Switchboard on-demand oracle examples for the Sui blockchain.

## Examples

| Example | Description |
|---------|-------------|
| [feeds/basic](./feeds/basic) | Price feed integration using Quote Verifier pattern with Move smart contracts |
| [surge/basic](./surge/basic) | Real-time price streaming via Surge WebSocket |

## Quick Start

Each example is self-contained. Navigate to the example folder and follow its README:

```bash
# Price feeds example
cd feeds/basic
npm install
npm run example

# Surge streaming example
cd surge/basic
npm install
npm run stream
```

## Latest SDK Verification

Current Sui TypeScript examples use:

```bash
npm install @switchboard-xyz/on-demand@^3.10.3 @switchboard-xyz/sui-sdk@^0.1.16
```

Verified local gate:
- `sui/surge/basic`: TypeScript compile/import check only; live stream and transactions skipped

`sui/feeds/basic` could not complete `npm run build:testnet` or `npm test` in the verification container because the `sui` CLI is not installed there. Do not treat that Move example as latest-SDK verified until `sui move build` and `sui move test` pass in a Sui CLI environment.

## Prerequisites

- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) installed and configured
- Node.js 18+
- A funded Sui wallet

## Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Sui Documentation](https://docs.sui.io)
