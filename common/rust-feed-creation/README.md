# Rust Feed Creation Example

This project demonstrates how to create and simulate Switchboard On-Demand feeds using the Rust `CrossbarClient`. It includes examples for both HTTP fetching and static value tasks, which can be used to verify feed configurations before integrating with the Vulcan Forge API.

## Prerequisites

- Rust (latest stable)
- Internet connection (to reach `https://crossbar.switchboard.xyz`)

## Usage

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

## Vulcan Forge API Integration

When integrating with the `Create Feed` endpoint on Vulcan Forge, you can construct the payload using the job definitions shown in this example.

**Example Payload:**
```json
{
  "feed_name": "My Custom Feed",
  "queue": "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w",
  "jobs": [
    {
      "tasks": [
        { "valueTask": { "value": 100 } }
      ]
    }
  ]
}
```

