use anchor_lang::prelude::*;
use switchboard_on_demand::accounts::RandomnessAccountData;

declare_id!("B1vzUMwC97q7XKDH45viyH73MPeZAjuB7rwgmaaNW3Ub");

#[program]
pub mod pancake_stacker {
    use super::*;

    /// Initialize a new player state account
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let player_state = &mut ctx.accounts.player_state;
        player_state.authority = ctx.accounts.user.key();
        player_state.stack_height = 0;
        player_state.randomness_account = Pubkey::default();
        player_state.has_pending_flip = false;
        player_state.commit_slot = 0;
        player_state.bump = ctx.bumps.player_state;

        msg!("Player initialized with empty stack");
        Ok(())
    }

    /// Flip a pancake - commits to randomness
    pub fn flip_pancake(
        ctx: Context<FlipPancake>,
        randomness_account: Pubkey,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let player_state = &mut ctx.accounts.player_state;

        // Check no pending flip exists
        require!(!player_state.has_pending_flip, ErrorCode::AlreadyHasPendingFlip);

        // Parse and validate randomness account
        let randomness_data =
            RandomnessAccountData::parse(ctx.accounts.randomness_account_data.data.borrow())
                .map_err(|_| ErrorCode::InvalidRandomnessAccount)?;

        // Check if randomness is fresh (committed in previous slot)
        if randomness_data.seed_slot != clock.slot - 1 {
            msg!("seed_slot: {}", randomness_data.seed_slot);
            msg!("current slot: {}", clock.slot);
            return Err(ErrorCode::RandomnessExpired.into());
        }

        // Make sure randomness is not already revealed
        if randomness_data.get_value(clock.slot).is_ok() {
            return Err(ErrorCode::RandomnessAlreadyRevealed.into());
        }

        // Store the randomness commitment
        player_state.randomness_account = randomness_account;
        player_state.has_pending_flip = true;
        player_state.commit_slot = randomness_data.seed_slot;

        msg!("PANCAKE_FLIP_REQUESTED: stack_height={}", player_state.stack_height);
        Ok(())
    }

    /// Catch the pancake - settles randomness and updates stack
    pub fn catch_pancake(ctx: Context<CatchPancake>) -> Result<()> {
        let clock = Clock::get()?;
        let player_state = &mut ctx.accounts.player_state;

        // Verify player has a pending flip
        require!(player_state.has_pending_flip, ErrorCode::NoPendingFlip);

        // Verify the randomness account matches
        if ctx.accounts.randomness_account_data.key() != player_state.randomness_account {
            return Err(ErrorCode::InvalidRandomnessAccount.into());
        }

        // Parse randomness data
        let randomness_data =
            RandomnessAccountData::parse(ctx.accounts.randomness_account_data.data.borrow())
                .map_err(|_| ErrorCode::InvalidRandomnessAccount)?;

        // Verify seed slot matches commitment
        if randomness_data.seed_slot != player_state.commit_slot {
            return Err(ErrorCode::RandomnessExpired.into());
        }

        // Get the revealed random value
        let revealed_random_value = randomness_data
            .get_value(clock.slot)
            .map_err(|_| ErrorCode::RandomnessNotResolved)?;

        // 2/3 chance (66.67%) to land: value % 3 < 2
        let landed = revealed_random_value[0] % 3 < 2;

        // Clear pending flip
        player_state.has_pending_flip = false;
        player_state.randomness_account = Pubkey::default();

        if landed {
            // Pancake lands! Increment stack
            player_state.stack_height += 1;
            msg!("PANCAKE_LANDED: new_stack_height={}", player_state.stack_height);
        } else {
            // Stack knocked over!
            player_state.stack_height = 0;
            msg!("STACK_KNOCKED_OVER");
        }

        Ok(())
    }
}

// === Accounts ===

#[account]
pub struct PlayerState {
    pub authority: Pubkey,           // Player's wallet (32 bytes)
    pub stack_height: u64,           // Current pancake count (8 bytes)
    pub randomness_account: Pubkey,  // Reference to SB randomness (32 bytes)
    pub has_pending_flip: bool,      // Is there an active flip? (1 byte)
    pub commit_slot: u64,            // Slot when randomness was committed (8 bytes)
    pub bump: u8,                    // PDA bump (1 byte)
}

// === Instructions ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        seeds = [b"playerState", user.key().as_ref()],
        space = 8 + 32 + 8 + 32 + 1 + 8 + 1,
        bump
    )]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlipPancake<'info> {
    #[account(
        mut,
        seeds = [b"playerState", user.key().as_ref()],
        bump = player_state.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub player_state: Account<'info, PlayerState>,
    #[account(constraint = user.key() == player_state.authority @ ErrorCode::Unauthorized)]
    pub user: Signer<'info>,
    /// CHECK: The account's data is validated manually within the handler.
    pub randomness_account_data: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CatchPancake<'info> {
    #[account(
        mut,
        seeds = [b"playerState", user.key().as_ref()],
        bump = player_state.bump
    )]
    pub player_state: Account<'info, PlayerState>,
    /// CHECK: The account's data is validated manually within the handler.
    pub randomness_account_data: AccountInfo<'info>,
    pub user: Signer<'info>,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access attempt.")]
    Unauthorized,
    #[msg("Already have a pending flip.")]
    AlreadyHasPendingFlip,
    #[msg("No pending flip to settle.")]
    NoPendingFlip,
    #[msg("Randomness has already been revealed.")]
    RandomnessAlreadyRevealed,
    #[msg("Randomness has not been resolved yet.")]
    RandomnessNotResolved,
    #[msg("Randomness has expired.")]
    RandomnessExpired,
    #[msg("Invalid randomness account.")]
    InvalidRandomnessAccount,
}
