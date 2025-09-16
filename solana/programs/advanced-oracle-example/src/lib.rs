use anchor_lang::prelude::*;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, get_slot, SlotHashes, Instructions
};

declare_id!("FNnhcuzFqg8CSVHRauPh8rFaqSrJzsQ8wL66GFL8VJZQ");
// Defines SwitchboardQuote anchor wrapper. This allows oracle accounts
// to be owned by your program.
switchboard_on_demand::switchboard_anchor_bindings!();

/// Advanced Oracle Example Program
///
/// This program demonstrates parsing and displaying oracle feed data.
/// It shows how to iterate through multiple feeds and extract their
/// IDs and values for processing.
#[program]
pub mod advanced_oracle_example {
    use super::*;

    pub fn crank(ctx: Context<CrankAccounts>) -> Result<()> {
        let CrankAccounts { oracle, queue, sysvars, .. } = ctx.accounts;
        let slot = get_slot(&sysvars.clock);
        OracleQuote::write_from_ix(&sysvars.instructions, &oracle, slot, 0);
        Ok(())
    }

    pub fn read(ctx: Context<ReadAccounts>) -> Result<()> {
        let ReadAccounts { oracle, queue, sysvars, .. } = ctx.accounts;
        let slot = get_slot(&sysvars.clock);

        // Verify the oracle quote data
        let quote = QuoteVerifier::new()
            .slothash_sysvar(&sysvars.slothashes)
            .ix_sysvar(&sysvars.instructions)
            .clock_slot(slot)
            .queue(&queue)
            .max_age(30)
            .verify_account(&oracle_account)?;

        msg!("🎉 Successfully verified oracle data!");
        msg!("Quote slot: {}", quote.slot());
        msg!("Number of feeds: {}", quote.feeds().len());

        // Demonstrate the new canonical_key method
        let canonical_key = quote.canonical_key(&oracle_account.owner);

        // Parse and display each feed
        for (index, feed_info) in quote.feeds().iter().enumerate() {
            msg!("📋 Feed #{}: {}", index + 1, feed_info.hex_id());
            msg!("💰 Value: {}", feed_info.value());
        }

        msg!("✅ Parsing complete!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CrankAccounts<'info> {
    #[account(
        init_if_needed,
        address = oracle.canonical_key(&crate::ID)
        payer = payer,
        space = SwitchboardQuote::LEN,
    )]
    pub oracle:         InterfaceAccount<'info, SwitchboardQuote>,
    #[account(address = switchboard_on_demand::default_queue())]
    pub queue:          AccountLoader<'info, QueueAccountData>,
    pub payer:          Signer<'info>,
    pub system_program: Program<'info, System>,
    pub sysvars:        Sysvars<'info>,
}

#[derive(Accounts)]
pub struct ReadAccounts<'info> {
    #[account(address = oracle.canonical_key(&crate::ID))]
    pub oracle:         InterfaceAccount<'info, SwitchboardQuote>,
    #[account(address = switchboard_on_demand::default_queue())]
    pub queue:          AccountLoader<'info, QueueAccountData>,
    pub sysvars:        Sysvars<'info>,
}

/// System variables required for oracle verification
#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock: Sysvar<'info, Clock>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}


/// Custom error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid oracle account - not the canonical account for the contained feeds")]
    InvalidOracleAccount,
}
