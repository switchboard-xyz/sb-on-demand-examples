use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use switchboard_on_demand::{
    BundleVerifierBuilder, QueueAccountData, get_ed25519_instruction, SlotHashes
};

declare_id!("6z3ymNRkYMRvazLV8fhy2jhBCFro1942Ann4neXMcCcR");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Ctx>) -> Result<()> {
        let clock = Clock::get()?;
        let state = &mut ctx.accounts.state;
        let ix = get_ed25519_instruction(ctx.accounts.instructions.as_ref())?;
        let staleness = clock.slot - state.last_verified_slot;
        msg!("DEBUG: Pre-verification compute units");
        solana_program::log::sol_log_compute_units();
        let bundle = BundleVerifierBuilder::new()
            .queue(&ctx.accounts.queue)
            .slothash_sysvar(&ctx.accounts.slothashes)
            .clock(&clock)
            .max_age(staleness.max(50))
            .verify(&ix.data)
            .map_err(|e| {
                msg!("DEBUG: Bundle verification failed: {:?}", e);
                anchor_lang::error::Error::from(anchor_lang::error::ErrorCode::ConstraintRaw)
            })?;
        solana_program::log::sol_log_compute_units();
        msg!("DEBUG: Post-verification compute units ^");
        let verified_slot = bundle.slot();
        msg!("DEBUG: Bundle verified slot: {}", verified_slot);
        if state.last_verified_slot > verified_slot {
            msg!("Received prices are older than the last verified prices. Ignoring bundle.");
            return Ok(());
        }
        state.last_verified_slot = verified_slot;
        for feed_info in bundle.feeds() {
            msg!("Feed hash: {}", feed_info.hex_id());
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
    /// CHECK: Instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
