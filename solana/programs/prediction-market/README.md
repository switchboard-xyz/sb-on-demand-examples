# Prediction Market Oracle Program

A Solana program that integrates prediction market data from Switchboard oracles for on-chain position tracking and automated settlement.

## Overview

This program demonstrates how to build DeFi applications on top of prediction market oracles. It allows users to:

- Create positions tracking specific prediction market outcomes
- Automatically update positions with real-time oracle data
- Settle positions when probability thresholds are met
- Track win/loss outcomes based on market probabilities

## Features

### Position Types

1. **Above Threshold**: Position wins when probability exceeds target
2. **Below Threshold**: Position wins when probability falls below target
3. **Exact Match**: Position wins when probability matches target (±1% tolerance)

### Automatic Settlement

Positions can auto-settle when conditions are met during updates, or be manually settled by calling the settlement instruction.

### Rent Reclaim

Settled positions can be closed to reclaim rent, making the system capital-efficient.

## Program Instructions

### 1. Initialize Position

Creates a new position tracking a prediction market feed.

```rust
pub fn initialize_position(
    ctx: Context<InitializePosition>,
    feed_hash: [u8; 32],
    target_probability: u64,  // Basis points (0-10000)
    position_type: PositionType,
) -> Result<()>
```

**Parameters:**
- `feed_hash`: The Switchboard oracle feed hash (32 bytes)
- `target_probability`: Target probability in basis points (e.g., 5000 = 50%)
- `position_type`: AboveThreshold, BelowThreshold, or ExactMatch

**Accounts:**
- `position`: PDA derived from `[b"position", owner, feed_hash]`
- `owner`: Signer creating the position
- `system_program`: System program for account creation

### 2. Update Position

Updates the position with current oracle data.

```rust
pub fn update_position(ctx: Context<UpdatePosition>) -> Result<()>
```

**Accounts:**
- `position`: The position account to update
- `owner`: Position owner (must sign)
- `oracle_account`: Canonical Switchboard oracle account
- `sysvars`: Clock, SlotHashes, Instructions

**Behavior:**
- Reads current probability from oracle
- Updates position state
- Auto-settles if conditions are met

### 3. Settle Position

Manually settles a position based on current oracle data.

```rust
pub fn settle_position(ctx: Context<SettlePosition>) -> Result<()>
```

**Accounts:**
- Same as update_position

**Behavior:**
- Marks position as settled
- Records final probability
- Determines win/loss outcome

### 4. Close Position

Closes a settled position and reclaims rent.

```rust
pub fn close_position(ctx: Context<ClosePosition>) -> Result<()>
```

**Requirements:**
- Position must be settled first

## Account Structure

### PredictionPosition

```rust
pub struct PredictionPosition {
    pub owner: Pubkey,              // Position owner
    pub feed_hash: [u8; 32],        // Oracle feed hash
    pub target_probability: u64,    // Target in basis points
    pub current_probability: u64,   // Current oracle value
    pub position_type: PositionType,// Position type
    pub is_settled: bool,           // Settlement status
    pub settlement_value: u64,      // Final value
    pub last_update_slot: u64,      // Last update slot
    pub settlement_slot: Option<u64>, // Settlement slot
    pub bump: u8,                   // PDA bump
}
```

**Size:** 8 (discriminator) + 141 (data) = 149 bytes

### PositionType Enum

```rust
pub enum PositionType {
    AboveThreshold,  // Win if probability >= target
    BelowThreshold,  // Win if probability <= target
    ExactMatch,      // Win if |probability - target| < 1%
}
```

## Oracle Integration

### Feed Hash Derivation

Oracle feeds are stored on IPFS and referenced by their hash:

```typescript
const { feedId } = await crossbar.storeOracleFeed(oracleFeed);
const feedHash = feedId.slice(2); // Remove "0x" prefix
```

### Canonical Oracle Account

The program validates that the oracle account is canonical:

```rust
#[account(address = oracle_account.canonical_key(&default_queue()))]
pub oracle_account: InterfaceAccount<'info, SwitchboardQuote>
```

This ensures:
- Oracle data is from the correct feed
- No fake oracle accounts can be used
- Automatic account derivation works

### Probability Calculation

Oracle values use i128 with 18 decimals:

```rust
fn calculate_probability_bps(value: i128) -> Result<u64> {
    const DIVISOR: i128 = 10^18;
    let probability = value / DIVISOR;  // 0.0 to 1.0
    let bps = (probability * 10000) as u64;  // Convert to basis points
    Ok(bps.min(10000))  // Cap at 100%
}
```

## Build & Deploy

### Build the Program

```bash
anchor build
```

### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

### Update Program ID

After deployment, update the program ID in:
1. `src/lib.rs` - `declare_id!("YOUR_PROGRAM_ID")`
2. `Anchor.toml` - `[programs.devnet]` section

Rebuild after updating:
```bash
anchor build
```

## Usage Examples

### TypeScript Client

See `scripts/prediction-market-examples/usePredictionMarketProgram.ts` for a complete example.

### Basic Flow

```typescript
// 1. Create oracle feed
const oracleFeed = {
  name: "Polymarket Probability",
  jobs: [{ tasks: [httpTask, jsonParseTask] }]
};

// 2. Store on IPFS
const { feedId } = await crossbar.storeOracleFeed(oracleFeed);
const feedHash = Buffer.from(feedId.slice(2), "hex");

// 3. Initialize position
await program.methods
  .initializePosition(
    Array.from(feedHash),
    5000,  // 50% target
    { aboveThreshold: {} }
  )
  .accounts({ ... })
  .rpc();

// 4. Update with oracle data
const oracleUpdateIxs = await queue.fetchManagedUpdateIxs(...);
const updatePositionIx = await program.methods
  .updatePosition()
  .accounts({ ... })
  .instruction();

await sendTransaction([...oracleUpdateIxs, updatePositionIx]);

// 5. Check settlement
const position = await program.account.predictionPosition.fetch(positionPda);
console.log("Settled:", position.isSettled);
```

## Use Cases

### 1. Conditional Payments

Automatically release funds when prediction markets reach certain probabilities.

```rust
if position.is_settled && position_won {
    // Transfer funds to winner
}
```

### 2. Automated Market Maker

Use prediction probabilities to price synthetic assets or options.

### 3. Risk Management

Track portfolio risk based on real-time prediction market data.

### 4. Betting & Gaming

Create on-chain betting markets with oracle-verified outcomes.

### 5. DAO Governance

Use prediction markets to inform governance decisions.

## Security Considerations

### Oracle Validation

✅ **Good**: Program validates canonical oracle accounts
```rust
#[account(address = oracle_account.canonical_key(&default_queue()))]
```

❌ **Bad**: Accepting any account as oracle
```rust
pub oracle_account: AccountInfo<'info>  // Don't do this!
```

### Owner Checks

All instructions verify the position owner:
```rust
#[account(has_one = owner)]
pub position: Account<'info, PredictionPosition>
```

### Settlement Protection

Positions can't be settled twice:
```rust
require!(!position.is_settled, ErrorCode::AlreadySettled);
```

### Probability Validation

Probabilities are capped at 100%:
```rust
Ok(bps.min(10000))  // Max 10000 basis points
```

## Testing

### Unit Tests

```bash
anchor test
```

### Integration Tests

```bash
ts-node scripts/prediction-market-examples/usePredictionMarketProgram.ts \
  --eventId "test-123" \
  --targetProbability 5000 \
  --positionType above
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | NoOracleFeeds | No oracle feeds available in account |
| 6001 | AlreadySettled | Position has already been settled |
| 6002 | NotSettled | Position must be settled before closing |
| 6003 | InvalidProbability | Probability value is invalid |

## License

MIT

## Resources

- [Switchboard Docs](https://docs.switchboard.xyz)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
