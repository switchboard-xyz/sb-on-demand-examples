use pinocchio::{
  account_info::AccountInfo,
  msg,
  pubkey::Pubkey
};
use switchboard_on_demand::OracleQuote;
use pinocchio::instruction::AccountMeta;
use pinocchio::sysvars::rent::Rent;
use pinocchio::program_error::ProgramError;
use pinocchio::program::invoke_signed;
use pinocchio::instruction::Signer;
use pinocchio::instruction::Instruction;
use pinocchio::sysvars::Sysvar;
use pinocchio::instruction::Seed;

const SYSTEM_PROGRAM_ID: Pubkey = [0; 32];

pub const ORACLE_ACCOUNT_SIZE: usize = 8 + 32 + 1024; // discriminator (8) + queue (32) + data (1024)
pub const STATE_ACCOUNT_SIZE: usize = 32;

#[inline(always)]
pub fn init_quote_account_if_needed(
    program_id: &Pubkey,
    oracle_account: &AccountInfo,
    queue_account: &AccountInfo,
    payer: &AccountInfo,
    system_program: &AccountInfo,
    oracle_quote: &OracleQuote,
) -> Result<(), ProgramError> {
    if oracle_account.lamports() != 0 {
        msg!("Oracle account already initialized");
        return Ok(());
    }
    // Check if system program is correct
    if system_program.key() != &SYSTEM_PROGRAM_ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Verify the oracle account is the correct PDA derived from queue + feed IDs
    let feed_ids = oracle_quote.feed_ids();
    let mut seeds_for_derivation: Vec<&[u8]> = Vec::with_capacity(feed_ids.len() + 1);
    seeds_for_derivation.push(queue_account.key().as_ref());
    for feed_id in &feed_ids {
        seeds_for_derivation.push(feed_id.as_ref());
    }
    let (canonical_address, bump) = pinocchio::pubkey::find_program_address(&seeds_for_derivation, program_id);
    if canonical_address != *oracle_account.key() {
        return Err(ProgramError::InvalidArgument);
    }

    // Prepare seeds for invoke_signed
    let mut seeds = Vec::with_capacity(feed_ids.len() + 2);
    seeds.push(Seed::from(queue_account.key().as_ref()));
    for feed_id in &feed_ids {
        seeds.push(Seed::from(feed_id.as_ref()));
    }
    let bump = [bump];
    let bump_bytes = Seed::from(&bump);
    seeds.push(bump_bytes);

    // Calculate rent requirement
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(ORACLE_ACCOUNT_SIZE);

    // Create the system program instruction to create account
    let mut data = Vec::with_capacity(52);
    let create_account_ix = Instruction {
        program_id: &SYSTEM_PROGRAM_ID,
        accounts: &[
            AccountMeta::new(payer.key(), true, true),
            AccountMeta::new(oracle_account.key(), true, true),
        ],
        data: {
            data.extend_from_slice(&0u32.to_le_bytes()); // CreateAccount instruction
            data.extend_from_slice(&required_lamports.to_le_bytes());
            data.extend_from_slice(&(ORACLE_ACCOUNT_SIZE as u64).to_le_bytes());
            data.extend_from_slice(program_id);
            &data
        },
    };

    // Make CPI to system program to create account
    invoke_signed(
        &create_account_ix,
        &[
            payer,
            oracle_account,
            system_program,
        ],
        &[Signer::from(seeds.as_slice())]
    )
}

#[inline(always)]
pub fn init_state_account_if_needed(
    program_id: &Pubkey,
    state_account: &AccountInfo,
    payer: &AccountInfo,
    system_program: &AccountInfo,
) -> Result<(), ProgramError> {
    if state_account.lamports() != 0 {
        return Ok(());
    }

    // Check if system program is correct
    if system_program.key() != &SYSTEM_PROGRAM_ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Derive and verify the state account is the correct PDA
    let (expected_state_key, bump) = pinocchio::pubkey::find_program_address(&[b"state"], program_id);
    if state_account.key() != &expected_state_key {
        return Err(ProgramError::InvalidArgument);
    }

    // Calculate rent requirement
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(STATE_ACCOUNT_SIZE);

    // Create the system program instruction to create account
    let mut data = Vec::with_capacity(52);
    let create_account_ix = Instruction {
        program_id: &SYSTEM_PROGRAM_ID,
        accounts: &[
            AccountMeta::new(payer.key(), true, true),
            AccountMeta::new(state_account.key(), true, true),
        ],
        data: {
            data.extend_from_slice(&0u32.to_le_bytes()); // CreateAccount instruction
            data.extend_from_slice(&required_lamports.to_le_bytes());
            data.extend_from_slice(&(STATE_ACCOUNT_SIZE as u64).to_le_bytes());
            data.extend_from_slice(program_id);
            &data
        },
    };

    // Make CPI to system program to create account
    invoke_signed(
        &create_account_ix,
        &[
            payer,
            state_account,
            system_program,
        ],
        &[Signer::from(&[Seed::from(b"state"), Seed::from(&[bump])])],
    )?;

    // Account is created with zero-initialized data by default
    Ok(())
}
