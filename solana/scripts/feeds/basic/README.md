# Basic Oracle Integration Examples

This directory contains simple, easy-to-understand examples for getting started with Switchboard On-Demand oracle integration using the new managed update system.

## Examples

### `managedUpdate.ts` - Complete Managed Update Flow
A more detailed example demonstrating:
- Canonical oracle account derivation
- Managed update instruction creation
- Custom program instructions for reading oracle data
- Complete transaction flow with error handling

**Perfect for**: Understanding the full flow, implementing in production apps

```bash
npm run feeds:managed --feedId=0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
```

## Key Concepts

### Managed Updates
The new managed update system uses the quote program to:
- **Auto-detect network**: Automatically detects mainnet/devnet and selects appropriate queue
- **Automatically handle oracle account creation**: No manual account management needed
- **Verify Ed25519 signatures**: Verifies signatures from oracle operators
- **Store verified quote data**: Stores data in canonical accounts
- **Provide deterministic account derivation**: Same inputs always produce same accounts

### Canonical Oracle Accounts
Oracle accounts are derived deterministically from feed hashes:
```typescript
const [oracleAccount] = OracleQuote.getCanonicalPubkey(queue.pubkey, [feedId]);
```

This ensures:
- Same feed IDs always produce the same oracle account
- No manual account management needed
- Automatic account creation if needed

### Network Auto-Detection
The system automatically detects your network and selects the appropriate queue:
```typescript
import { isMainnetConnection } from "@switchboard-xyz/on-demand";

// Auto-detect network and load appropriate queue
const queue = await sb.Queue.loadDefault(program);
const gateway = await queue.fetchGatewayFromCrossbar(crossbar);

// Properly detect network using the official method
const isMainnet = await isMainnetConnection(connection);
console.log("Network detected:", isMainnet ? 'mainnet' : 'devnet');
console.log("Queue selected:", queue.pubkey.toBase58());
```

### Two-Instruction Pattern
Managed updates use two instructions:
1. **Ed25519 Instruction**: Verifies oracle signatures
2. **Quote Program Instruction**: Stores verified data in oracle account

Your program then reads from the oracle account:
3. **Your Program Instruction**: Consumes the verified oracle data

## Program Integration

Your Anchor program should:

1. **Accept the oracle account** in your instruction accounts
2. **Verify the oracle data** using Switchboard's verification functions
3. **Extract feed values** for your business logic

Example program instruction:
```rust
use switchboard_on_demand::{
    QuoteVerifier, SwitchboardQuote, default_queue, get_slot
};

#[derive(Accounts)]
pub struct UseOracleData<'info> {
    // The managed oracle account containing verified quote data
    // Validates it's the canonical account for the contained feeds
    #[account(address = quote_account.canonical_key(&default_queue()))]
    pub quote_account: InterfaceAccount<'info, SwitchboardQuote>,

    /// CHECK: Switchboard queue - validated in QuoteVerifier
    pub queue: AccountInfo<'info>,

    // Your program's accounts
    #[account(mut)]
    pub your_state: Account<'info, YourState>,

    // Required sysvars for verification
    pub clock: Sysvar<'info, Clock>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}

pub fn use_oracle_data(ctx: Context<UseOracleData>) -> Result<()> {
    // Verify the oracle data is recent and valid
    let quote = QuoteVerifier::new()
        .queue(&ctx.accounts.queue)
        .slothash_sysvar(&ctx.accounts.slothashes)
        .ix_sysvar(&ctx.accounts.instructions)
        .clock_slot(get_slot(&ctx.accounts.clock))
        .max_age(20) // 20 slots max age
        .verify_account(&ctx.accounts.quote_account)?;

    // Extract feed values
    for feed in quote.feeds() {
        msg!("Feed: {}, Value: {}", feed.hex_id(), feed.value());
        // Use the feed value in your business logic
    }

    Ok(())
}
```

## Getting Started

1. **Run the example**: Start with `managedUpdate.ts` for learning
2. **Set your feed ID**: Use a real Switchboard feed hash
3. **See the integration**: Watch the oracle integration in action
4. **Modify for your needs**: Adapt the pattern to your program

## Finding Feed IDs

Find feed IDs in the [Switchboard Explorer](https://ondemand.switchboard.xyz/)
