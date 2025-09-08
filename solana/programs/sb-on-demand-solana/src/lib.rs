use anchor_lang::prelude::*;
use switchboard_on_demand::clock::parse_clock;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, SlotHashes, OracleQuote, Instructions,
    check_pubkey_eq,
};

declare_id!("13fJ81pBEvmS6Pxqu3UbKutBzbdX6qhYNkt3GJGEBhpf");
// Defines SwitchboardQuote anchor wrapper
// REQUIRES: bytemuck
switchboard_on_demand::switchboard_anchor_bindings!();

#[program]
pub mod sb_on_demand_solana {
    use super::*;

    pub fn verify(ctx: Context<VerifyCtx>) -> Result<()> {
        let VerifyCtx { queue, oracle, sysvars, .. } = ctx.accounts;

        let quote = QuoteVerifier::new()
            .slothash_sysvar(&sysvars.slothashes)
            .ix_sysvar(&sysvars.instructions)
            .clock(parse_clock(&sysvars.clock))
            .queue(&queue)
            .verify_account(&oracle)
            .unwrap();

        msg!("Verified slot: {}", quote.slot());
        for feed_info in quote.feeds() {
            msg!("Feed ID: {}, value: {}", feed_info.hex_id(), feed_info.value());
        }
        Ok(())
    }

    pub fn switchboard_oracle_update(ctx: Context<UpdateCtx>) -> Result<()> {
        let UpdateCtx { state, oracle, sysvars, payer, .. } = ctx.accounts;
        let cranker = state.cranker.get_or_insert(payer.key());
        let clock = parse_clock(&sysvars.clock);

        // Only allow the cranker to call this function
        require!(check_pubkey_eq(&cranker, payer.key), ErrorCode::ConstraintSigner);

        OracleQuote::write_from_ix(&sysvars.instructions, &oracle, clock, 0);
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub cranker: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct VerifyCtx<'info> {
    #[account(seeds = [b"oracle"], bump)]
    pub oracle:       AccountLoader<'info, SwitchboardQuote>,
    #[account(address = switchboard_on_demand::default_queue())]
    pub queue:        AccountLoader<'info, QueueAccountData>,
    pub sysvars:      Sysvars<'info>,
}

#[derive(Accounts)]
pub struct UpdateCtx<'info> {
    #[account(init_if_needed, seeds = [b"state"], bump, space = 41, payer = payer)]
    pub state:          Account<'info, ProgramState>,
    #[account(init_if_needed, seeds = [b"oracle"], bump, space = SwitchboardQuote::LEN, payer = payer)]
    pub oracle:         AccountLoader<'info, SwitchboardQuote>,
    pub sysvars:        Sysvars<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub payer:          Signer<'info>,
}

#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock:        Sysvar<'info, Clock>,
    pub slothashes:   Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}
