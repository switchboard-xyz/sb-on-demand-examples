use anchor_lang::prelude::*;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, SlotHashes, Instructions, default_queue
};
switchboard_on_demand::switchboard_anchor_bindings!();

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
        // Access the oracle data directly
        // The oracle_account constraint validates it's the canonical account
        let feeds = ctx.accounts.oracle_account.feeds();

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
    /// - Updated by the quote program's verified_update instruction
    /// - Contains verified oracle data
    /// - Validated to be the canonical account for the contained feeds
    #[account(address = oracle_account.canonical_key(&default_queue()))]
    pub oracle_account: InterfaceAccount<'info, SwitchboardQuote>,

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
