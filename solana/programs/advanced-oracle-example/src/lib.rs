use anchor_lang::prelude::*;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, get_slot, SlotHashes, Instructions
};

declare_id!("FNnhcuzFqg8CSVHRauPh8rFaqSrJzsQ8wL66GFL8VJZQ");
// Defines SwitchboardQuote anchor wrapper
switchboard_on_demand::switchboard_anchor_bindings!();

/// Advanced Oracle Example Program
///
/// This program demonstrates parsing and displaying oracle feed data.
/// It shows how to iterate through multiple feeds and extract their
/// IDs and values for processing.
#[program]
pub mod advanced_oracle_example {
    use super::*;

    /// Parse oracle data and print feed IDs and values
    ///
    /// This instruction demonstrates how to:
    /// - Verify oracle data from the quote program
    /// - Parse multiple feeds from a single oracle account
    /// - Extract feed IDs and values for business logic
    /// - Log structured data for monitoring and debugging
    pub fn parse_oracle_data(ctx: Context<ParseOracleData>) -> Result<()> {
        let ParseOracleData { oracle_account, queue, sysvars, .. } = ctx.accounts;

        // Verify the oracle quote data
        let quote = QuoteVerifier::new()
            .slothash_sysvar(&sysvars.slothashes)
            .ix_sysvar(&sysvars.instructions)
            .clock_slot(get_slot(&sysvars.clock))
            .queue(&queue)
            .max_age(30) // Allow quotes up to 30 slots old
            .verify_account(&oracle_account)?;

        msg!("🎉 Successfully verified oracle data!");
        msg!("Quote slot: {}", quote.slot());
        msg!("Number of feeds: {}", quote.feeds().len());

        // Demonstrate the new canonical_key method
        let canonical_key = quote.canonical_key(&oracle_account.owner);

        // Parse and display each feed
        for (index, feed_info) in quote.feeds().iter().enumerate() {
            msg!("📋 Feed #{}: {}", index + 1, feed_info.hex_id());
            msg!("💰 Value: {}", feed_info.value());
            msg!("---");
        }

        msg!("✅ Parsing complete!");
        Ok(())
    }
}

/// Parse oracle data context
#[derive(Accounts)]
pub struct ParseOracleData<'info> {
    /// Canonical oracle account containing verified quote data
    /// - Created and owned by the quote program (orac1eyNhmmA877ttBwvCD6jgQ5Cd71FJU6JJfGjAvR)
    /// - Derived from feed hashes using PullFeed.getCanonicalPubkey()
    /// - Updated by the quote program's verified_update instruction
    /// - Contains verified, up-to-date oracle data
    /// - Validated to be the canonical account for the contained feeds
    #[account(
        constraint = oracle_account.canonical_key(&oracle_account.owner) == oracle_account.key() @ ErrorCode::InvalidOracleAccount
    )]
    pub oracle_account: InterfaceAccount<'info, SwitchboardQuote>,

    /// The Switchboard queue (automatically selected based on network)
    #[account(address = switchboard_on_demand::default_queue())]
    pub queue: AccountLoader<'info, QueueAccountData>,

    /// System variables required for oracle verification
    pub sysvars: Sysvars<'info>,
}

/// System variables required for oracle verification
#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock: Sysvar<'info, Clock>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}


/// Custom error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid oracle account - not the canonical account for the contained feeds")]
    InvalidOracleAccount,
}
