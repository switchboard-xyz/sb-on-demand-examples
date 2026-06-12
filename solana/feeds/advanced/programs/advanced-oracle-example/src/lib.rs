#![allow(unexpected_cfgs)]

#[cfg(target_os = "solana")]
use pinocchio::entrypoint;
use pinocchio::error::ProgramError;
use pinocchio::{AccountView, Address, ProgramResult};
use solana_msg::msg;
use switchboard_on_demand::{check_pubkey_eq, get_slot, Instructions, OracleQuote, QuoteVerifier};

mod utils;
use utils::{init_quote_account_if_needed, init_state_account_if_needed};

#[cfg(target_os = "solana")]
entrypoint!(process_instruction);

/// Advanced Oracle Example Program
///
/// This program demonstrates parsing and displaying oracle feed data.
/// It shows how to iterate through multiple feeds and extract their
/// IDs and values for processing.
#[inline(always)]
pub fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    match instruction_data[0] {
        0 => crank(program_id, accounts)?,
        1 => read(program_id, accounts)?,
        2 => init_state(program_id, accounts)?,
        3 => init_oracle(program_id, accounts)?,
        _ => return Err(ProgramError::InvalidInstructionData),
    }

    Ok(())
}

#[inline(always)]
pub fn crank(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
    let [quote, queue, state, payer, instructions_sysvar, _clock_sysvar]: &mut [AccountView; 6] =
        accounts
            .try_into()
            .map_err(|_| ProgramError::NotEnoughAccountKeys)?;

    if !is_state_account(state, program_id) {
        msg!("Invalid state account");
        return Err(ProgramError::Custom(2)); // InvalidStateAccount
    }

    // Simple state management - store authorized signer
    let state_data = state.try_borrow()?;

    if !check_pubkey_eq(&state_data[..32], payer.address()) {
        // Signer mismatch, reject
        return Err(ProgramError::Custom(1)); // UnauthorizedSigner
    }

    // DANGER: only use this if you trust the signer and all accounts passed in this tx
    OracleQuote::write_from_ix_unchecked(&*instructions_sysvar, quote, queue.address(), 0);

    Ok(())
}

#[inline(always)]
pub fn read(_program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
    let [quote, queue, clock_sysvar, slothashes_sysvar, instructions_sysvar]: &mut [AccountView;
             5] = accounts
        .try_into()
        .map_err(|_| ProgramError::NotEnoughAccountKeys)?;

    let slot = get_slot(&*clock_sysvar);

    let quote_data = QuoteVerifier::new()
        .slothash_sysvar(&*slothashes_sysvar)
        .ix_sysvar(&*instructions_sysvar)
        .clock_slot(slot)
        .queue(&*queue)
        .max_age(30)
        .verify_account(quote)
        .unwrap();

    msg!("Quote slot: {}", quote_data.slot());

    // Parse and display each feed
    for (index, feed_info) in quote_data.feeds().iter().enumerate() {
        msg!("📋 Feed #{}: {}", index + 1, feed_info.hex_id());
        msg!("💰 Value: {}", feed_info.value());
    }

    Ok(())
}

#[inline(always)]
pub fn is_state_account(account: &AccountView, program_id: &Address) -> bool {
    account.owned_by(program_id) && account.data_len() == 32
}

#[inline(always)]
pub fn init_state(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
    let [state, payer, system_program]: &mut [AccountView; 3] = accounts
        .try_into()
        .map_err(|_| ProgramError::NotEnoughAccountKeys)?;

    init_state_account_if_needed(program_id, state, payer, system_program)?;

    state.try_borrow_mut()?[..32].copy_from_slice(payer.address().as_ref());

    Ok(())
}

#[inline(always)]
pub fn init_oracle(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
    let [quote, queue, payer, system_program, instructions_sysvar]: &mut [AccountView; 5] =
        accounts
            .try_into()
            .map_err(|_| ProgramError::NotEnoughAccountKeys)?;

    let quote_data = Instructions::parse_ix_data_unverified(&*instructions_sysvar, 0)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    init_quote_account_if_needed(program_id, quote, queue, payer, system_program, &quote_data)?;

    Ok(())
}

// Custom error codes
// 0: InvalidQuoteAccount - Invalid quote account - not the canonical account for the contained feeds
// 1: UnauthorizedSigner - Unauthorized signer - does not match stored signer
