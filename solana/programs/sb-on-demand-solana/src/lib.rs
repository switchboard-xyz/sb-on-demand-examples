use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use switchboard_on_demand::{BundleVerifierBuilder, QueueAccountData, SlotHashes};
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;

declare_id!("AKWdag9NuxYbomfhNpJFDB5zooYumBYKVtZrcJ4w8R32");

#[inline(always)]
fn sol_memcpy(dest: &mut [u8], src: &[u8], len: usize) {
    unsafe { solana_program_memory::sol_memcpy(dest, src, len); }
}

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn test<'a>(ctx: Context<Ctx>) -> Result<()> {
        let Ctx { state, queue, slothashes, instructions, .. } = ctx.accounts;
        let ix = load_instruction_at_checked(0, instructions.as_ref())?;
        let staleness = Clock::get()?.slot - state.last_verified_slot;

        msg!("DEBUG: Pre-verification compute units v");
        solana_program::log::sol_log_compute_units();
        let bundle = BundleVerifierBuilder::new()
            .queue(&queue)
            .slothash_sysvar(&slothashes)
            .max_age(staleness.max(50))
            .verify(&ix.data)
            .unwrap();
        solana_program::log::sol_log_compute_units();
        msg!("DEBUG: Post-verification compute units ^");

        for feed_info in bundle.feeds() {
            msg!("Feed ID: {}", feed_info.hex_id());
            msg!("Feed value: {}", feed_info.value());
        }
        state.last_verified_slot = bundle.slot();
        state.report_len = ix.data.len() as u64;
        sol_memcpy(&mut state.oracle_report, &ix.data, ix.data.len());
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub last_verified_slot: u64,
    pub report_len: u64,
    pub oracle_report: [u8; 256],
}
impl ProgramState {
    pub const LEN: usize = 8 + 8 + 8 + 256;
}
impl Default for ProgramState {
    fn default() -> Self {
        Self {
            last_verified_slot: 0,
            report_len: 0,
            oracle_report: [0u8; 256],
        }
    }
}

#[derive(Accounts)]
pub struct Ctx<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = ProgramState::LEN,
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
