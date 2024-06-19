use anchor_lang::prelude::*;
use switchboard_on_demand::on_demand::accounts::pull_feed::PullFeedAccountData;

declare_id!("FFDYSDSoiTHaH8fuycLcHAUpfRAvuNb1Uy1g64eZgpsz");

fn fmt(s: &str) -> String {
    if s.len() < 18 {
        // Handle error or return the original string if it's less than 18 characters
        return s.to_string();
    }
    let split_index = s.len() - 18;
    let (first_part, last_part) = s.split_at(split_index);
    format!("{}.{}", first_part, last_part)
}

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Test>) -> Result<()> {
        let feed_account = ctx.accounts.feed.data.borrow();
        // Docs at: https://switchboard-on-demand-rust-docs.web.app/on_demand/accounts/pull_feed/struct.PullFeedAccountData.html#method.get_value
        let feed = PullFeedAccountData::parse(feed_account)
        .map_err(|e| {
            msg!("Parse Error: {:?}", e);
            ProgramError::Custom(1)}
        )?;
        let price = feed.get_value(&Clock::get()?, 30, 1, true)
        .map_err(|e| {
            msg!("Get Value Error: {:?}", e);
            ProgramError::Custom(2)
        })?;
        msg!("price: {:?}", fmt(&price.mantissa().to_string()));
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Test<'info> {
    /// CHECK: via switchboard sdk
    pub feed: AccountInfo<'info>,
}
