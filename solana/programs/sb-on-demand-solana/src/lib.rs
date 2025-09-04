use anchor_lang::prelude::*;
use switchboard_on_demand::{BundleVerifierBuilder, QueueAccountData, SlotHashes, Instructions};

declare_id!("7HQEwXPhQC2iRvSZfchKHC373MAwE5exwZZfaxZ784Gk");
const DEFAULT_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn verify(ctx: Context<VerifyCtx>) -> Result<()> {
        let VerifyCtx { state, queue, slothashes, .. } = ctx.accounts;
        // Access state directly
        // let staleness = Clock::get()?.slot - state.last_verified_slot;

        // Use saved report from state
        let report_data = &state.oracle_report;

        anchor_lang::solana_program::log::sol_log_compute_units();
        let bundle = BundleVerifierBuilder::new()
            .queue(&queue)
            .slothash_sysvar(&slothashes)
            .max_age(50)
            .verify(report_data)
            .unwrap();
        anchor_lang::solana_program::log::sol_log_compute_units();

        for feed_info in bundle.feeds() {
            msg!("Feed ID: {}, value: {}", feed_info.hex_id(), feed_info.value());
        }
        Ok(())
    }

    pub fn switchboard_oracle_update(ctx: Context<UpdateCtx>) -> Result<()> {
        let UpdateCtx { state, instructions, clock, payer, .. } = ctx.accounts;
        let ProgramState { oracle_report, cranker, .. } = &mut **state;

        // assign cranker
        if switchboard_on_demand::check_pubkey_eq(&cranker, &DEFAULT_PUBKEY) {
            *cranker = *payer.key;
        }
        anchor_lang::solana_program::log::sol_log_compute_units();
        Instructions::write_ix_0_delimited(instructions, clock, oracle_report);
        anchor_lang::solana_program::log::sol_log_compute_units();
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub cranker: Pubkey,
    pub oracle_report: [u8; 256],
}
impl ProgramState {
    pub const LEN: usize = 312;
}

#[derive(Accounts)]
pub struct VerifyCtx<'info> {
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, ProgramState>,
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
    /// CHECK: solana_program::sysvar::instructions::ID
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
    /// CHECK: solana_program::sysvar::clock::ID
    pub clock: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
