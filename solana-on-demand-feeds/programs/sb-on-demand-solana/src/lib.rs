//! Switchboard On-Demand Solana Program
//! 
//! This program demonstrates how to integrate Switchboard On-Demand oracles
//! into your Solana smart contracts. It provides a reference implementation
//! for verifying and consuming oracle price feeds using bundle verification.
//!
//! # Overview
//!
//! Switchboard On-Demand allows you to fetch oracle prices directly from
//! oracle operators without requiring persistent on-chain feed accounts.
//! This approach:
//! - Reduces transaction costs by ~90%
//! - Eliminates the need for crank turners
//! - Provides instant price updates with sub-second latency
//! - Supports multiple price feeds in a single transaction
//!
//! # Architecture
//!
//! The program uses bundle verification to ensure data authenticity:
//! 1. Oracle operators sign price data off-chain
//! 2. The signed bundle is passed to your program
//! 3. Your program verifies signatures against the oracle queue
//! 4. Verified prices are extracted and used in your logic
//!
//! # Security Model
//!
//! - Oracle signatures are verified using the Switchboard queue account
//! - Slot hashes ensure data freshness (prevents replay attacks)
//! - Multiple oracle signatures can be required for consensus
//! - All verification happens on-chain for trustless operation

use anchor_lang::prelude::*;
use switchboard_on_demand::QueueAccountData;
use switchboard_on_demand::BundleVerifierBuilder;
use switchboard_on_demand::sysvar::{SlotHashes, Instructions};
use faster_hex::hex_string;

/// Program ID for the Switchboard On-Demand Solana example
/// This should be replaced with your own program ID in production
declare_id!("2uGHnRkDsupNnicE3btnqJbpus7DWKuniZcRmKAzHFv5");

/// Main program module containing all instruction handlers
#[program]
pub mod sb_on_demand_solana {
    use super::*;

    /// Verifies and processes a Switchboard oracle bundle
    /// 
    /// This instruction demonstrates the complete flow for consuming
    /// Switchboard On-Demand price feeds in your Solana program.
    /// 
    /// # Arguments
    /// 
    /// * `ctx` - The instruction context containing required accounts
    /// * `bundle` - The raw bundle bytes containing signed oracle data
    /// 
    /// # Account Requirements
    /// 
    /// - `queue`: The Switchboard queue account containing oracle keys
    /// - `slothashes`: System sysvar for freshness verification
    /// - `instructions`: System sysvar for instruction introspection
    /// 
    /// # Bundle Format
    /// 
    /// The bundle contains:
    /// - Oracle signatures (Secp256k1)
    /// - Feed hashes identifying the price feeds
    /// - Price values as signed 128-bit integers
    /// - Metadata including slot and timestamp
    /// 
    /// # Example Usage
    /// 
    /// ```typescript
    /// // Client-side code
    /// const bundle = await fetchBundle(["BTC/USD", "ETH/USD"]);
    /// await program.methods
    ///   .test(bundle)
    ///   .accounts({
    ///     queue: queueAccount,
    ///     slothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    ///     instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    ///   })
    ///   .rpc();
    /// ```
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Bundle verification fails (invalid signatures)
    /// - Bundle is too stale (old slot hash)
    /// - Required accounts are missing or invalid
    pub fn test<'a>(ctx: Context<Ctx>, bundle: Vec<u8>) -> Result<()> {
        // Extract accounts from the context
        let Ctx { queue, slothashes, instructions } = ctx.accounts;
        
        // Build and verify the oracle bundle
        // This performs several critical security checks:
        // 1. Verifies oracle signatures match the queue's authorized signers
        // 2. Checks the bundle's slot hash exists in recent slot hashes
        // 3. Ensures the bundle hasn't been tampered with
        let verified_bundle = BundleVerifierBuilder::new()
            .queue(&queue.to_account_info())
            .slothash_sysvar(&slothashes.to_account_info())
            .ix_sysvar(&instructions.to_account_info())
            .bundle(bundle.as_slice())
            .verify()
            .unwrap();
        
        // Check data freshness by calculating slots elapsed since signing
        // This helps ensure you're using recent price data
        let clock = Clock::get()?;
        let slots_since_sign = verified_bundle.slots_stale(&clock);
        msg!("Slots since sign: {}", slots_since_sign);
        
        // Extract and process each verified price feed
        // Each feed_info contains:
        // - feed_id: A unique hash identifying the price feed
        // - value: The price as a signed 128-bit integer
        // - Additional metadata like timestamp
        for feed_info in verified_bundle.feed_infos {
            msg!("Feed hash: {}", hex_string(&feed_info.feed_id()));
            msg!("Feed value: {}", feed_info.value());
            
            // In a real application, you would:
            // 1. Match feed_id against expected price feeds
            // 2. Apply the price value to your business logic
            // 3. Consider implementing price staleness checks
        }
        
        Ok(())
    }
}

/// Accounts required for bundle verification
/// 
/// This struct defines all accounts needed to verify and consume
/// Switchboard On-Demand oracle data. Each account serves a specific
/// purpose in the verification process.
#[derive(Accounts)]
pub struct Ctx<'info> {
    /// The Switchboard queue account containing oracle public keys
    /// 
    /// This account stores:
    /// - List of authorized oracle signers
    /// - Queue configuration parameters
    /// - Security settings for the oracle network
    /// 
    /// The queue must be initialized and contain at least one oracle
    pub queue: AccountLoader<'info, QueueAccountData>,
    
    /// System sysvar containing recent slot hashes
    /// 
    /// Used to verify bundle freshness and prevent replay attacks.
    /// The bundle must include a slot hash that exists in this sysvar,
    /// ensuring the data was signed recently (within ~150 slots).
    pub slothashes: Sysvar<'info, SlotHashes>,
    
    /// System sysvar containing the current transaction's instructions
    /// 
    /// Used for instruction introspection to ensure the bundle
    /// verification happens in the expected context. This prevents
    /// certain types of program composition attacks.
    pub instructions: Sysvar<'info, Instructions>,
}
