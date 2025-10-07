use anchor_lang::prelude::*;
use switchboard_on_demand::{SlotHashes, Instructions, QuoteVerifier};
use switchboard_protos::OracleFeed;
use serde_json::json;
use sha2::{Sha256, Digest};
switchboard_on_demand::switchboard_anchor_bindings!();

declare_id!("PREDwvCuCKFQ5SUe7kNZaUMJ6aEVMgJKMsjL1Y7iDFC");

/// Prediction Market Feed Verification Program
///
/// Demonstrates how to:
/// 1. Extract feed ID from oracle data
/// 2. Recreate the oracle feed proto on-chain
/// 3. Serialize and hash it
/// 4. Verify the feed ID matches expected configuration
#[program]
pub mod prediction_market {
    use super::*;

    /// Verify that an oracle feed matches the expected Kalshi order configuration
    ///
    /// This instruction verifies the Ed25519 instruction at index 0 and extracts
    /// the feed ID, then recreates the feed proto to verify it matches.
    pub fn verify_kalshi_feed(
        ctx: Context<VerifyFeed>,
        order_id: String,
    ) -> Result<()> {
        // Create the quote verifier from sysvars using builder pattern
        let mut verifier = QuoteVerifier::new();
        verifier
            .slothash_sysvar(ctx.accounts.sysvars.slothashes.as_ref())
            .ix_sysvar(ctx.accounts.sysvars.instructions.as_ref())
            .clock_slot(Clock::get()?.slot);

        // Verify the Ed25519 instruction at index 0
        msg!("🔍 Extracting the quote from Ed25519 instruction at index 0...");
        let quote = verifier.verify_instruction_at(0).unwrap();

        let feeds = quote.feeds();
        require!(feeds.len() > 0, ErrorCode::NoOracleFeeds);

        let feed = &feeds[0];
        let actual_feed_id = feed.feed_id();

        // Verify they match
        require!(
            *actual_feed_id == create_kalshi_feed_id(&order_id)?,
            ErrorCode::FeedMismatch
        );

        msg!("✅ Feed ID verification successful!");

        Ok(())
    }

}

/// Create Kalshi feed hash from order ID
///
/// This recreates the feed proto structure using the json! macro
/// and hashes it to derive the feed ID
fn create_kalshi_feed_id(order_id: &str) -> Result<[u8; 32]> {
    // Build the Kalshi API URL
    let url = format!(
        "https://api.elections.kalshi.com/trade-api/v2/portfolio/orders/{}",
        order_id
    );

    // Create the feed using json! macro - matches the TypeScript side exactly
    let oracle_feed = json!({
        "name": "Kalshi Order Price",
        "jobs": [{
            "tasks": [
                {
                    "kalshiApiTask": {
                        "url": url,
                        "apiKeyId": "${KALSHI_API_KEY_ID}}",
                        "signature": "${KALSHI_SIGNATURE}",
                        "timestamp": "${KALSHI_TIMESTAMP}"
                    }
                },
                {
                    "jsonParseTask": {
                        "path": "$.order.yes_price_dollars"
                    }
                }
            ]
        }]
    });
    // Convert to canonical JSON string
    let feed: OracleFeed = serde_json::from_value(oracle_feed).unwrap();

    // Hash the JSON string directly (simpler and fits in BPF)
    let hash = Sha256::digest(feed.encode_length_delimited_to_vec.as_slice());
    Ok(hash.into())
}

/// Simple hex encoding for logging
fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

#[derive(Accounts)]
pub struct VerifyFeed<'info> {
    pub sysvars: Sysvars<'info>,
}


#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock: Sysvar<'info, Clock>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("No oracle feeds available")]
    NoOracleFeeds,

    #[msg("Feed hash mismatch - oracle feed does not match expected configuration")]
    FeedMismatch,

    #[msg("Invalid feed JSON")]
    InvalidFeedJson,

    #[msg("Failed to create quote verifier")]
    VerifierError,

    #[msg("Failed to verify Ed25519 instruction")]
    VerificationFailed,
}
