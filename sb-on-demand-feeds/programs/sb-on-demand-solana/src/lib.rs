use anchor_lang::prelude::*;
use switchboard_on_demand::QueueAccountData;
use switchboard_on_demand::BundleVerifierBuilder;
use switchboard_on_demand::sysvar::{SlotHashes, Instructions};

declare_id!("2uGHnRkDsupNnicE3btnqJbpus7DWKuniZcRmKAzHFv5");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Ctx>, bundle: Vec<u8>) -> Result<()> {
        let Ctx { queue, slothashes, instructions } = ctx.accounts;
        let verified_bundle = BundleVerifierBuilder::default()
            .queue(&queue.to_account_info())
            .slothash_sysvar(&slothashes.to_account_info())
            .ix_sysvar(&instructions.to_account_info())
            .clock(&Clock::get()?)
            .bundle(bundle.as_slice())
            .verify()
            .unwrap();
        let signed_slot = verified_bundle.verified_slot;
        for feed_info in verified_bundle.feed_infos {
            msg!("Feed hash: {:?}", feed_info.checksum);
            msg!("Feed value: {}", feed_info.value);
            msg!("Signed slot: {}", signed_slot);
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
