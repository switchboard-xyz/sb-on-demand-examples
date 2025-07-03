use faster_hex::hex_string;
use anchor_lang::prelude::*;
use switchboard_on_demand::prelude::{
    BundleVerifierBuilder, QueueAccountData, SlotHashes, Instructions,
};

declare_id!("4cjC1aDk6xRqJAP73gq7JSehRoG8Lm8fZtNh19YGzwx7");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Ctx>, bundle: Vec<u8>) -> Result<()> {
        let verified_bundle = BundleVerifierBuilder::from(&bundle)
            .queue(&ctx.accounts.queue)
            .slothash_sysvar(&ctx.accounts.slothashes)
            .ix_sysvar(&ctx.accounts.instructions)
            .clock(&Clock::get()?)
            .max_age(50) // Maximum age in slots for bundle freshness
            .verify()
            .unwrap();
        let verified_slot = verified_bundle.verified_slot;
        msg!("Price verified at slot: {verified_slot}. Never accept a bundle older than this slot!");
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
