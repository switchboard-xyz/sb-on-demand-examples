use anchor_lang::prelude::*;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, get_slot, SlotHashes, Instructions
};
use switchboard_on_demand::quote_account::SwitchboardQuote;
use switchboard_on_demand::SwitchboardQuoteExt;

declare_id!("C4KQQeJVJ1X4uP2XeRGJT77s6A9ooas8rZiW1XB2C2r8");

/// Basic Oracle Example Program
///
/// This program demonstrates the simplest possible integration with
/// Switchboard's managed update system. Perfect for learning and
/// simple applications.
#[program]
pub mod basic_oracle_example {
    use super::*;

    /// Read and verify oracle data from the managed oracle account
    ///
    /// This is the simplest way to consume Switchboard oracle data.
    /// The oracle account is derived canonically from feed hashes and
    /// updated by the quote program's verified_update instruction.
    ///
    /// ## Usage
    /// 1. Call fetchManagedUpdateIxs to update the oracle account
    /// 2. Call this instruction to read the verified data
    ///
    /// ## Parameters
    /// - oracle_account: The canonical oracle account (derived from feed hashes)
    /// - queue: The Switchboard queue (auto-detected by network)
    /// - sysvars: Required system variables for verification
    pub fn read_oracle_data(ctx: Context<ReadOracleData>) -> Result<()> {
        msg!("🎉 Successfully accessed oracle account!");
        msg!("Oracle account key: {}", ctx.accounts.oracle_account.key());

        // Access the oracle data directly
        // The oracle_account constraint validates it's the canonical account
        let oracle_account = &ctx.accounts.oracle_account;

        // Extract feeds using the SwitchboardQuoteExt trait
        let feeds = oracle_account.feeds();

        msg!("Number of feeds: {}", feeds.len());

        // Process each feed
        for (i, feed) in feeds.iter().enumerate() {
            msg!("📊 Feed {}: ID = {}", i, feed.hex_id());
            msg!("💰 Feed {}: Value = {}", i, feed.value());

            // Your business logic here!
            // For example:
            // - Store the price in your program state
            // - Trigger events based on price changes
            // - Use the price for calculations
        }

        msg!("✅ Successfully read {} oracle feeds!", feeds.len());
        Ok(())
    }
}

/// Account context for reading oracle data
///
/// This is designed to be as simple as possible while still being secure.
/// The oracle_account is the canonical account derived from feed hashes.
#[derive(Accounts)]
pub struct ReadOracleData<'info> {
    /// The canonical oracle account containing verified quote data
    ///
    /// This account is:
    /// - Derived using PullFeed.getCanonicalPubkey(feedHashes) in TypeScript
    /// - Updated by the quote program's verified_update instruction
    /// - Contains verified, up-to-date oracle data
    /// - Validated to be the canonical account for the contained feeds
    #[account(
        constraint = oracle_account.canonical_key() == oracle_account.key() @ ErrorCode::InvalidOracleAccount
    )]
    pub oracle_account: InterfaceAccount<'info, SwitchboardQuote>,

    /// The Switchboard queue (automatically selected based on network)
    #[account(address = switchboard_on_demand::default_queue())]
    pub queue: AccountLoader<'info, QueueAccountData>,

    /// System variables required for quote verification
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
