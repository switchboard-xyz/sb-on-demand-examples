use pinocchio::{
    cpi::{invoke_signed, Seed, Signer},
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    sysvars::{rent::Rent, Sysvar},
    AccountView, Address,
};
use solana_msg::msg;
use switchboard_on_demand::OracleQuote;

const SYSTEM_PROGRAM_ID: Address = Address::new_from_array([0; 32]);

pub const ORACLE_ACCOUNT_SIZE: usize = 8 + 32 + 1024; // discriminator (8) + queue (32) + data (1024)
pub const STATE_ACCOUNT_SIZE: usize = 32;

#[inline(always)]
fn find_program_address(
    seeds: &[&[u8]],
    program_id: &Address,
) -> Result<(Address, u8), ProgramError> {
    #[cfg(target_os = "solana")]
    {
        Ok(Address::find_program_address(seeds, program_id))
    }

    #[cfg(not(target_os = "solana"))]
    {
        macro_rules! derive_for_len {
            ($($len:literal),+ $(,)?) => {
                match seeds.len() {
                    $(
                        $len => {
                            let seed_array: [&[u8]; $len] = core::array::from_fn(|index| seeds[index]);
                            Address::derive_program_address(&seed_array, program_id)
                        }
                    )+
                    _ => None,
                }
            };
        }

        derive_for_len!(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)
            .ok_or(ProgramError::InvalidArgument)
    }
}

#[inline(always)]
pub fn init_quote_account_if_needed(
    program_id: &Address,
    oracle_account: &mut AccountView,
    queue_account: &mut AccountView,
    payer: &mut AccountView,
    system_program: &mut AccountView,
    oracle_quote: &OracleQuote,
) -> Result<(), ProgramError> {
    if oracle_account.lamports() != 0 {
        msg!("Oracle account already initialized");
        return Ok(());
    }
    // Check if system program is correct
    if system_program.address() != &SYSTEM_PROGRAM_ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Verify the oracle account is the correct PDA derived from queue + feed IDs
    let feed_ids = oracle_quote.feed_ids();
    let mut seeds_for_derivation: Vec<&[u8]> = Vec::with_capacity(feed_ids.len() + 1);
    seeds_for_derivation.push(queue_account.address().as_ref());
    for feed_id in &feed_ids {
        seeds_for_derivation.push(feed_id.as_ref());
    }
    let (canonical_address, bump) = find_program_address(&seeds_for_derivation, program_id)?;
    if canonical_address != *oracle_account.address() {
        return Err(ProgramError::InvalidArgument);
    }

    // Prepare seeds for invoke_signed
    let mut seeds = Vec::with_capacity(feed_ids.len() + 2);
    seeds.push(Seed::from(queue_account.address().as_ref()));
    for feed_id in &feed_ids {
        seeds.push(Seed::from(feed_id.as_ref()));
    }
    let bump = [bump];
    let bump_bytes = Seed::from(&bump);
    seeds.push(bump_bytes);

    // Calculate rent requirement
    let rent = Rent::get()?;
    let required_lamports = rent.try_minimum_balance(ORACLE_ACCOUNT_SIZE)?;

    // Create the system program instruction to create account
    let mut data = Vec::with_capacity(52);
    let cpi_accounts = [*payer, *oracle_account, *system_program];
    let create_account_accounts = [
        InstructionAccount::writable_signer(cpi_accounts[0].address()),
        InstructionAccount::writable_signer(cpi_accounts[1].address()),
    ];
    let create_account_ix = InstructionView {
        program_id: &SYSTEM_PROGRAM_ID,
        accounts: &create_account_accounts,
        data: {
            data.extend_from_slice(&0u32.to_le_bytes()); // CreateAccount instruction
            data.extend_from_slice(&required_lamports.to_le_bytes());
            data.extend_from_slice(&(ORACLE_ACCOUNT_SIZE as u64).to_le_bytes());
            data.extend_from_slice(program_id.as_ref());
            &data
        },
    };

    // Make CPI to system program to create account
    invoke_signed(
        &create_account_ix,
        &cpi_accounts,
        &[Signer::from(seeds.as_slice())],
    )
}

#[inline(always)]
pub fn init_state_account_if_needed(
    program_id: &Address,
    state_account: &mut AccountView,
    payer: &mut AccountView,
    system_program: &mut AccountView,
) -> Result<(), ProgramError> {
    if state_account.lamports() != 0 {
        return Ok(());
    }

    // Check if system program is correct
    if system_program.address() != &SYSTEM_PROGRAM_ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Derive and verify the state account is the correct PDA
    let (expected_state_key, bump) = find_program_address(&[b"state"], program_id)?;
    if state_account.address() != &expected_state_key {
        return Err(ProgramError::InvalidArgument);
    }

    // Calculate rent requirement
    let rent = Rent::get()?;
    let required_lamports = rent.try_minimum_balance(STATE_ACCOUNT_SIZE)?;

    // Create the system program instruction to create account
    let mut data = Vec::with_capacity(52);
    let cpi_accounts = [*payer, *state_account, *system_program];
    let create_account_accounts = [
        InstructionAccount::writable_signer(cpi_accounts[0].address()),
        InstructionAccount::writable_signer(cpi_accounts[1].address()),
    ];
    let create_account_ix = InstructionView {
        program_id: &SYSTEM_PROGRAM_ID,
        accounts: &create_account_accounts,
        data: {
            data.extend_from_slice(&0u32.to_le_bytes()); // CreateAccount instruction
            data.extend_from_slice(&required_lamports.to_le_bytes());
            data.extend_from_slice(&(STATE_ACCOUNT_SIZE as u64).to_le_bytes());
            data.extend_from_slice(program_id.as_ref());
            &data
        },
    };

    // Make CPI to system program to create account
    let bump_seed = [bump];
    let state_seeds = [Seed::from(b"state"), Seed::from(&bump_seed)];
    invoke_signed(
        &create_account_ix,
        &cpi_accounts,
        &[Signer::from(&state_seeds)],
    )?;

    // Account is created with zero-initialized data by default
    Ok(())
}
