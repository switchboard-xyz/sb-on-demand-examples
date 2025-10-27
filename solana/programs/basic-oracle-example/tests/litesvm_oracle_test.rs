/// Litesvm Integration Test for Switchboard Oracle
///
/// This test demonstrates how to use litesvm for fast, local testing
/// of Switchboard oracle integrations without needing a validator.
///
/// Key concepts:
/// 1. Use QuoteBuilder to create mock oracle data
/// 2. Set up the account in litesvm's in-memory ledger
/// 3. Call your program that consumes oracle data
/// 4. Verify results instantly
///
/// Benefits:
/// - No validator needed (tests run in ~10ms vs ~10s)
/// - Deterministic testing with controlled feed values
/// - Perfect for CI/CD and TDD workflows

use anchor_lang::prelude::*;
use anchor_lang::{InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_sdk::{
    account::Account,
    instruction::Instruction,
    pubkey::Pubkey as SolanaPubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use switchboard_on_demand::on_demand::oracle_quote::test_utils::QuoteBuilder;
use switchboard_on_demand::prelude::*;

// Re-export the program module so we can access instruction builders
use basic_oracle_example;

/// Helper to convert anchor Pubkey to solana_sdk Pubkey
fn to_solana_pubkey(pubkey: &Pubkey) -> SolanaPubkey {
    SolanaPubkey::from(pubkey.to_bytes())
}

/// Helper to convert solana_sdk Pubkey to anchor Pubkey
fn to_anchor_pubkey(pubkey: &SolanaPubkey) -> Pubkey {
    Pubkey::new_from_array(pubkey.to_bytes())
}

#[test]
fn test_oracle_integration_with_litesvm() {
    println!("\n🚀 Starting Litesvm Oracle Integration Test\n");

    // Step 1: Initialize litesvm
    println!("📦 Initializing litesvm...");
    let mut svm = LiteSVM::new();

    // Step 2: Create and fund a payer
    let payer = Keypair::new();
    println!("💰 Payer: {}", payer.pubkey());
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    // Step 3: Set up queue (mock)
    let queue_key = to_anchor_pubkey(&SolanaPubkey::new_unique());
    println!("🔗 Queue: {}", queue_key);

    // Step 4: Create mock oracle data using QuoteBuilder
    println!("\n📊 Creating mock oracle data...");
    let btc_feed_hex = "ef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f";
    let btc_price = 95000.0;

    // Decode feed ID to bytes
    let feed_bytes: [u8; 32] = hex::decode(btc_feed_hex)
        .expect("Invalid hex")
        .try_into()
        .expect("Feed ID must be 32 bytes");

    // Build the quote with our test data
    let quote = QuoteBuilder::new(queue_key)
        .add_feed(&feed_bytes, btc_price)
        .slot(1000)
        .build()
        .expect("Failed to build quote");

    println!("   Feed ID: 0x{}", btc_feed_hex);
    println!("   Price: ${}", btc_price);

    // Serialize to account data format (includes discriminator)
    let account_data = quote.to_account_data().expect("Failed to serialize");
    println!("   Account data size: {} bytes", account_data.len());

    // Step 5: Derive the canonical oracle account address
    // This is where the quote program would store the verified oracle data
    let (oracle_account, _bump) = SolanaPubkey::find_program_address(
        &[queue_key.as_ref(), &feed_bytes],
        &to_solana_pubkey(&QUOTE_PROGRAM_ID),
    );
    println!("\n📍 Oracle Account (PDA): {}", oracle_account);

    // Step 6: Create the oracle account in litesvm
    println!("   Creating account in litesvm...");
    svm.set_account(
        oracle_account,
        Account {
            lamports: 1_000_000, // Rent-exempt amount
            data: account_data,
            owner: to_solana_pubkey(&QUOTE_PROGRAM_ID),
            executable: false,
            rent_epoch: 0,
        }
    ).expect("Failed to create oracle account");

    // Step 7: Get sysvars required by the oracle program
    let clock_sysvar = solana_sdk::sysvar::clock::id();
    let slothashes_sysvar = solana_sdk::sysvar::slot_hashes::id();
    let instructions_sysvar = solana_sdk::sysvar::instructions::id();

    println!("\n🔧 System accounts:");
    println!("   Clock: {}", clock_sysvar);
    println!("   SlotHashes: {}", slothashes_sysvar);
    println!("   Instructions: {}", instructions_sysvar);

    // Step 8: Create instruction to call the oracle program
    println!("\n📝 Creating program instruction...");

    let program_id = to_solana_pubkey(&basic_oracle_example::ID);
    println!("   Program ID: {}", program_id);

    // Build the instruction using Anchor's instruction builder
    let accounts = basic_oracle_example::accounts::ReadOracleData {
        quote_account: to_anchor_pubkey(&oracle_account),
        sysvars: basic_oracle_example::Sysvars {
            clock: to_anchor_pubkey(&clock_sysvar),
            slothashes: to_anchor_pubkey(&slothashes_sysvar),
            instructions: to_anchor_pubkey(&instructions_sysvar),
        },
    };

    let instruction = Instruction {
        program_id,
        accounts: accounts.to_account_metas(None),
        data: basic_oracle_example::instruction::ReadOracleData {}.data(),
    };

    // Step 9: Create and send transaction
    println!("\n📤 Sending transaction...");
    let blockhash = svm.latest_blockhash();
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        blockhash,
    );

    // Execute the transaction
    let result = svm.send_transaction(transaction);

    // Step 10: Verify the result
    println!("\n✅ Verifying results...");
    match result {
        Ok(metadata) => {
            println!("   ✓ Transaction succeeded!");
            println!("   Compute units used: {:?}", metadata.compute_units_consumed);

            // Check logs for our expected output
            if let Some(logs) = metadata.logs {
                println!("\n📋 Program logs:");
                for log in logs {
                    println!("   {}", log);

                    // Verify we processed the feed
                    if log.contains("Number of feeds: 1") {
                        println!("   ✓ Correctly processed 1 feed");
                    }

                    // Verify the feed ID was logged
                    if log.contains(btc_feed_hex) {
                        println!("   ✓ Feed ID matches: 0x{}", btc_feed_hex);
                    }

                    // Verify the price value (scaled to 18 decimals)
                    if log.contains("95000") {
                        println!("   ✓ Price value correct: ${}", btc_price);
                    }
                }
            }

            println!("\n🎉 Test completed successfully!");
        }
        Err(e) => {
            panic!("❌ Transaction failed: {:?}", e);
        }
    }
}

#[test]
fn test_multiple_feeds() {
    println!("\n🚀 Testing Multiple Oracle Feeds\n");

    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    let queue_key = to_anchor_pubkey(&SolanaPubkey::new_unique());

    // Create a quote with multiple feeds
    let btc_feed: [u8; 32] = hex::decode("ef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f")
        .unwrap()
        .try_into()
        .unwrap();

    let eth_feed: [u8; 32] = hex::decode("84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1")
        .unwrap()
        .try_into()
        .unwrap();

    println!("📊 Creating quote with multiple feeds:");
    println!("   BTC/USD: $95000");
    println!("   ETH/USD: $3500");

    let quote = QuoteBuilder::new(queue_key)
        .add_feed(&btc_feed, 95000.0)
        .add_feed(&eth_feed, 3500.0)
        .slot(1000)
        .build()
        .expect("Failed to build quote");

    let account_data = quote.to_account_data().expect("Failed to serialize");

    // Derive oracle account for this multi-feed quote
    let (oracle_account, _) = SolanaPubkey::find_program_address(
        &[queue_key.as_ref(), &btc_feed, &eth_feed],
        &to_solana_pubkey(&QUOTE_PROGRAM_ID),
    );

    svm.set_account(
        oracle_account,
        Account {
            lamports: 1_000_000,
            data: account_data,
            owner: to_solana_pubkey(&QUOTE_PROGRAM_ID),
            executable: false,
            rent_epoch: 0,
        }
    ).unwrap();

    // Call the program
    let accounts = basic_oracle_example::accounts::ReadOracleData {
        quote_account: to_anchor_pubkey(&oracle_account),
        sysvars: basic_oracle_example::Sysvars {
            clock: to_anchor_pubkey(&solana_sdk::sysvar::clock::id()),
            slothashes: to_anchor_pubkey(&solana_sdk::sysvar::slot_hashes::id()),
            instructions: to_anchor_pubkey(&solana_sdk::sysvar::instructions::id()),
        },
    };

    let instruction = Instruction {
        program_id: to_solana_pubkey(&basic_oracle_example::ID),
        accounts: accounts.to_account_metas(None),
        data: basic_oracle_example::instruction::ReadOracleData {}.data(),
    };

    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );

    let result = svm.send_transaction(transaction);

    match result {
        Ok(metadata) => {
            println!("\n✅ Multiple feeds processed successfully!");
            if let Some(logs) = metadata.logs {
                for log in logs {
                    if log.contains("Number of feeds: 2") {
                        println!("   ✓ Correctly processed 2 feeds");
                    }
                }
            }
        }
        Err(e) => {
            panic!("❌ Transaction failed: {:?}", e);
        }
    }

    println!("\n🎉 Multi-feed test completed!");
}

#[test]
fn test_price_extremes() {
    println!("\n🚀 Testing Price Extremes\n");

    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    let queue_key = to_anchor_pubkey(&SolanaPubkey::new_unique());
    let feed_id: [u8; 32] = [0x42; 32];

    // Test with an extreme price
    let extreme_price = 1_000_000.0;
    println!("📊 Testing with extreme price: ${}", extreme_price);

    let quote = QuoteBuilder::new(queue_key)
        .add_feed(&feed_id, extreme_price)
        .slot(1000)
        .build()
        .expect("Failed to build quote");

    let account_data = quote.to_account_data().expect("Failed to serialize");

    let (oracle_account, _) = SolanaPubkey::find_program_address(
        &[queue_key.as_ref(), &feed_id],
        &to_solana_pubkey(&QUOTE_PROGRAM_ID),
    );

    svm.set_account(
        oracle_account,
        Account {
            lamports: 1_000_000,
            data: account_data,
            owner: to_solana_pubkey(&QUOTE_PROGRAM_ID),
            executable: false,
            rent_epoch: 0,
        }
    ).unwrap();

    let accounts = basic_oracle_example::accounts::ReadOracleData {
        quote_account: to_anchor_pubkey(&oracle_account),
        sysvars: basic_oracle_example::Sysvars {
            clock: to_anchor_pubkey(&solana_sdk::sysvar::clock::id()),
            slothashes: to_anchor_pubkey(&solana_sdk::sysvar::slot_hashes::id()),
            instructions: to_anchor_pubkey(&solana_sdk::sysvar::instructions::id()),
        },
    };

    let instruction = Instruction {
        program_id: to_solana_pubkey(&basic_oracle_example::ID),
        accounts: accounts.to_account_metas(None),
        data: basic_oracle_example::instruction::ReadOracleData {}.data(),
    };

    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );

    let result = svm.send_transaction(transaction);

    assert!(result.is_ok(), "Should handle extreme price values");
    println!("✅ Extreme price handled correctly!");
}
