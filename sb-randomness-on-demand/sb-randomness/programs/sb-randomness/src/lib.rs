use anchor_lang::prelude::*;
use switchboard_on_demand::accounts::RandomnessAccountData;

declare_id!("2TKP7rWf1Wg7ec6HEugh3JfcbJeBawKWrjCF5zxEjcfM");

pub fn transfer<'a>(
    system_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    amount: u64,
    seeds: Option<&[&[&[u8]]]> // Use Option to explicitly handle the presence or absence of seeds
) -> Result<()> {
    let amount_needed = amount;
    if amount_needed > from.lamports() {
        msg!("Need {} lamports, but only have {}", amount_needed, from.lamports());
        return Err(ErrorCode::NotEnoughFundsToPlay.into());
    }

    let transfer_accounts = anchor_lang::system_program::Transfer {
        from: from.to_account_info(),
        to: to.to_account_info(),
    };

    let transfer_ctx = match seeds {
        Some(seeds) => CpiContext::new_with_signer(system_program, transfer_accounts, seeds),
        None => CpiContext::new(system_program, transfer_accounts),
    };

    anchor_lang::system_program::transfer(transfer_ctx, amount)
}

#[program]
pub mod sb_randomness {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let player_state = &mut ctx.accounts.player_state;
        player_state.latest_flip_result = false;
        player_state.randomness_account = Pubkey::default(); // Placeholder, will be set in coin_flip
        player_state.wager = 100;
        player_state.bump = ctx.bumps.player_state;
        player_state.allowed_user = ctx.accounts.user.key();

        Ok(())
    }

    // Flip the coin; only callable by the allowed user
    pub fn coin_flip(ctx: Context<CoinFlip>, randomness_account: Pubkey, guess: bool) -> Result<()> {
        let clock = Clock::get()?;
        let player_state = &mut ctx.accounts.player_state;
        // Record the user's guess
        player_state.current_guess = guess;
        let randomness_data = RandomnessAccountData::parse(ctx.accounts.randomness_account_data.data.borrow()).unwrap();

        if randomness_data.seed_slot != clock.slot - 1 {
            msg!("seed_slot: {}", randomness_data.seed_slot);
            msg!("slot: {}", clock.slot);
            return Err(ErrorCode::RandomnessAlreadyRevealed.into());
        }
        // ***
        // IMPORTANT: Remember, in Switchboard Randomness, it's the responsibility of the caller to reveal the randomness.
        // Therefore, the game collateral MUST be taken upon randomness request, not on reveal.
        // ***
        transfer(
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.user.to_account_info(),  // Include the user_account
            ctx.accounts.escrow_account.to_account_info(),
            player_state.wager,
            None,
        )?;

        // Store flip commit
        player_state.randomness_account = randomness_account;

        // Log the result
        msg!("Coin flip initiated, randomness requested.");
        Ok(())
    }

    // Settle the flip after randomness is revealed
    pub fn settle_flip(ctx: Context<SettleFlip>, escrow_bump: u8) -> Result<()> {

        let clock: Clock = Clock::get()?;
        let player_state = &mut ctx.accounts.player_state;
        // call the switchboard on-demand parse function to get the randomness data
        let randomness_data = RandomnessAccountData::parse(ctx.accounts.randomness_account_data.data.borrow()).unwrap();
        // call the switchboard on-demand get_value function to get the revealed random value
        let revealed_random_value = randomness_data.get_value(&clock)
            .map_err(|_| ErrorCode::RandomnessNotResolved)?;

        // Use the revealed random value to determine the flip results
        let randomness_result = revealed_random_value[0] % 2 == 0;

        // Update and log the result
        player_state.latest_flip_result = randomness_result;

        let seed_prefix = b"stateEscrow".as_ref();
        let escrow_seed = &[&seed_prefix[..], &[escrow_bump]];
        let seeds_slice: &[&[u8]] = escrow_seed;
        let binding = [seeds_slice];
        let seeds: Option<&[&[&[u8]]]> = Some(&binding);

        if randomness_result {
            msg!("FLIP_RESULT: Heads");
        } else {
            msg!("FLIP_RESULT: Tails");
        }
        if randomness_result == player_state.current_guess {
            msg!("You win!");
            let rent = Rent::get()?;
            let needed_lamports = player_state.wager * 2 + rent.minimum_balance(ctx.accounts.escrow_account.data_len());
            if needed_lamports > ctx.accounts.escrow_account.lamports() {
                msg!("Not enough funds in treasury to pay out the user. Please try again later");
            } else {
                transfer(
                    ctx.accounts.system_program.to_account_info(),
                    ctx.accounts.escrow_account.to_account_info(), // Transfer from the escrow
                    ctx.accounts.user.to_account_info(), // Payout to the user's wallet
                    player_state.wager * 2, // If the player wins, they get double their wager if the escrow account has enough funds
                    seeds // Include seeds
                )?;
            }
        } else {
            // On lose, we keep the user's initial colletaral and they are
            // allowed to play again.
            msg!("You lose!");
        }

        Ok(())
    }
}

// === Accounts ===
#[account]
pub struct PlayerState {
    allowed_user: Pubkey,
    latest_flip_result: bool, // Stores the result of the latest flip
    randomness_account: Pubkey, // Reference to the Switchboard randomness account
    current_guess: bool, // The current guess
    wager: u64, // The wager amount
    bump: u8,
}

// === Instructions ===
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init,
        payer = user,
        seeds = [b"playerState".as_ref(), user.key().as_ref()],
        space = 8 + 100,
        bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CoinFlip<'info> {
    #[account(mut,
        seeds = [b"playerState".as_ref(), user.key().as_ref()],
        bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    pub user: Signer<'info>,
    /// CHECK: The account's data is validated manually within the handler.
    pub randomness_account_data: AccountInfo<'info>,
    /// CHECK: This is a simple Solana account holding SOL.
    #[account(mut, seeds = [b"stateEscrow".as_ref()], bump)]
    pub escrow_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleFlip<'info> {
    #[account(mut,
        seeds = [b"playerState".as_ref(), user.key().as_ref()],
        bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    /// CHECK: The account's data is validated manually within the handler.
    pub randomness_account_data: AccountInfo<'info>,
     /// CHECK: This is a simple Solana account holding SOL.
    #[account(mut, seeds = [b"stateEscrow".as_ref()], bump )]
    pub escrow_account: AccountInfo<'info>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// === Errors ===
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access attempt.")]
    Unauthorized,
    GameStillActive,
    NotEnoughFundsToPlay,
    RandomnessAlreadyRevealed,
    RandomnessNotResolved,
}

