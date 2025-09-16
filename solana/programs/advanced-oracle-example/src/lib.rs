use anchor_lang::prelude::*;
use switchboard_on_demand::{
    QuoteVerifier, QueueAccountData, SlotHashes, OracleQuote, Instructions,
    check_pubkey_eq, get_slot
};

declare_id!("ADVanCedxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
// Defines SwitchboardQuote anchor wrapper
switchboard_on_demand::switchboard_anchor_bindings!();

/// Advanced Oracle Example Program
///
/// This program demonstrates advanced patterns for production use:
/// - State management and access control
/// - Performance monitoring with compute unit logging
/// - Multiple oracle integration patterns
/// - Error handling and validation
/// - Business logic integration
#[program]
pub mod advanced_oracle_example {
    use super::*;

    /// Initialize the program state
    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = authority;
        state.oracle_calls = 0;
        state.last_update_slot = 0;
        state.total_feeds_processed = 0;

        msg!("🏗️ Advanced oracle program initialized");
        msg!("Authority: {}", authority);
        Ok(())
    }

    /// Process oracle data with advanced features
    ///
    /// This instruction demonstrates production-ready patterns:
    /// - Authority validation
    /// - Performance monitoring
    /// - State updates
    /// - Multiple feeds processing
    /// - Business logic integration
    pub fn process_oracle_data(ctx: Context<ProcessOracleData>) -> Result<()> {
        let ProcessOracleData {
            state,
            oracle_account,
            queue,
            sysvars,
            authority,
            ..
        } = ctx.accounts;

        // Validate authority
        require!(
            state.authority == authority.key(),
            ErrorCode::UnauthorizedAccess
        );

        // Log compute units for performance monitoring
        anchor_lang::solana_program::log::sol_log_compute_units();

        // Load and verify oracle data
        let oracle_data = oracle_account.load()?;
        let quote = QuoteVerifier::new()
            .slothash_sysvar(&sysvars.slothashes)
            .ix_sysvar(&sysvars.instructions)
            .clock_slot(get_slot(&sysvars.clock))
            .queue(&queue)
            .max_age(20) // Strict timing for production
            .verify_loaded(&oracle_data)?;

        // Update program state
        state.oracle_calls += 1;
        state.last_update_slot = quote.slot();

        let mut feeds_processed = 0;
        let current_slot = get_slot(&sysvars.clock);

        msg!("📈 Processing oracle data from slot: {}", quote.slot());
        msg!("📊 Current slot: {}", current_slot);
        msg!("🔄 Oracle calls: {}", state.oracle_calls);

        // Process each feed with advanced logic
        for (index, feed_info) in quote.feeds().iter().enumerate() {
            feeds_processed += 1;

            msg!("📋 Feed #{}: {}", index + 1, feed_info.hex_id());
            msg!("💵 Value: {}", feed_info.value());

            // Advanced business logic examples:

            // 1. Price threshold checking
            let price_value = feed_info.value();
            if price_value > 100_000_000_000 { // $100k in scaled format
                msg!("🚨 High value detected: {}", price_value);
                // Trigger high-value logic
            }

            // 2. Price change detection (if this is an update)
            if state.oracle_calls > 1 {
                msg!("🔄 This is update #{}", state.oracle_calls);
                // Could compare with previous values stored in state
            }

            // 3. Feed-specific handling
            match feed_info.hex_id().as_str() {
                // BTC/USD feed
                feed_id if feed_id.starts_with("ef0d8b6fcd0104e3e75096912fc8e1e432893da4f") => {
                    msg!("₿ Processing BTC/USD: {}", price_value);
                    // BTC-specific logic
                }
                // ETH/USD feed
                feed_id if feed_id.starts_with("12345") => {
                    msg!("Ⓔ Processing ETH/USD: {}", price_value);
                    // ETH-specific logic
                }
                _ => {
                    msg!("📊 Processing generic feed: {}", price_value);
                    // Generic feed logic
                }
            }
        }

        // Update total feeds processed
        state.total_feeds_processed += feeds_processed;

        // Log final performance metrics
        anchor_lang::solana_program::log::sol_log_compute_units();

        msg!("✅ Processing complete!");
        msg!("📊 Feeds in this update: {}", feeds_processed);
        msg!("📈 Total feeds processed: {}", state.total_feeds_processed);

        Ok(())
    }

    /// Update program authority (admin function)
    pub fn update_authority(
        ctx: Context<UpdateAuthority>,
        new_authority: Pubkey
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;

        require!(
            state.authority == ctx.accounts.current_authority.key(),
            ErrorCode::UnauthorizedAccess
        );

        let old_authority = state.authority;
        state.authority = new_authority;

        msg!("🔑 Authority updated");
        msg!("Old: {}", old_authority);
        msg!("New: {}", new_authority);

        Ok(())
    }

    /// Get program statistics (view function)
    pub fn get_stats(ctx: Context<GetStats>) -> Result<()> {
        let state = &ctx.accounts.state;

        msg!("📊 Program Statistics:");
        msg!("Authority: {}", state.authority);
        msg!("Oracle calls: {}", state.oracle_calls);
        msg!("Last update slot: {}", state.last_update_slot);
        msg!("Total feeds processed: {}", state.total_feeds_processed);

        Ok(())
    }

    /// Legacy oracle update method for comparison
    /// Shows the difference between managed and manual approaches
    pub fn legacy_oracle_update(ctx: Context<LegacyUpdate>) -> Result<()> {
        let LegacyUpdate { state, oracle, sysvars, payer, .. } = ctx.accounts;

        // Authority check
        require!(
            state.authority == payer.key(),
            ErrorCode::UnauthorizedAccess
        );

        let slot = get_slot(&sysvars.clock);

        anchor_lang::solana_program::log::sol_log_compute_units();

        // Manual oracle update (not recommended for new apps)
        OracleQuote::write_from_ix(&sysvars.instructions, &oracle, slot, 0);

        anchor_lang::solana_program::log::sol_log_compute_units();

        msg!("⚠️  Legacy update completed at slot: {}", slot);
        msg!("💡 Consider using managed updates instead!");

        Ok(())
    }
}

/// Program state for advanced features
#[account]
pub struct ProgramState {
    /// Program authority
    pub authority: Pubkey,
    /// Number of oracle calls made
    pub oracle_calls: u64,
    /// Last update slot
    pub last_update_slot: u64,
    /// Total feeds processed across all calls
    pub total_feeds_processed: u64,
}

/// Initialize program context
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8 + 8 + 8, // discriminator + pubkey + 3 * u64
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Process oracle data context (main instruction)
#[derive(Accounts)]
pub struct ProcessOracleData<'info> {
    /// Program state
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,

    /// Canonical oracle account (derived from feed hashes)
    pub oracle_account: AccountLoader<'info, SwitchboardQuote>,

    /// Switchboard queue
    #[account(address = switchboard_on_demand::default_queue())]
    pub queue: AccountLoader<'info, QueueAccountData>,

    /// System variables
    pub sysvars: Sysvars<'info>,

    /// Transaction authority
    pub authority: Signer<'info>,
}

/// Update authority context
#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,

    pub current_authority: Signer<'info>,
}

/// Get stats context
#[derive(Accounts)]
pub struct GetStats<'info> {
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,
}

/// Legacy update context (for comparison)
#[derive(Accounts)]
pub struct LegacyUpdate<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,

    #[account(
        init_if_needed,
        seeds = [b"legacy_oracle"],
        bump,
        space = SwitchboardQuote::LEN,
        payer = payer
    )]
    pub oracle: AccountLoader<'info, SwitchboardQuote>,

    pub sysvars: Sysvars<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

/// System variables
#[derive(Accounts)]
pub struct Sysvars<'info> {
    pub clock: Sysvar<'info, Clock>,
    pub slothashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}

/// Custom error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
}