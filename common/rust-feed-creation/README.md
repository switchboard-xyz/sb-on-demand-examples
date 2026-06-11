# Rust Feed Creation Example

This project demonstrates how to create and simulate Switchboard On-Demand feeds using the Rust `CrossbarClient`. It includes examples for both HTTP fetching and static value tasks, which can be used to verify feed configurations before integrating with the Vulcan Forge API.

## Prerequisites

- Rust (latest stable)
- Internet connection (to reach `https://crossbar.switchboard.xyz`)

## Usage

## Latest SDK Verification

Current Rust SDK:

```toml
switchboard-on-demand = { version = "0.13.0", features = ["client"] }
```

Verified local command:

```bash
cargo check
```

`cargo run` and the integration-style tests still reach live Crossbar endpoints.

### Run the Example
The main program creates a BTC/USD feed, stores it, simulates it, and prints a JSON payload suitable for the Vulcan Forge API.

```bash
cargo run
```

### Run the Tests
The tests verify both an HTTP task (fetching live BTC price) and a static Value task (returning a constant).

```bash
cargo test -- --nocapture
```

## Code Structure

- `src/main.rs`: Contains the logic.
    - `main()`: Runs the example flow.
    - `tests` module: Contains integration tests that hit the live Crossbar endpoints.
