use anchor_lang::prelude::*;
use switchboard_on_demand::QueueAccountData;
use switchboard_on_demand::BundleVerifierBuilder;
use switchboard_on_demand::sysvar::{SlotHashes, Instructions};
use faster_hex::hex_string;

declare_id!("2uGHnRkDsupNnicE3btnqJbpus7DWKuniZcRmKAzHFv5");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Ctx>, bundle: Vec<u8>) -> Result<()> {
        let Ctx { queue, slothashes, instructions } = ctx.accounts;
        let verified_bundle = BundleVerifierBuilder::new()
            .queue(&queue.to_account_info())
            .slothash_sysvar(&slothashes.to_account_info())
            .ix_sysvar(&instructions.to_account_info())
            .bundle(bundle.as_slice())
            .verify()
            .unwrap();
        let clock = Clock::get()?;
        let slots_since_sign = verified_bundle.slots_stale(&clock);
        msg!("Slots since sign: {}", slots_since_sign);
        for feed_info in verified_bundle.feed_infos {
            msg!("Feed hash: {}", hex_string(&feed_info.feed_id()));
            msg!("Feed value: {}", feed_info.value());
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ctx<'info> {
    pub queue: AccountLoader<'info, QueueAccountData>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}
