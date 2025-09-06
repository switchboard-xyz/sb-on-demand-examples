use anchor_lang::prelude::*;
use switchboard_on_demand::{QuoteVerifierBuilder, QueueAccountData, SlotHashes, OracleQuote, Instructions};
use switchboard_on_demand::check_pubkey_eq;

declare_id!("G4h79qXBmJmXSCfWeQq3FFZqGMwhcwgPsSPMvodhCzkq");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn verify(ctx: Context<VerifyCtx>) -> Result<()> {
        let VerifyCtx { queue, slothashes, oracle, .. } = ctx.accounts;

        anchor_lang::solana_program::log::sol_log_compute_units();
        let bundle = QuoteVerifierBuilder::new()
            .queue(&queue)
            .slothash_sysvar(&slothashes)
            .max_age(50)
            .verify_account(oracle.as_ref())
            .unwrap();
        anchor_lang::solana_program::log::sol_log_compute_units();

        anchor_lang::solana_program::msg!("Verified bundle slot: {}", bundle.slot());
        for feed_info in bundle.feeds() {
            msg!("Feed ID: {}, value: {}", feed_info.hex_id(), feed_info.value());
        }
        Ok(())
    }

    pub fn switchboard_oracle_update(ctx: Context<UpdateCtx>) -> Result<()> {
        let UpdateCtx { state, instructions, clock, payer, oracle, .. } = ctx.accounts;
        let cranker = state.cranker.get_or_insert(payer.key());

        // Only allow the cranker to call this function
        require!(check_pubkey_eq(&cranker, payer.key), ErrorCode::ConstraintSigner);
        anchor_lang::solana_program::log::sol_log_compute_units();
        OracleQuote::write_ix_0_to_account_info(instructions.as_ref(), clock, oracle.as_ref());
        anchor_lang::solana_program::log::sol_log_compute_units();
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub cranker: Option<Pubkey>,
}
impl ProgramState {
    pub const LEN: usize = 312;
}

#[derive(Accounts)]
pub struct VerifyCtx<'info> {
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, ProgramState>,
    /// CHECK: internal
    #[account(seeds = [b"oracle"], bump)]
    pub oracle: AccountInfo<'info>,
    pub queue: AccountLoader<'info, QueueAccountData>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateCtx<'info> {
    #[account(
        init_if_needed,
        seeds = [b"state"],
        bump,
        space = ProgramState::LEN,
        payer = payer,
    )]
    pub state: Account<'info, ProgramState>,
    /// CHECK: internal
    #[account(init_if_needed, seeds = [b"oracle"], bump, space = 1024, payer = payer)]
    pub oracle: AccountInfo<'info>,
    /// CHECK: internal
    pub instructions: Sysvar<'info, Instructions>,
    /// CHECK: solana_program::sysvar::clock::ID
    pub clock: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
