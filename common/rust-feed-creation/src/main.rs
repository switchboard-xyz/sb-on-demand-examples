use anyhow::Result;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use switchboard_on_demand_client::CrossbarClient;

#[tokio::main]
async fn main() -> Result<()> {
    // Run the logic
    if let Err(e) = run_example().await {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
    Ok(())
}

async fn run_example() -> Result<()> {
    let crossbar_url = "https://crossbar.switchboard.xyz";
    let client = CrossbarClient::new(crossbar_url, true); // verbose = true

    // Define the Queue (Mainnet default)
    let queue_pubkey = Pubkey::from_str("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w")?;

    // Define the Feed Job (JSON) - Fetch BTC Price
    // Note: This is an IOracleJob wrapped in an OracleFeed (implicitly in v2)
    // For v2 store/simulate, we construct an OracleFeed-like structure.
    let feed_def = serde_json::json!({
        "queue": queue_pubkey.to_string(),
        "jobs": [
            {
                "tasks": [
                    {
                        "httpTask": {
                            "url": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
                        }
                    },
                    {
                        "jsonParseTask": {
                            "path": "$.bitcoin.usd"
                        }
                    }
                ]
            }
        ]
    });

    println!("Feed Definition: {}", serde_json::to_string_pretty(&feed_def)?);

    // Store the Feed Definition (v2)
    println!("\nStoring feed definition on Crossbar (v2)...");
    let store_resp = client.store_oracle_feed(&feed_def).await?;
    
    println!("Store Response:");
    println!("  CID: {}", store_resp.cid);
    println!("  Feed ID: {}", store_resp.feedId);

    // Simulate the Feed (v2)
    println!("\nSimulating feed (v2)...");
    // We can simulate by feed hash (returned as feedId)
    let sim_resp = client.simulate_proto(&store_resp.feedId, false, Some("mainnet")).await?;

    println!("Feed Hash: {:?}", sim_resp.feedHash);
    println!("Results: {:?}", sim_resp.results);
    println!("Logs: {:?}", sim_resp.logs);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_feed_creation_and_simulation_v2() -> Result<()> {
        let crossbar_url = "https://crossbar.switchboard.xyz";
        let client = CrossbarClient::new(crossbar_url, true);
        let queue_pubkey = Pubkey::from_str("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w")?;

        // 1. Test HTTP + JSON Parse Task (BTC Price) using v2 methods
        let feed_def = serde_json::json!({
            "queue": queue_pubkey.to_string(),
            "jobs": [
                {
                    "tasks": [
                        {
                            "httpTask": {
                                "url": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
                            }
                        },
                        {
                            "jsonParseTask": {
                                "path": "$.bitcoin.usd"
                            }
                        }
                    ]
                }
            ]
        });

        println!("Testing V2 Feed Storage...");
        let store_resp = client.store_oracle_feed(&feed_def).await?;
        assert!(!store_resp.feedId.is_empty(), "Feed ID should not be empty");
        assert!(!store_resp.cid.is_empty(), "CID should not be empty");

        println!("Testing V2 Feed Simulation...");
        let sim_resp = client.simulate_proto(&store_resp.feedId, false, Some("mainnet")).await?;
        assert!(!sim_resp.results.is_empty(), "Should return simulation results");
        
        // Results are strings in v2 response
        let result_str = &sim_resp.results[0];
        println!("HTTP Feed Result: {}", result_str);
        let result_dec = rust_decimal::Decimal::from_str(result_str)?;
        assert!(result_dec > rust_decimal::Decimal::ZERO, "BTC price should be positive");

        // 2. Test Value Task (Static Value) using v2
        let value_feed = serde_json::json!({
            "queue": queue_pubkey.to_string(),
            "jobs": [
                {
                    "tasks": [
                        {
                            "valueTask": {
                                "value": 123.45
                            }
                        }
                    ]
                }
            ]
        });

        println!("Testing V2 Value Feed Storage...");
        let val_store_resp = client.store_oracle_feed(&value_feed).await?;
        
        println!("Testing V2 Value Feed Simulation...");
        let val_sim_resp = client.simulate_proto(&val_store_resp.feedId, false, Some("mainnet")).await?;
        let val_result_str = &val_sim_resp.results[0];
        
        println!("Value Feed Result: {}", val_result_str);
        let expected = rust_decimal::Decimal::from_str("123.45")?;
        let actual = rust_decimal::Decimal::from_str(val_result_str)?;
        assert_eq!(actual, expected, "Value task should return exact value");

        Ok(())
    }
}
