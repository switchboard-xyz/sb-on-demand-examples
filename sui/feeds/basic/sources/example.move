#[allow(unused_use)]
/// # Switchboard Oracle Quote Consumer Example
/// 
/// This module demonstrates how to securely integrate Switchboard's on-demand oracle data
/// into your Sui Move contracts using the Quote Verifier pattern.
/// 
/// ## What is the Quote Verifier?
/// 
/// The Quote Verifier is a security-critical component that:
/// - Ensures price data is recent and not stale (and can't be gamed by submitting old data)
/// - Manages quote history and prevents replay attacks
/// - Enables custom validation logic (price deviation limits, staleness checks, etc.)
/// 
/// ## Why Use It?
/// 
/// It checks the queue id, which is a unique identifier for the oracle queue that the oracles are on. 
/// Anybody can make one, so it's essential that this isn't tampered with.
/// It just handles timestamp and slot checks for you so that stale data can't be used. 
/// This protects your DeFi protocol from simple price manipulation attacks, but you can easily do this yourself by keeping track of that data.
/// 
/// ## How It Works
/// 
/// 1. **Create a QuoteConsumer**: Initialize with a Quote Verifier tied to an oracle queue 
/// 2. **Fetch Oracle Data**: Use the SDK to get signed price data from multiple oracles
/// 3. **Verify & Validate**: The verifier checks signatures, freshness, and custom rules
/// 4. **Use Verified Data**: Access the validated price for your business logic
/// 
/// ## Example Use Cases
/// 
/// - Lending protocols: Get collateral prices for liquidation checks
/// - DEXs: Price oracles for trading pairs  
/// - Options protocols: Spot prices for settlement
/// - Prediction markets: Real-world event outcomes

module example::example;

use sui::clock::Clock;
use sui::event;
use switchboard::quote::{QuoteVerifier, Quotes};
use switchboard::decimal::Decimal;

// ========== Error Codes ==========

/// Error when quote data is invalid or not found
#[error]
const EInvalidQuote: vector<u8> = b"Invalid quote data";

/// Error when quote data is too old (stale)
#[error]
const EQuoteExpired: vector<u8> = b"Quote data is expired";

/// Error when price change exceeds configured deviation threshold
#[error]
const EPriceDeviationTooHigh: vector<u8> = b"Price deviation exceeds threshold";

// ========== Structs ==========

/// QuoteConsumer - Your Oracle Data Consumer
/// 
/// This struct manages oracle price data with built-in security features:
/// - `quote_verifier`: Verifies oracle signatures and manages quote storage
/// - `last_price`: The most recent verified price
/// - `last_update_time`: Timestamp of the last update (for freshness checks)
/// - `max_age_ms`: Maximum age for valid quotes (custom staleness threshold)
/// - `max_deviation_bps`: Maximum price deviation allowed (prevents manipulation)
/// 
/// The QuoteConsumer is a shared object, meaning anyone can read it, but only
/// your contract logic controls when prices are updated.
public struct QuoteConsumer has key {
    id: UID,
    quote_verifier: QuoteVerifier,
    last_price: Option<Decimal>,
    last_update_time: u64,
    max_age_ms: u64,
    max_deviation_bps: u64, // basis points (1% = 100 bps)
}

/// Event emitted when price is updated
public struct PriceUpdated has copy, drop {
    feed_hash: vector<u8>,
    old_price: Option<u128>,
    new_price: u128,
    timestamp: u64,
    num_oracles: u64,
}

/// Event emitted when quote validation fails
public struct QuoteValidationFailed has copy, drop {
    feed_hash: vector<u8>,
    reason: vector<u8>,
    timestamp: u64,
}

// ========== Public Functions ==========

/// Initialize a QuoteConsumer with a Quote Verifier
/// 
/// # Arguments
/// * `queue` - The Switchboard oracle queue ID to use for verification
/// * `max_age_ms` - Maximum age for valid quotes in milliseconds (e.g., 300000 = 5 minutes)
/// * `max_deviation_bps` - Maximum price deviation in basis points (e.g., 1000 = 10%)
/// * `ctx` - Transaction context
/// 
/// # Returns
/// A new QuoteConsumer instance with an embedded Quote Verifier
/// 
/// # Example
/// ```
/// let consumer = init_quote_consumer(
///     queue_id,
///     300_000,  // 5 minute max age
///     1000,     // 10% max deviation
///     ctx
/// );
/// ```
public fun init_quote_consumer(
    queue: ID,
    max_age_ms: u64,
    max_deviation_bps: u64,
    ctx: &mut TxContext
): QuoteConsumer {
    let verifier = switchboard::quote::new_verifier(ctx, queue);
    
    QuoteConsumer {
        id: object::new(ctx),
        quote_verifier: verifier,
        last_price: option::none(),
        last_update_time: 0,
        max_age_ms,
        max_deviation_bps,
    }
}

/// Create and share a QuoteConsumer
/// 
/// This is the recommended entry point. It creates a QuoteConsumer and makes it
/// a shared object so anyone can read it (but only your contract logic can update it).
/// 
/// # Arguments  
/// * `queue` - The Switchboard oracle queue ID
/// * `max_age_ms` - Maximum quote age in milliseconds
/// * `max_deviation_bps` - Maximum price deviation in basis points
/// * `ctx` - Transaction context
public fun create_quote_consumer(
    queue: ID,
    max_age_ms: u64,
    max_deviation_bps: u64,
    ctx: &mut TxContext
) {
    let consumer = init_quote_consumer(queue, max_age_ms, max_deviation_bps, ctx);
    transfer::share_object(consumer);
}

/// Update price using Switchboard oracle quotes
/// 
/// This is the core function that demonstrates the Quote Verifier in action.
/// It performs multiple security checks before accepting new price data:
/// 
/// 1. **Signature Verification**: Ensures data comes from authorized oracles
/// 2. **Freshness Check**: Rejects data older than 10 seconds
/// 3. **Deviation Check**: Prevents sudden price jumps (configurable threshold)
/// 4. **Quote Storage**: Only updates if newer data arrives
/// 
/// # Arguments
/// * `consumer` - The QuoteConsumer to update
/// * `quotes` - Signed oracle data from Switchboard (fetched via SDK)
/// * `feed_hash` - The feed identifier (e.g., BTC/USD feed hash)
/// * `clock` - Sui's clock object for timestamp validation
/// 
/// # Security Guarantees
/// - Oracle signatures are cryptographically verified
/// - Only fresh data (< 10 seconds old) is accepted
/// - Price manipulation attempts are detected and rejected
/// - All updates are logged via events
/// 
/// # Example
/// ```
/// // Fetch signed data from oracles (done off-chain via SDK)
/// let quotes = fetch_oracle_data(feed_hash);
/// 
/// // Verify and update (done on-chain)
/// update_price(&mut consumer, quotes, feed_hash, &clock);
/// ```
public fun update_price(
    consumer: &mut QuoteConsumer,
    quotes: Quotes,
    feed_hash: vector<u8>,
    clock: &Clock,
) {
    // STEP 1: Verify that oracles are on the right queue + write the new slotnum & timestamp to the quote verifier
    // This ensures the data comes from legitimate Switchboard oracles
   consumer.quote_verifier.verify_quotes(&quotes, clock);
    
    // STEP 2: Check if the feed exists in the verified quotes
    assert!(consumer.quote_verifier.quote_exists(*& feed_hash), EInvalidQuote);

    // STEP 3: Get the verified quote
    let quote = consumer.quote_verifier.get_quote(*& feed_hash);

    // STEP 4: Ensure the quote is fresh (within 10 seconds)
    // This prevents using stale oracle data
    assert!(quote.timestamp_ms() + 10000 > clock.timestamp_ms(), EQuoteExpired);
    
    // STEP 5: Extract the price value
    let new_price = quote.result();
    
    // STEP 6: Validate price deviation (if we have a previous price)
    // This prevents accepting manipulated data with sudden price jumps
    if (consumer.last_price.is_some()) {
        let last_price = *consumer.last_price.borrow();
        validate_price_deviation(&last_price, &new_price, consumer.max_deviation_bps);
    };
    
    // Store the old price for the event
    let old_price_value = if (consumer.last_price.is_some()) {
        option::some(consumer.last_price.borrow().value())
    } else {
        option::none()
    };
    
    // STEP 7: Update the stored price and timestamp
    consumer.last_price = option::some(new_price);
    consumer.last_update_time = quote.timestamp_ms();
    
    // STEP 8: Emit event for transparency
    event::emit(PriceUpdated {
        feed_hash,
        old_price: old_price_value,
        new_price: new_price.value(),
        timestamp: quote.timestamp_ms(),
        num_oracles: quotes.oracles().length(),
    });
}

/// Get the current price (if available)
public fun get_current_price(consumer: &QuoteConsumer): Option<Decimal> {
    consumer.last_price
}

/// Get the last update time
public fun get_last_update_time(consumer: &QuoteConsumer): u64 {
    consumer.last_update_time
}

/// Check if the current price is fresh (within max age)
public fun is_price_fresh(consumer: &QuoteConsumer, clock: &Clock): bool {
    if (consumer.last_update_time == 0) {
        return false
    };
    
    let current_time = clock.timestamp_ms();
    current_time - consumer.last_update_time <= consumer.max_age_ms
}

/// Advanced: Update multiple prices in a single transaction
public fun update_multiple_prices(
    consumer: &mut QuoteConsumer,
    quotes: Quotes,
    feed_hashes: vector<vector<u8>>,
    clock: &Clock,
) {
    consumer.quote_verifier.verify_quotes(&quotes, clock);
    let mut i = 0;
    while (i < feed_hashes.length()) {
        let feed_hash = *&feed_hashes[i];
        
        if (consumer.quote_verifier.quote_exists(*& feed_hash)) {
            let quote = consumer.quote_verifier.get_quote(*& feed_hash);
            
            // Validate quote age
            if (quote.timestamp_ms() + 10000 > clock.timestamp_ms()) {
                // Process this quote (simplified for example)
                // In practice, you might store multiple prices or handle them differently
                event::emit(PriceUpdated {
                    feed_hash: copy feed_hash,
                    old_price: option::none(),
                    new_price: quote.result().value(),
                    timestamp: quote.timestamp_ms(),
                    num_oracles: quotes.oracles().length(),
                });
            } else {
                event::emit(QuoteValidationFailed {
                    feed_hash: copy feed_hash,
                    reason: b"Quote expired",
                    timestamp: quote.timestamp_ms(),
                });
            };
        } else {
            event::emit(QuoteValidationFailed {
                feed_hash: copy feed_hash,
                reason: b"Feed not found in quotes",
                timestamp: clock.timestamp_ms(),
            });
        };
        
        i = i + 1;
    };
}

/// Example business logic: Calculate collateral ratio using fresh price
public fun calculate_collateral_ratio(
    consumer: &QuoteConsumer,
    collateral_amount: u64,
    debt_amount: u64,
    clock: &Clock
): u64 {
    // Ensure we have fresh price data
    assert!(is_price_fresh(consumer, clock), EQuoteExpired);
    
    let price = consumer.last_price.borrow();
    let collateral_value = (collateral_amount as u128) * price.value();
    let debt_value = (debt_amount as u128) * 1_000_000_000; // Assuming debt is in base units
    
    // Return collateral ratio as percentage (e.g., 150 = 150%)
    ((collateral_value * 100) / debt_value as u64)
}

/// Example business logic: Check if liquidation is needed
public fun should_liquidate(
    consumer: &QuoteConsumer,
    collateral_amount: u64,
    debt_amount: u64,
    liquidation_threshold: u64, // e.g., 110 = 110%
    clock: &Clock
): bool {
    if (!is_price_fresh(consumer, clock)) {
        return false // Don't liquidate with stale data
    };
    
    let ratio = calculate_collateral_ratio(consumer, collateral_amount, debt_amount, clock);
    ratio < liquidation_threshold
}

// ========== Private Helper Functions ==========

/// Validate that price deviation is within acceptable bounds
fun validate_price_deviation(
    old_price: &Decimal,
    new_price: &Decimal,
    max_deviation_bps: u64
) {
    let old_value = old_price.value();
    let new_value = new_price.value();
    
    // Calculate percentage change in basis points
    let change = if (new_value > old_value) {
        ((new_value - old_value) * 10000) / old_value
    } else {
        ((old_value - new_value) * 10000) / old_value
    };
    
    assert!(change <= (max_deviation_bps as u128), EPriceDeviationTooHigh);
}

// ========== Test Functions ==========

#[test_only]
use sui::test_scenario;
use sui::clock;
use switchboard::decimal;
use switchboard::quote;

#[test]
fun test_quote_consumer_creation() {
    let mut scenario = test_scenario::begin(@0x1);
    let ctx = test_scenario::ctx(&mut scenario);
    
    let queue_id = object::id_from_address(@0x123);
    let consumer = init_quote_consumer(queue_id, 300_000, 1000, ctx); // 5 min max age, 10% max deviation
    
    assert!(consumer.last_price.is_none(), 0);
    assert!(consumer.last_update_time == 0, 1);
    assert!(consumer.max_age_ms == 300_000, 2);
    assert!(consumer.max_deviation_bps == 1000, 3);
    
    // Clean up
    let QuoteConsumer { id, quote_verifier, last_price: _, last_update_time: _, max_age_ms: _, max_deviation_bps: _ } = consumer;
    quote::delete_verifier(quote_verifier);
    object::delete(id);
    test_scenario::end(scenario);
}

#[test]
fun test_collateral_ratio_calculation() {
    let mut scenario = test_scenario::begin(@0x1);
    let ctx = test_scenario::ctx(&mut scenario);
    
    let queue_id = object::id_from_address(@0x123);
    let mut consumer = init_quote_consumer(queue_id, 300_000, 1000, ctx);
    
    // Set a mock price (this would normally come from quotes)
    let mock_price = decimal::new(50_000_000_000, false); // $50,000 with 9 decimals
    consumer.last_price = option::some(mock_price);
    consumer.last_update_time = 1000;
    
    // Create a mock clock
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, 2000); // 1 second later
    
    // Test collateral ratio calculation
    let ratio = calculate_collateral_ratio(&consumer, 2, 1000, &clock); // 2 units collateral, 1000 debt
    
    // Expected: (2 * 50000) / 1000 * 100 = 10000%
    assert!(ratio == 10000, 0);
    
    // Clean up
    clock::destroy_for_testing(clock);
    let QuoteConsumer { id, quote_verifier, last_price: _, last_update_time: _, max_age_ms: _, max_deviation_bps: _ } = consumer;
    quote::delete_verifier(quote_verifier);
    object::delete(id);
    test_scenario::end(scenario);
}

