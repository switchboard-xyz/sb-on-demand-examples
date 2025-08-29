use anchor_lang::prelude::*;
use switchboard_on_demand::{BundleVerifierBuilder, QueueAccountData, SlotHashes, Instructions};

declare_id!("AKWdag9NuxYbomfhNpJFDB5zooYumBYKVtZrcJ4w8R32");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn verify(ctx: Context<VerifyCtx>) -> Result<()> {
        let VerifyCtx { state, queue, slothashes, .. } = ctx.accounts;
        // Access state directly
        let staleness = Clock::get()?.slot - state.last_verified_slot;

        // Use saved report from state
        let report_data = &state.oracle_report[..state.report_len as usize];

        anchor_lang::solana_program::log::sol_log_compute_units();
        let bundle = BundleVerifierBuilder::new()
            .queue(&queue)
            .slothash_sysvar(&slothashes)
            .max_age(staleness.max(50))
            .verify(report_data)
            .unwrap();
        anchor_lang::solana_program::log::sol_log_compute_units();

        for feed_info in bundle.feeds() {
            msg!("Feed ID: {}, value: {}", feed_info.hex_id(), feed_info.value());
        }
        state.last_verified_slot = bundle.slot();
        Ok(())
    }

    pub fn switchboard_oracle_update(ctx: Context<UpdateCtx>) -> Result<()> {
        let UpdateCtx { state, instructions, .. } = ctx.accounts;
        anchor_lang::solana_program::log::sol_log_compute_units();
        state.report_len = Instructions::write_instruction_0_data(
            &instructions,
            &mut state.oracle_report);
        anchor_lang::solana_program::log::sol_log_compute_units();
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub last_verified_slot: u64,
    pub report_len: u16,
    pub oracle_report: [u8; 256],
}
impl ProgramState {
    pub const LEN: usize = 8 + 8 + 8 + 256;
}

#[derive(Accounts)]
pub struct VerifyCtx<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,
    pub queue: AccountLoader<'info, QueueAccountData>,
    pub slothashes: Sysvar<'info, SlotHashes>,
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
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
