# Switchboard On-Demand: Variable Overrides Example

This example demonstrates the use of Switchboard's On-Demand Feed using **Variable Overrides**. Variable overrides provide a simple, secure approach for credential management while maintaining feed verifiability.

## 🔧 Variable Overrides

### Advantages:
- ✅ **Simpler Implementation**: No complex infrastructure required
- ✅ **Environment Variable Based**: Standard credential management patterns
- ✅ **Security Best Practices**: Only API keys use variable substitution
- ✅ **Verifiable Feeds**: All data sources and extraction paths are hardcoded
- ✅ **Standard Deployment**: Works with any deployment environment

### Security Model:
Variable overrides follow the [security best practices](https://docs.switchboard.xyz/switchboard/readme/designing-feeds/data-feed-variable-overrides) from Switchboard documentation:

- **✅ Safe Uses**: API keys (`${API_KEY}`) and authentication tokens (`${AUTH_TOKEN}`)
- **❌ Dangerous Uses**: Base URLs, API versions, JSON paths, or any data selection logic

## 🚀 Getting Started

### Prerequisites
Configure the `anchor.toml` file to point to your Solana wallet and cluster (Devnet, Mainnet, etc.).

### Build and Deploy
```bash
anchor build
```

After building, note your program address and insert it in your program `lib.rs` file:
```rust
declare_id!("[YOUR_PROGRAM_ADDRESS]");
```

Rebuild and deploy:
```bash
anchor build
anchor deploy
anchor idl init --filepath target/idl/sb_on_demand_solana.json YOUR_PROGRAM_ADDRESS
```

### Environment Setup
Create a `.env` file with your API credentials:

```bash
# Required for weather API example
OPEN_WEATHER_API_KEY=your_openweather_api_key_here

# Optional for testing examples
TEST_VALUE=12345
AUTH_TOKEN=your_auth_token_here
API_KEY=your_api_key_here
```

Get your OpenWeather API key from: https://openweathermap.org/api

### Install Dependencies
```bash
bun install
```

## 📊 Running Examples

### 1. Main Weather Feed Example
```bash
bun run pull
```
This demonstrates the complete variable override workflow:
- Uses `${OPEN_WEATHER_API_KEY}` for secure API key injection
- Hardcoded weather API endpoint for Aspen, CO
- Verifiable data extraction path (`$.main.temp`)

### 2. Simple Value Test
```bash
TEST_VALUE=100 bun run test-simple
```
Demonstrates basic variable substitution with a simple value task.

### 3. Multi-Authentication Test
```bash
AUTH_TOKEN=your_token API_KEY=your_key bun run test-multi-auth
```
Shows how to handle multiple authentication credentials securely.

## 🔒 Security Best Practices

### ✅ Recommended Patterns

**API Key Only Pattern** (Most Secure):
```typescript
{
  httpTask: {
    // ✅ Everything hardcoded except API key
    url: "https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=${OPEN_WEATHER_API_KEY}&units=metric",
    method: "GET"
  }
}
```

**Multiple Auth Headers**:
```typescript
{
  httpTask: {
    url: "https://api.polygon.io/v2/last/trade/AAPL", // ✅ Hardcoded symbol
    headers: [
      { key: "Authorization", value: "Bearer ${AUTH_TOKEN}" }, // ✅ Auth only
      { key: "X-API-Key", value: "${API_KEY}" }               // ✅ Auth only
    ]
  }
}
```

### ❌ Patterns to Avoid

**Never use variables for**:
- Base URLs: `${BASE_URL}/api/data` ❌
- Data selection: `?symbol=${SYMBOL}` ❌
- JSON paths: `$.${DATA_KEY}.price` ❌
- Any parameter affecting data extraction ❌

## 🎯 Key Benefits

1. **No Complex Infrastructure**: No secrets management system needed
2. **Standard Env Vars**: Uses familiar environment variable patterns
3. **Verifiable Feeds**: Consumers can verify exactly what data is fetched
4. **Secure by Design**: Only authentication uses variable substitution
5. **Easy Testing**: Simple environment variable configuration

## 📚 Related Documentation

- [Variable Overrides Documentation](https://docs.switchboard.xyz/switchboard/readme/designing-feeds/data-feed-variable-overrides)
- [Switchboard On-Demand Feeds](https://docs.switchboard.xyz/product-documentation/data-feeds)
- [Oracle Job Configuration](https://protos.docs.switchboard.xyz/protos/OracleJob)

## 🔄 Implementation Notes

Variable overrides use a simple, straightforward approach:

1. **No Special Infrastructure**: Standard environment variable patterns
2. **Simple Job Definitions**: Use `httpTask` with `${VARIABLE}` placeholders for API keys
3. **Environment Variables**: Use standard `.env` file for credential management
4. **Feed Fetching**: Add `variableOverrides` parameter to feed operations

## 💡 Example Use Cases

- **Weather Data**: API key for OpenWeather, hardcoded location
- **Stock Prices**: API key for financial data, hardcoded symbols
- **Sports Scores**: API key for ESPN, hardcoded game IDs
- **Social Media**: Bearer tokens for Twitter, hardcoded user IDs

## 🔍 Troubleshooting

### Missing Environment Variables
```bash
Error: OPEN_WEATHER_API_KEY environment variable is required
```
**Solution**: Ensure your `.env` file contains all required API keys.

### Variable Name Mismatches
Variables are case-sensitive and must match exactly between job definition and overrides:
```typescript
// Job uses: "${API_KEY}"
// Override must use: "API_KEY": "value" ✅
// NOT: "api_key": "value" ❌
```

### Testing API Endpoints
```bash
# Test your API endpoint manually
curl "https://api.openweathermap.org/data/2.5/weather?q=aspen,us&appid=YOUR_KEY&units=metric"
```