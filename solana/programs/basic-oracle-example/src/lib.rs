use anchor_lang::prelude::*;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, SlotHashes, Instructions,
    get_slot
};

declare_id!("BASiCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
// Defines SwitchboardQuote anchor wrapper
switchboard_on_demand::switchboard_anchor_bindings!();

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
        let ReadOracleData { oracle_account, queue, sysvars, .. } = ctx.accounts;

        // Load and verify the oracle quote data
        let oracle_data = oracle_account.load()?;
        let quote = QuoteVerifier::new()
            .slothash_sysvar(&sysvars.slothashes)
            .ix_sysvar(&sysvars.instructions)
            .clock_slot(get_slot(&sysvars.clock))
            .queue(&queue)
            .max_age(30) // Allow quotes up to 30 slots old
            .verify_loaded(&oracle_data)?;

        msg!("🎉 Successfully read oracle data!");
        msg!("Quote slot: {}", quote.slot());

        // Process each feed in the quote
        for feed_info in quote.feeds() {
            msg!("📊 Feed: {}", feed_info.hex_id());
            msg!("💰 Value: {}", feed_info.value());

            // Your business logic here!
            // For example:
            // - Store the price in your program state
            // - Trigger events based on price changes
            // - Use the price for calculations
        }

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
    pub oracle_account: AccountLoader<'info, SwitchboardQuote>,

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