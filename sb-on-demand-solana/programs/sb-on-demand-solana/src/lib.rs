use anchor_lang::prelude::*;
use switchboard_on_demand::on_demand::accounts::pull_feed::PullFeedAccountData;

declare_id!("84LSTTNKxiQFey1mx4b2C74GKrSKMcuJZYrnL8J9wAaT");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Test>) -> Result<()> {
        let feed_account = ctx.accounts.feed.data.borrow();
        // Docs at: https://switchboard-on-demand-rust-docs.web.app/on_demand/accounts/pull_feed/struct.PullFeedAccountData.html#method.get_value
        let feed = PullFeedAccountData::parse(feed_account)
            .map_err(|e| ProgramError::Custom(1))?;
        let price = feed.get_value(&Clock::get()?, 30, 1, true)
            .map_err(|e| ProgramError::Custom(2))?;
        msg!("feed: {:?}", feed);
        drop(feed);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Test<'info> {
    /// CHECK: via switchboard sdk
    pub feed: AccountInfo<'info>,
}
