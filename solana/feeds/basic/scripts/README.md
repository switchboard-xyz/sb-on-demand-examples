# Basic Oracle Integration Scripts

These scripts support the beginner-first Solana managed-update example. The main path is `managedUpdate.ts`, which updates one quote account and optionally calls the sample consumer program if you have built and deployed it.

## `managedUpdate.ts`

This is the basic “read one feed” flow:

1. Load your Solana environment and the default Switchboard queue for the network
2. Derive the canonical quote account for one feed ID
3. Build the managed update instructions
4. Optionally append the sample `read_oracle_data` instruction
5. Simulate, send, and confirm the transaction

Run the default BTC/USD example:

```bash
npm run update
```

Run the same flow with SOL/USD:

```bash
npm run update -- --feedId 822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9
```

Feed IDs should be passed as bare 64-character hex. If Explorer shows `0x...`, remove the prefix before using `--feedId`.

To find another feed:

1. Open [Switchboard Explorer](https://explorer.switchboardlabs.xyz/).
2. Search for the asset symbol you want, for example `SOL`.
3. Copy the feed ID for your network.
4. Pass that bare hex value to `npm run update -- --feedId ...`.

`feed.value()` in the sample program is human-readable. If you need fixed-point math, multiply by your chosen scale and convert explicitly in your own code.

In container or CI workflows, you can set `ANCHOR_PROVIDER_URL` and
`ANCHOR_WALLET` instead of depending on the Solana CLI config file.

For the local litesvm workflow, `npm run build:sbf` builds the example program
with `cargo-build-sbf`, and `npm run test` runs that build step automatically
before executing the tests.

If you want the refreshed local IDL for the optional consumer-program step,
run `npm run build`. That command reuses the same SBF build and then writes
`target/idl/basic_oracle_example.json` from the current program source.

## Sample consumer program

The basic consumer program intentionally reads `feeds[0]`. If a quote account contains more than one feed, it logs the total count and still uses the first feed so the beginner path stays easy to follow.

The only account inputs for the basic consumer are:

```rust
#[derive(Accounts)]
pub struct ReadOracleData<'info> {
    #[account(address = quote_account.canonical_key(&default_queue()))]
    pub quote_account: Box<Account<'info, SwitchboardQuote>>,
    pub sysvars: Sysvars<'info>,
}

#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock: Sysvar<'info, Clock>,
}
```

If you want full quote verification plumbing, custom account validation, or more advanced update policies, move to `solana/feeds/advanced`.

## Optional: `createManagedFeed.ts`

This helper creates a managed feed definition. It is not required for the basic “read an existing feed” tutorial path, so it is intentionally left out of the main quickstart flow.
