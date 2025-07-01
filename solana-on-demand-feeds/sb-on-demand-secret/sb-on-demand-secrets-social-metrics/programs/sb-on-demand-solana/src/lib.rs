use anchor_lang::prelude::*;
use switchboard_on_demand::on_demand::accounts::pull_feed::PullFeedAccountData;

declare_id!("CeJiXcRwxWmFoCMy1GozyGrt4SoAXB9HmFTA1JAfmqQT");
#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Test>) -> Result<()> {
        let feed_account = ctx.accounts.feed.data.borrow();
        // Docs at: https://switchboard-on-demand-rust-docs.web.app/on_demand/accounts/pull_feed/struct.PullFeedAccountData.html
        let feed = PullFeedAccountData::parse(feed_account).unwrap();
        msg!("Social: Followers Count on X.com : {:?}", feed.value());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Test<'info> {
    /// CHECK: via switchboard sdk
    pub feed: AccountInfo<'info>,
}