use anchor_lang::prelude::*;
use switchboard_on_demand::{
    SlotHashes, Instructions, default_queue, SwitchboardQuoteExt, SwitchboardQuote
};

declare_id!("9kVBXoCrvZgKYWTJ74w3S8wAp7daEB7zpG7kwiXxkCVN");

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
    /// - quote_account: The canonical oracle account (derived from feed hashes)
    /// - queue: The Switchboard queue (auto-detected by network)
    /// - sysvars: Required system variables for verification
    pub fn read_oracle_data(ctx: Context<ReadOracleData>) -> Result<()> {
        // Access the oracle data directly
        // The quote_account constraint validates it's the canonical account
        let feeds = &ctx.accounts.quote_account.feeds;

        // Calculate staleness
        let current_slot = ctx.accounts.sysvars.clock.slot;
        let quote_slot = ctx.accounts.quote_account.slot;
        let staleness = current_slot.saturating_sub(quote_slot);

        msg!("Number of feeds: {}", feeds.len());
        msg!("📅 Quote slot: {}, Current slot: {}", quote_slot, current_slot);
        msg!("⏰ Staleness: {} slots", staleness);

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
/// The quote_account is the canonical account derived from feed hashes.
#[derive(Accounts)]
pub struct ReadOracleData<'info> {
    /// The canonical oracle account containing verified quote data
    ///
    /// This account is:
    /// - Updated by the quote program's verified_update instruction
    /// - Contains verified oracle data
    /// - Validated to be the canonical account for the contained feeds
    #[account(address = quote_account.canonical_key(&default_queue()))]
    pub quote_account: Box<Account<'info, SwitchboardQuote>>,

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
