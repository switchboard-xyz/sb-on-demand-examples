use faster_hex::hex_string;
use anchor_lang::prelude::*;
use switchboard_on_demand::prelude::{
    BundleVerifierBuilder, QueueAccountData, SlotHashes, Instructions,
};

declare_id!("DMZyhztu9nMWirY231QeAuhiVKry4zeGMrjTGRSktjM1");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Ctx>) -> Result<()> {
        let verified_bundle = BundleVerifierBuilder::new()
            .queue(&ctx.accounts.queue)
            .slothash_sysvar(&ctx.accounts.slothashes)
            .ix_sysvar(&ctx.accounts.instructions)
            .clock(&Clock::get()?)
            .max_age(50) // Maximum age in slots for bundle freshness
            .verify()
            .unwrap();
        let verified_slot = verified_bundle.verified_slot;
        let state = &mut ctx.accounts.state;
        if state.last_verified_slot > verified_slot {
            msg!("Received prices are older than the last verified prices. Ignoring bundle.");
            return Ok(());
        }
        state.last_verified_slot = verified_slot;

        for feed_info in verified_bundle.feeds() {
            msg!("Feed hash: {}", hex_string(&feed_info.feed_id()));
            msg!("Feed value: {}", feed_info.value());
        }
        Ok(())
    }
}

#[account]
#[derive(Default)]
pub struct ProgramState {
    pub last_verified_slot: u64,
}

#[derive(Accounts)]
pub struct Ctx<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = 16,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub queue: AccountLoader<'info, QueueAccountData>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
    pub system_program: Program<'info, System>,
}
