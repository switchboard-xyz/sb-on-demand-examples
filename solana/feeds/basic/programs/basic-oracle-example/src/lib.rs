use anchor_lang::prelude::*;
use switchboard_on_demand::{default_queue, SwitchboardQuoteExt, SwitchboardQuote};

declare_id!("HWZNh846V4VVdp5mkeYaeYQjGo47F1Uax38ViYY1VvrK");

/// Basic Oracle Example Program
///
/// This program demonstrates the simplest possible integration with
/// Switchboard's managed update system. Perfect for learning and
/// simple applications.
#[program]
pub mod basic_oracle_example {
    use super::*;

    /// Read the first verified feed from the managed quote account.
    ///
    /// This basic example is intentionally single-feed oriented: update one
    /// feed with `fetchManagedUpdateIxs`, then read `feeds[0]` in your program.
    pub fn read_oracle_data(ctx: Context<ReadOracleData>) -> Result<()> {
        let feeds = &ctx.accounts.quote_account.feeds;
        require!(!feeds.is_empty(), BasicOracleError::MissingFeed);
        let feed = &feeds[0];

        let current_slot = ctx.accounts.sysvars.clock.slot;
        let quote_slot = ctx.accounts.quote_account.slot;
        let staleness = current_slot.saturating_sub(quote_slot);

        msg!("Feed count: {}", feeds.len());
        if feeds.len() > 1 {
            msg!("Using feed[0] in this basic example");
        }

        msg!("Quote slot: {}, Current slot: {}", quote_slot, current_slot);
        msg!("Staleness: {} slots", staleness);
        let feed_id = feed.hex_id();
        let feed_id = feed_id.strip_prefix("0x").unwrap_or(feed_id.as_str());
        msg!("Feed ID: {}", feed_id);
        msg!("Feed value (human-readable): {}", feed.value());
        Ok(())
    }
}

/// Account context for reading oracle data from a canonical quote account.
#[derive(Accounts)]
pub struct ReadOracleData<'info> {
    #[account(address = quote_account.canonical_key(&default_queue()))]
    pub quote_account: Box<Account<'info, SwitchboardQuote>>,

    pub sysvars: Sysvars<'info>,
}

#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock: Sysvar<'info, Clock>,
}

#[error_code]
pub enum BasicOracleError {
    #[msg("quote_account did not contain any feeds")]
    MissingFeed,
}
