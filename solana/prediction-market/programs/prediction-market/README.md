# Kalshi Feed Verification Program

A Solana program demonstrating how to verify Switchboard oracle feed configurations on-chain using Kalshi prediction market data.

## Overview

This program shows how to verify that an oracle feed matches an expected configuration before trusting its data. This is critical for security because feed IDs are deterministic - they're derived by hashing the feed's protobuf definition. By verifying the feed ID on-chain, you ensure the oracle is using exactly the data sources and transformations you expect.

## Key Concept: Feed ID Verification

**The Problem:** A malicious actor could create a different oracle feed with similar-looking data but from untrusted sources.

**The Solution:** Feed IDs are SHA-256 hashes of the feed's protobuf definition. By recreating the feed proto on-chain and comparing its hash to the oracle's feed ID, you cryptographically verify the feed configuration.

```
Feed Definition → Protobuf Encoding → SHA-256 Hash → Feed ID
```

This ensures:
- The oracle uses the exact API endpoint you expect
- No substitution of data sources
- The JSON parsing path is correct
- All task configurations match your expectations

## Program Instruction

### verify_kalshi_feed

Verifies that an oracle feed matches the expected Kalshi order configuration.

```rust
pub fn verify_kalshi_feed(
    ctx: Context<VerifyFeed>,
    order_id: String,
) -> Result<()>
```

**Parameters:**
- `order_id`: The Kalshi order ID to verify (e.g., "12345678-1234-1234-1234-123456789012")

**Accounts:**
- `queue`: The Switchboard queue account (validates against default queue)
- `slothashes`: Solana SlotHashes sysvar for signature verification
- `instructions`: Solana Instructions sysvar for Ed25519 verification

**Behavior:**
1. Verifies the Ed25519 instruction at index 0 (oracle signature)
2. Extracts the feed ID from the verified oracle quote
3. Recreates the expected feed proto for the given order ID
4. Hashes the recreated proto to derive the expected feed ID
5. Compares actual vs expected feed IDs
6. Logs verification results

**Error Conditions:**
- `NoOracleFeeds`: No feeds found in oracle quote
- `FeedMismatch`: Feed ID doesn't match expected configuration
- `VerificationFailed`: Ed25519 signature verification failed

## How It Works

### 1. Feed Proto Recreation

The program recreates the exact feed definition on-chain:

```rust
let feed = OracleFeed {
    name: Some("Kalshi Order Price".to_string()),
    jobs: vec![
        OracleJob {
            tasks: vec![
                Task {
                    task: Some(task::Task::KalshiApiTask(KalshiApiTask {
                        url: Some(format!(
                            "https://api.elections.kalshi.com/trade-api/v2/portfolio/orders/{}",
                            order_id
                        )),
                        api_key_id: Some("${KALSHI_API_KEY_ID}".to_string()),
                        signature: Some("${KALSHI_SIGNATURE}".to_string()),
                        timestamp: Some("${KALSHI_TIMESTAMP}".to_string()),
                        ..Default::default()
                    })),
                },
                Task {
                    task: Some(task::Task::JsonParseTask(JsonParseTask {
                        path: Some("$.order.yes_price_dollars".to_string()),
                        ..Default::default()
                    })),
                },
            ],
            weight: None,
        }
    ],
    min_job_responses: Some(1),
    min_oracle_samples: Some(1),
    max_job_range_pct: Some(0),
};
```

### 2. Feed ID Derivation

```rust
// Encode as protobuf length-delimited bytes
let bytes = OracleFeed::encode_length_delimited_to_vec(&feed);

// Hash to get feed ID
let feed_id = hash(&bytes).to_bytes();
```

### 3. Verification

```rust
// Extract feed ID from oracle quote
let actual_feed_id = feeds[0].feed_id();

// Compare with expected
require!(
    *actual_feed_id == create_kalshi_feed_id(&order_id)?,
    ErrorCode::FeedMismatch
);
```

## Account Structure

### VerifyFeed Context

```rust
#[derive(Accounts)]
pub struct VerifyFeed<'info> {
    #[account(address = default_queue())]
    pub queue: AccountLoader<'info, QueueAccountData>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}
```

**Security Features:**
- Queue account must match the default Switchboard queue
- SlotHashes sysvar ensures recent signatures
- Instructions sysvar provides Ed25519 verification data

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
1. `src/lib.rs:13` - `declare_id!("YOUR_PROGRAM_ID")`
2. `Anchor.toml` - `[programs.devnet]` section

Rebuild after updating:
```bash
anchor build
```

## Usage Example

### Prerequisites

1. Kalshi API credentials (API key ID and private key)
2. Kalshi order ID to verify

### Running the Example

```bash
bun run scripts/prediction-market-examples/testKalshiFeedVerification.ts \
  --api-key-id YOUR_KALSHI_API_KEY_ID \
  --private-key-path /path/to/kalshi/private-key.pem \
  --order-id KALSHI_ORDER_ID
```

**Example:**
```bash
bun run scripts/prediction-market-examples/testKalshiFeedVerification.ts \
  --api-key-id abc123def456 \
  --private-key-path ~/.kalshi/private-key.pem \
  --order-id 12345678-1234-1234-1234-123456789012
```

### Script Workflow

The example script demonstrates the complete verification flow:

1. **Load Kalshi credentials** from file system
2. **Create Kalshi API signature** using RSA-PSS-SHA256
3. **Define oracle feed** with KalshiApiTask and JsonParseTask
4. **Simulate feed** with Crossbar to verify it works
5. **Fetch oracle quote** with variable overrides for credentials
6. **Create verification instruction** calling `verify_kalshi_feed`
7. **Simulate transaction** to verify feed ID matches on-chain

See `scripts/prediction-market-examples/testKalshiFeedVerification.ts` for the complete implementation.

## Security Considerations

### ✅ Feed ID Verification

**Good:** Verify feed configuration on-chain
```rust
let actual_feed_id = feeds[0].feed_id();
require!(
    *actual_feed_id == create_kalshi_feed_id(&order_id)?,
    ErrorCode::FeedMismatch
);
```

**Why:** Prevents oracle feed substitution attacks

### ✅ Queue Validation

**Good:** Validate against the default Switchboard queue
```rust
#[account(address = default_queue())]
pub queue: AccountLoader<'info, QueueAccountData>,
```

**Why:** Ensures oracle data comes from trusted Switchboard infrastructure

### ✅ Ed25519 Verification

**Good:** Verify oracle signatures using QuoteVerifier
```rust
let mut verifier = QuoteVerifier::new();
verifier
    .queue(ctx.accounts.queue.as_ref())
    .slothash_sysvar(ctx.accounts.slothashes.as_ref())
    .ix_sysvar(ctx.accounts.instructions.as_ref())
    .clock_slot(Clock::get()?.slot);

let quote = verifier.verify_instruction_at(0)?;
```

**Why:** Cryptographically proves oracle data is signed by trusted guardians

### ❌ Don't Skip Verification

**Bad:** Trusting oracle data without feed verification
```rust
// Don't do this!
let value = oracle_account.value;
// Use value without verifying feed configuration
```

**Why:** Attacker could provide data from untrusted sources

## Use Cases

### 1. Prediction Market Integration

Verify that prediction market data comes from the correct API endpoint and uses proper JSON parsing before settling positions or releasing funds.

### 2. Conditional Payments

Ensure oracle data matches expected sources before executing automated payments based on market outcomes.

### 3. DeFi Protocol Integration

Verify oracle feed configurations before using price data for liquidations, collateral calculations, or other critical operations.

### 4. Compliance & Auditing

Prove on-chain that specific data sources were used for regulatory compliance or audit trails.

### 5. Multi-Source Oracle Validation

Extend this pattern to verify multiple oracle feeds and ensure data aggregation uses only approved sources.

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | NoOracleFeeds | No oracle feeds available in the quote |
| 6001 | FeedMismatch | Feed ID doesn't match expected configuration |
| 6002 | InvalidFeedJson | Failed to construct or parse feed JSON |
| 6003 | VerifierError | Failed to create QuoteVerifier instance |
| 6004 | VerificationFailed | Ed25519 signature verification failed |

## Dependencies

```toml
[dependencies]
anchor-lang = "0.31.1"
switchboard-on-demand = { version = "0.9.2", features = ["anchor", "devnet"] }
switchboard-protos = { version = "^0.2.1", features = ["serde"] }
prost = "0.13"
solana-program = "3.0.0"
faster-hex = "0.10.0"
```

## Testing

### Integration Test

```bash
bun run scripts/prediction-market-examples/testKalshiFeedVerification.ts \
  --api-key-id test-key \
  --private-key-path ./test-key.pem \
  --order-id test-order-id
```

The script will:
1. Create and simulate the oracle feed
2. Fetch a quote from Switchboard
3. Verify the feed ID matches on-chain
4. Display verification results and logs

## Extending This Pattern

This verification pattern can be adapted for other oracle feed types:

### Generic HTTP API
```rust
HttpTask {
    url: Some("https://api.example.com/data".to_string()),
    method: Some(Method::Get as i32),
    headers: vec![/* ... */],
}
```

### Polymarket Integration
```rust
HttpTask {
    url: Some(format!("https://clob.polymarket.com/event/{}", event_id)),
    method: Some(Method::Get as i32),
}
```

### Price Feeds
```rust
HttpTask {
    url: Some("https://api.coingecko.com/price".to_string()),
}
```

The key principle remains: recreate the feed proto on-chain, hash it, and compare against the oracle's feed ID.

## License

MIT

## Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Kalshi API Documentation](https://trading-api.readme.io/reference/getting-started)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Protocol Buffers](https://protobuf.dev/)
