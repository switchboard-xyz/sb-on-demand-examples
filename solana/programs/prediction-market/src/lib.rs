use anchor_lang::prelude::*;
use switchboard_on_demand::{SlotHashes, Instructions, QuoteVerifier};
use switchboard_protos::OracleFeed;
use switchboard_protos::OracleJob;
use switchboard_protos::oracle_job::oracle_job::{KalshiApiTask, JsonParseTask, Task};
use switchboard_protos::oracle_job::oracle_job::task;
use prost::Message;
use solana_program::hash::hash;
use serde_json::json;

declare_id!("5VjqP71zWPGc169ogvSphDG4tS2zdJ3qoiB6XTghmH1r");

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
            .slothash_sysvar(ctx.accounts.slothashes.as_ref())
            .ix_sysvar(ctx.accounts.instructions.as_ref())
            .clock_slot(Clock::get()?.slot);

        // Verify the Ed25519 instruction at index 0
        msg!("🔍 Extracting the quote from Ed25519 instruction at index 0...");
        let quote = verifier.verify_instruction_at(0).unwrap();

        let feeds = quote.feeds();
        require!(!feeds.is_empty(), ErrorCode::NoOracleFeeds);

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

    let feed = OracleFeed {
        name: Some("Kalshi Order Price".to_string()),
        jobs: vec![
            OracleJob {
                tasks: vec![
                    Task {
                        task: Some(task::Task::KalshiApiTask(KalshiApiTask {
                            url: Some(url.clone()),
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

    // Encode as protobuf length-delimited bytes using prost::Message trait
    let bytes = OracleFeed::encode_length_delimited_to_vec(&feed);

    // Hash the protobuf bytes
    Ok(hash(&bytes).to_bytes())
}


#[derive(Accounts)]
pub struct VerifyFeed<'info> {
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
