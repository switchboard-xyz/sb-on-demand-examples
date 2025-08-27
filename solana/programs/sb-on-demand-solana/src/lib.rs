use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use switchboard_on_demand::{BundleVerifierBuilder, QueueAccountData, SlotHashes};
use solana_program_memory::sol_memcpy;

declare_id!("AKWdag9NuxYbomfhNpJFDB5zooYumBYKVtZrcJ4w8R32");

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn verify<'a>(ctx: Context<VerifyCtx>) -> Result<()> {
        let VerifyCtx { state, queue, slothashes, .. } = ctx.accounts;
        let staleness = Clock::get()?.slot - state.last_verified_slot;

        // Use saved report from state
        let report_data = &state.oracle_report[..state.report_len as usize];

        msg!("DEBUG: Pre-verification compute units v");
        solana_program::log::sol_log_compute_units();
        let bundle = BundleVerifierBuilder::new()
            .queue(&queue)
            .slothash_sysvar(&slothashes)
            .max_age(staleness.max(50))
            .verify(report_data)
            .unwrap();
        solana_program::log::sol_log_compute_units();
        msg!("DEBUG: Post-verification compute units ^");

        for feed_info in bundle.feeds() {
            msg!("Feed ID: {}, value: {}", feed_info.hex_id(), feed_info.value());
        }
        state.last_verified_slot = bundle.slot();
        Ok(())
    }

    pub fn update<'a>(ctx: Context<UpdateCtx>) -> Result<()> {
        let UpdateCtx { state, instructions, .. } = ctx.accounts;
        solana_program::log::sol_log_compute_units();
        // Extract the oracle precompile signature instruction
        let ix_data = &instructions.data.borrow();
        let report = deserialize_instruction_0(ix_data);
        sol_memcpy(&mut state.oracle_report, report, report.len());
        solana_program::log::sol_log_compute_units();
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
        unsafe { std::mem::zeroed() }
    }
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
    /// CHECK: Instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[inline(always)]
fn deserialize_instruction(index: usize, data: &[u8]) -> &[u8] {
    use solana_program_ed25519_dalek_bump::serialize_utils::read_u16;
    let mut current = 0;
    let num_instructions = read_u16(&mut current, data).unwrap();
    assert!(index < num_instructions as usize);

    // index into the instruction byte-offset table.
    current += index * 2;
    let start = read_u16(&mut current, data).unwrap();

    current = start as usize;
    current += 34;
    let data_len = read_u16(&mut current, data).unwrap();
    // return slice of the data
    &data[current..current + data_len as usize]
}

#[inline(always)]
fn deserialize_instruction_0(data: &[u8]) -> &[u8] {
    const HEADER_SIZE: usize = 44;
    const U16_SIZE: usize = 2;
    const START: usize = HEADER_SIZE + U16_SIZE;

    let data_len = unsafe {
        std::ptr::read_unaligned(data.as_ptr().add(HEADER_SIZE) as *const u16)
    }.to_le() as usize;

    unsafe { std::slice::from_raw_parts(data.as_ptr().add(START), data_len) }
}
