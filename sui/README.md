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

## Prerequisites

- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) installed and configured
- Node.js 18+
- A funded Sui wallet

## Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Sui Documentation](https://docs.sui.io)
