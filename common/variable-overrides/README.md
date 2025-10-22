# Variable Overrides

Chain-agnostic examples demonstrating Switchboard's variable override functionality for secure credential management in oracle feeds.

## What are Variable Overrides?

Variable overrides allow you to inject secrets (API keys, auth tokens) into oracle job definitions without exposing them publicly. This enables:

- ✅ **Secure credential management** - API keys never appear in on-chain data
- ✅ **Feed verifiability** - Data sources and extraction logic remain public and verifiable
- ✅ **Simple implementation** - Standard environment variable patterns
- ✅ **Chain-agnostic** - Works identically on Solana, EVM, and Sui

## Security Best Practices

### ✅ Safe Uses (Recommended)

Use variables **only** for authentication and authorization:

```typescript
{
  httpTask: {
    // ✅ Everything hardcoded except API key
    url: "https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${OPEN_WEATHER_API_KEY}&units=metric",
    method: "GET"
  }
}
```

Multiple authentication headers:
```typescript
{
  httpTask: {
    url: "https://api.polygon.io/v2/last/trade/AAPL", // ✅ Hardcoded symbol
    headers: [
      { key: "Authorization", value: "Bearer ${AUTH_TOKEN}" },
      { key: "X-API-Key", value: "${API_KEY}" }
    ]
  }
}
```

### ❌ Dangerous Uses (Never Do This)

**Never** use variables for data selection or logic:

```typescript
// ❌ DON'T: Variable base URL
url: "${BASE_URL}/api/data"

// ❌ DON'T: Variable data selection
url: "https://api.example.com/price?symbol=${SYMBOL}"

// ❌ DON'T: Variable JSON path
jsonParseTask: {
  path: "$.${DATA_KEY}.price"
}
```

**Why?** These patterns make feeds unverifiable. Users can't independently verify what data the oracle is fetching.

## Quick Start

### Prerequisites

```bash
# Install dependencies (from repository root)
npm install
# or
bun install
```

### Environment Setup

Create a `.env` file in the repository root:

```bash
# Required: For Polygon.io stock price example
POLYGON_API_KEY=your_key_here
```

Get your API key from: https://polygon.io/

### Run Example

```bash
# From common/variable-overrides directory
POLYGON_API_KEY=your_key bun run testVariableOverrides.ts

# From repository root
POLYGON_API_KEY=your_key bun run common/variable-overrides/testVariableOverrides.ts
```

## Example Output

```
🧪 Variable Overrides Example

📊 Fetching AAPL stock price from Polygon.io
🔐 Using variable override for API authentication

📋 Job Definition:
{
  "tasks": [
    {
      "httpTask": {
        "url": "https://api.polygon.io/v2/last/trade/AAPL",
        "method": "GET",
        "headers": [
          {
            "key": "Authorization",
            "value": "Bearer ${POLYGON_API_KEY}"
          }
        ]
      }
    },
    {
      "jsonParseTask": {
        "path": "$.results[0].p"
      }
    }
  ]
}

🔑 Variable Override: POLYGON_API_KEY = *** (hidden)
🎯 Target: AAPL (hardcoded symbol)

⚡ Simulating feed with Crossbar...
✅ Success!

💰 AAPL Price: 178.42

🔑 Key Takeaways:
  ✅ Variable used ONLY for API key (authorization header)
  ✅ Data source and symbol are hardcoded (verifiable)
  ✅ JSON path is hardcoded (verifiable extraction)
  ✅ Works identically on Solana, EVM, and Sui
```

## How It Works

1. **Define Job with Variables**: Use `${VARIABLE_NAME}` placeholders in job definitions
   ```typescript
   const job = OracleJob.fromObject({
     tasks: [{
       httpTask: {
         url: "https://api.example.com/data?key=${API_KEY}"
       }
     }]
   });
   ```

2. **Simulate with Overrides**: Pass variables when simulating
   ```typescript
   const result = await crossbarClient.simulateFeed(
     [job],
     { API_KEY: process.env.API_KEY }
   );
   ```

3. **Use On-Chain**: When fetching oracle quotes, pass the same overrides
   - Solana: Add to `fetchUpdateMany` options
   - EVM: Add to contract call parameters
   - Sui: Add to transaction builder options

## Chain-Specific Integration

### Solana

```typescript
import { Oracle } from "@switchboard-xyz/on-demand";

const oracle = new Oracle({ ... });
const response = await oracle.fetchUpdateMany({
  feeds: [feedConfig],
  variableOverrides: {
    API_KEY: process.env.API_KEY
  }
});
```

See: `../solana/examples/` for complete Solana examples

### EVM

```solidity
// Contract receives pre-fetched oracle data
// Variables resolved before on-chain submission
```

See: `../evm/` for complete EVM examples

### Sui

```typescript
import { Aggregator } from "@switchboard-xyz/sui-sdk";

const response = await Aggregator.fetchUpdateTx(
  sb,
  feedId,
  tx,
  {
    variableOverrides: {
      API_KEY: process.env.API_KEY
    }
  }
);
```

See: `../sui/examples/` for complete Sui examples

## Use Cases

### Financial Data (Primary Example)
```typescript
// ✅ API key in Authorization header, symbol hardcoded
{
  httpTask: {
    url: "https://api.polygon.io/v2/last/trade/AAPL",
    headers: [
      { key: "Authorization", value: "Bearer ${POLYGON_API_KEY}" }
    ]
  }
}
```

### Other Real-World Examples

**Weather Data:**
```typescript
// ✅ API key in query param, location hardcoded
url: "https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${API_KEY}"
```

**Sports Scores:**
```typescript
// ✅ API key in query param, game ID hardcoded
url: "https://api.espn.com/v1/game/12345?apiKey=${ESPN_API_KEY}"
```

**Social Media:**
```typescript
// ✅ Bearer token in header, user ID hardcoded
headers: [{ key: "Authorization", value: "Bearer ${TWITTER_TOKEN}" }]
```

## Troubleshooting

### Missing Environment Variables

If you see errors about missing environment variables, ensure your `.env` file contains the API key:

```bash
# Check your .env file
cat .env

# Verify environment variable is loaded
echo $POLYGON_API_KEY

# Or run with inline environment variable
POLYGON_API_KEY=your_key bun run testVariableOverrides.ts
```

### Variable Name Mismatches

Variables are **case-sensitive** and must match exactly:

```typescript
// Job uses: "${API_KEY}"
// Override must use: "API_KEY": "value" ✅
// NOT: "api_key": "value" ❌
```

### Testing API Endpoints

Test the Polygon.io API manually before using it in jobs:

```bash
# Test Polygon.io API with Bearer token
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://api.polygon.io/v2/last/trade/AAPL"

# Check the response structure
# Should return JSON with: {"results": [{"p": 178.42, ...}]}
```

## Documentation

- [Variable Overrides Documentation](https://docs.switchboard.xyz/switchboard/readme/designing-feeds/data-feed-variable-overrides)
- [Oracle Job Configuration](https://protos.docs.switchboard.xyz/protos/OracleJob)
- [Switchboard On-Demand Feeds](https://docs.switchboard.xyz/product-documentation/data-feeds)
- [Feed Builder](https://explorer.switchboardlabs.xyz/feed-builder)

## Why Chain-Agnostic?

Variable overrides work at the oracle job level, not the blockchain level:

1. **Same job definition** across all chains
2. **Same variable syntax** (`${VARIABLE}`)
3. **Same security model** (only auth uses variables)
4. **Same testing approach** (Crossbar simulation)

The only difference is how you integrate the oracle quotes into your smart contract - that's blockchain-specific, but the variable override mechanism is identical.
