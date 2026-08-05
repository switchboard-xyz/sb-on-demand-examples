# Solana Feeds - Basic Example

Beginner-first Switchboard price feed example for Solana. This directory shows the simplest managed-update flow for reading one feed in an Anchor program.

## What this example covers

- Update one Switchboard feed by ID
- Write the fresh quote into the canonical quote account
- Optionally call the sample consumer program that reads `feeds[0]`
- Log `feed.value()` as a human-readable decimal

If you want stricter verification logic or more account plumbing, use the advanced Solana feed example instead. This basic example stays focused on the first-time “fetch one price” path.

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- Node.js 18+

## Install

```bash
npm install
```

## Quickstart

Point your Solana CLI at devnet and make sure your wallet has devnet SOL:

```bash
solana config set --url devnet
solana airdrop 2
```

If you are running inside CI or a container, you can set `ANCHOR_PROVIDER_URL`
and `ANCHOR_WALLET` instead of relying on the Solana CLI config file.

Run the default BTC/USD example:

```bash
npm run update
```

Run the same flow with SOL/USD instead:

```bash
npm run update -- --feedId 822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9
```

Feed IDs for this example should be passed as bare 64-character hex. If Explorer shows a `0x` prefix, remove it before passing `--feedId`.

To find another feed:

1. Open [Switchboard Explorer](https://explorer.switchboardlabs.xyz/).
2. Search for the asset you want, for example `SOL`.
3. Copy the feed ID for the network you are using.
4. Pass the bare hex value to `npm run update -- --feedId ...`.

`feed.value()` is already human-readable. If your protocol stores prices as fixed-point integers, scale and convert that decimal explicitly in your own program logic.

## Optional: build and deploy the sample consumer program

`npm run update` always updates the canonical quote account. If you also want the transaction to invoke the sample on-chain consumer instruction, build and deploy the program first:

```bash
npm run build
solana program deploy --program-id target/deploy/basic_oracle_example-keypair.json target/deploy/basic_oracle_example.so
```

After deployment, run `npm run update` again. The same command will append the sample `read_oracle_data` instruction and you will see the consumer logs in the simulated output.

## Test

```bash
npm run test
```

`npm run test` builds the SBF artifact first, then runs the litesvm tests against the local program so the test command matches the documented workflow.

If you only need the local `.so` artifact for litesvm or local deployment prep, run:

```bash
npm run build:sbf
```

If you also want the refreshed local IDL used by `managedUpdate.ts` for the
optional consumer step, run:

```bash
npm run build
```

## Project structure

```text
basic/
├── programs/
│   └── basic-oracle-example/   # Sample Anchor consumer program
├── scripts/
│   ├── managedUpdate.ts        # Managed update quickstart
│   ├── run-cargo-build-sbf.sh  # Container-friendly SBF build helper
│   └── createManagedFeed.ts    # Optional custom feed creation helper
├── Anchor.toml
├── Cargo.toml
└── package.json
```
