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
pnpm install
```

Current SDK install:

```bash
pnpm add @switchboard-xyz/common@^5.8.2 @switchboard-xyz/on-demand@^3.10.3
```

Verified local command:

```bash
./node_modules/.bin/tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --esModuleInterop scripts/x402Update.ts
```

Paid/live x402 calls were intentionally skipped during SDK verification.

## Usage

Run the X402 update script:

```bash
pnpm start
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

- `@x402/fetch` - X402-aware fetch wrapper
- `@x402/svm` - Solana micropayment support for X402
