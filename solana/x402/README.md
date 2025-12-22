# Solana X402 Paywalled Data Example

Switchboard integration with the X402 micropayment protocol for paywalled data sources.

## Overview

This example demonstrates how to use Switchboard with the X402 micropayment protocol to access paywalled data sources. X402 enables pay-per-request access to premium data feeds using Solana micropayments.

## Prerequisites

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- Node.js 18+
- A funded Solana wallet for micropayments

## Setup

```bash
npm install
```

## Usage

Run the X402 update script:

```bash
npm run start
```

## Project Structure

```
x402/
├── scripts/
│   └── x402Update.ts   # X402 integration script
└── package.json
```

## Dependencies

This example uses the following X402-specific packages:

- `@faremeter/payment-solana` - X402 payment handling
- `@faremeter/wallet-solana` - Wallet integration
- `@switchboard-xyz/x402-utils` - Switchboard X402 utilities
