use anchor_lang::InstructionData;
use litesvm::LiteSVM;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use switchboard_on_demand::{
    default_queue,
    on_demand::oracle_quote::QuoteBuilder,
    QUOTE_PROGRAM_ID,
};

use basic_oracle_example;

const BTC_FEED: [u8; 32] = [
    0xef, 0x0d, 0x8b, 0x6f, 0xcd, 0x01, 0x04, 0xe3,
    0xe7, 0x50, 0x96, 0x91, 0x2f, 0xc8, 0xe1, 0xe4,
    0x32, 0x89, 0x3d, 0xa4, 0xf1, 0x8f, 0xae, 0xda,
    0xac, 0xca, 0x7e, 0x58, 0x75, 0xda, 0x62, 0x0f,
];

const ETH_FEED: [u8; 32] = [
    0x84, 0xc2, 0xdd, 0xe9, 0x63, 0x3d, 0x93, 0xd1,
    0xbc, 0xad, 0x84, 0xe7, 0xdc, 0x41, 0xc9, 0xd5,
    0x65, 0x78, 0xb7, 0xec, 0x52, 0xfa, 0xbe, 0xdc,
    0x1f, 0x33, 0x5d, 0x67, 0x3d, 0xf0, 0xa7, 0xc1,
];

fn load_program(svm: &mut LiteSVM) {
    let program_id = Pubkey::from(basic_oracle_example::ID.to_bytes());
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let program_path = manifest_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("target/deploy/basic_oracle_example.so");

    assert!(
        program_path.exists(),
        "Program artifact missing at {}. Run `anchor build` before `cargo test`.",
        program_path.display()
    );

    svm.add_program_from_file(program_id, program_path.to_str().unwrap())
        .expect("Failed to load basic_oracle_example program");
}

fn funded_payer(svm: &mut LiteSVM) -> Keypair {
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    payer
}

fn store_quote(
    svm: &mut LiteSVM,
    feeds: &[([u8; 32], f64)],
    quote_slot: u64,
) -> Pubkey {
    let queue_key = default_queue();
    let quote_program_id = Pubkey::from(QUOTE_PROGRAM_ID.to_bytes());

    let mut builder = QuoteBuilder::new(queue_key);
    builder = builder.slot(quote_slot);
    for (feed_id, value) in feeds {
        builder = builder.add_feed(feed_id, *value);
    }

    let quote = builder.build().expect("Failed to build quote");
    let quote_account = Pubkey::new_from_array(
        quote
            .canonical_key(&queue_key, &quote_program_id)
            .to_bytes(),
    );
    let account_data = quote.to_account_data().expect("Failed to serialize quote");

    svm.set_account(
        quote_account,
        Account {
            lamports: 1_000_000,
            data: account_data,
            owner: quote_program_id,
            executable: false,
            rent_epoch: 0,
        },
    )
    .expect("Failed to create quote account");

    quote_account
}

fn read_oracle_data_ix(quote_account: Pubkey) -> Instruction {
    Instruction {
        program_id: Pubkey::from(basic_oracle_example::ID.to_bytes()),
        accounts: vec![
            AccountMeta::new_readonly(quote_account, false),
            AccountMeta::new_readonly(solana_sdk::sysvar::clock::id(), false),
        ],
        data: basic_oracle_example::instruction::ReadOracleData {}.data(),
    }
}

fn print_logs(logs: &[String]) {
    println!("\n📋 Program logs:");
    for log in logs {
        println!("   {}", log);
    }
}

#[test]
fn test_oracle_integration_with_litesvm() {
    println!("\n🚀 Testing single-feed basic oracle integration\n");

    let mut svm = LiteSVM::new();
    load_program(&mut svm);
    let payer = funded_payer(&mut svm);

    svm.warp_to_slot(1000);
    let quote_slot = svm.get_sysvar::<solana_sdk::clock::Clock>().slot;
    let quote_account = store_quote(&mut svm, &[(BTC_FEED, 95_000.0)], quote_slot);

    svm.warp_to_slot(1001);

    let transaction = Transaction::new_signed_with_payer(
        &[read_oracle_data_ix(quote_account)],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );

    match svm.send_transaction(transaction) {
        Ok(metadata) => {
            print_logs(&metadata.logs);
            assert!(metadata.logs.iter().any(|log| log.contains("Feed count: 1")));
            assert!(metadata.logs.iter().any(|log| log.contains("Staleness: 1 slots")));
            assert!(metadata.logs.iter().any(|log| log.contains("Feed ID: ef0d8b6f")));
            assert!(
                metadata
                    .logs
                    .iter()
                    .any(|log| log.contains("Feed value (human-readable): 95000"))
            );
        }
        Err(error) => {
            let litesvm::types::FailedTransactionMetadata { meta, .. } = &error;
            print_logs(&meta.logs);
            panic!("Single-feed oracle integration should succeed: {:?}", error);
        }
    }
}

#[test]
fn test_multiple_feeds_still_uses_feed_zero() {
    println!("\n🚀 Testing multi-feed quote with single-feed basic consumer\n");

    let mut svm = LiteSVM::new();
    load_program(&mut svm);
    let payer = funded_payer(&mut svm);

    svm.warp_to_slot(2000);
    let quote_slot = svm.get_sysvar::<solana_sdk::clock::Clock>().slot;
    let quote_account = store_quote(
        &mut svm,
        &[(BTC_FEED, 95_000.0), (ETH_FEED, 3_500.0)],
        quote_slot,
    );

    let transaction = Transaction::new_signed_with_payer(
        &[read_oracle_data_ix(quote_account)],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );

    match svm.send_transaction(transaction) {
        Ok(metadata) => {
            print_logs(&metadata.logs);
            assert!(metadata.logs.iter().any(|log| log.contains("Feed count: 2")));
            assert!(
                metadata
                    .logs
                    .iter()
                    .any(|log| log.contains("Using feed[0] in this basic example"))
            );
            assert!(metadata.logs.iter().any(|log| log.contains("Feed ID: ef0d8b6f")));
            assert!(
                !metadata.logs.iter().any(|log| {
                    log.contains("84c2dde9") || log.contains("Feed value (human-readable): 3500")
                })
            );
        }
        Err(error) => {
            let litesvm::types::FailedTransactionMetadata { meta, .. } = &error;
            print_logs(&meta.logs);
            panic!("Multi-feed quote should still be readable: {:?}", error);
        }
    }
}

#[test]
fn test_price_extremes() {
    println!("\n🚀 Testing large human-readable values\n");

    let mut svm = LiteSVM::new();
    load_program(&mut svm);
    let payer = funded_payer(&mut svm);

    svm.warp_to_slot(3000);
    let quote_slot = svm.get_sysvar::<solana_sdk::clock::Clock>().slot;
    let quote_account = store_quote(&mut svm, &[([0x42; 32], 1_000_000.0)], quote_slot);

    let transaction = Transaction::new_signed_with_payer(
        &[read_oracle_data_ix(quote_account)],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );

    match svm.send_transaction(transaction) {
        Ok(metadata) => {
            print_logs(&metadata.logs);
            assert!(
                metadata
                    .logs
                    .iter()
                    .any(|log| log.contains("Feed value (human-readable): 1000000"))
            );
        }
        Err(error) => {
            let litesvm::types::FailedTransactionMetadata { meta, .. } = &error;
            print_logs(&meta.logs);
            panic!("Large prices should still be readable: {:?}", error);
        }
    }
}
