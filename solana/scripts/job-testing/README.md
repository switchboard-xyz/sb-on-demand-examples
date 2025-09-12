# Job Testing Scripts

This directory contains scripts for testing and experimenting with Switchboard oracle jobs. These tools are designed for developers who want to test job configurations, variable overrides, and oracle responses before integrating into production applications.

## 📋 Scripts Overview

### `runJobWithVariables.ts` - Variable Override Testing ⭐
**Purpose**: Test oracle jobs with dynamic variable substitution

**Key Features**:
- Test job definitions with custom variable overrides
- Validate API key substitution and environment-specific parameters
- Simulate transactions before sending to reduce costs
- Comprehensive error handling and debugging output

**Usage**:
```bash
# Basic job execution with no variables
bun run scripts/job-testing/runJobWithVariables.ts --feed YOUR_FEED_PUBKEY

# Test with API key override
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED_PUBKEY \
  --variables '{"API_KEY": "your-test-key-123"}'

# Multiple variable overrides
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED_PUBKEY \
  --variables '{"API_KEY": "key123", "SYMBOL": "BTCUSD", "ENDPOINT": "https://api.example.com"}' \
  --numSignatures 3 \
  --simulate false
```

**Parameters**:
- `--feed` (required): Feed public key to test
- `--variables` (optional): JSON string of variable overrides
- `--gateway` (optional): Gateway URL (default: internal crossbar)
- `--numSignatures` (optional): Number of oracle signatures to request (default: 3)
- `--simulate` (optional): Whether to simulate (true) or send transaction (false, default: true)

**Variable Examples**:
- API Keys: `'{"API_KEY": "your-secret-key"}'`
- Symbols: `'{"SYMBOL": "BTCUSD", "BASE": "BTC", "QUOTE": "USD"}'`
- Endpoints: `'{"BASE_URL": "https://api.prod.example.com", "VERSION": "v2"}'`
- Environment: `'{"ENV": "production", "TIMEOUT": "30000", "REGION": "us-east-1"}'`

### `runJob.ts` - Legacy Job Definition Testing
**Purpose**: Test custom oracle job definitions with raw job configuration

**Key Features**:
- Define custom Oracle jobs with specific data sources
- Test API integrations (Polygon.io example included)
- Fetch signatures with custom variable overrides
- Low-level oracle response debugging

**Usage**:
```bash
# Run with environment variables
POLYGON_API_KEY=your_key bun run scripts/job-testing/runJob.ts
```

**Job Examples**:
- **Value Job**: Simple value tasks for testing
- **Polygon API Job**: Stock price fetching from Polygon.io
- **Custom HTTP Jobs**: Template for API integrations

## 🧪 Testing Workflow

### 1. **Job Definition Testing**
Use these scripts to validate your oracle job definitions before deploying:

```bash
# Test a simple job configuration
bun run scripts/job-testing/runJob.ts

# Test with production-like variables
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --variables '{"API_KEY": "test-key", "ENV": "staging"}'
```

### 2. **Variable Override Validation**
Ensure your job variables work correctly across different environments:

```bash
# Development environment
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --variables '{"ENV": "dev", "API_KEY": "dev-key-123"}'

# Production environment
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --variables '{"ENV": "prod", "API_KEY": "prod-key-456"}' \
  --simulate false
```

### 3. **Oracle Consensus Testing**
Test different oracle signature requirements:

```bash
# Single oracle (testing only)
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --numSignatures 1

# Production consensus (recommended)
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --numSignatures 3
```

## 🔍 Understanding Variable Substitution

Oracle jobs use `${VARIABLE_NAME}` syntax for dynamic parameters. Common patterns:

### API Authentication
```json
{
  "httpTask": {
    "url": "https://api.example.com/data?key=${API_KEY}",
    "headers": [
      {
        "key": "Authorization", 
        "value": "Bearer ${AUTH_TOKEN}"
      }
    ]
  }
}
```

### Dynamic Endpoints
```json
{
  "httpTask": {
    "url": "${BASE_URL}/${VERSION}/price/${SYMBOL}",
    "method": "GET"
  }
}
```

### Environment Configuration
```json
{
  "httpTask": {
    "url": "https://${ENV}.api.example.com/data",
    "timeout": "${TIMEOUT}"
  }
}
```

## 📊 Output Interpretation

### Successful Response Example
```
🚀 Starting Switchboard job execution with variable overrides...
📋 Using variable overrides: {"API_KEY": "***"}
⚙️ Initializing Switchboard environment...
🔥 Pre-heating lookup tables...
📡 Fetching job signatures with 3 signatures...
⚡ Fetch completed in 245ms
✅ All oracle responses successful!
📦 Building transaction...
🧪 Simulating transaction...
✅ Simulation successful!
💰 Compute units used: 145,234

📈 Execution Summary:
- Feed: AbCd...XyZ
- Gateway: https://internal-crossbar.prod.mrgn.app
- Variables used: 1
- Fetch time: 245ms
- Mode: Simulation
- Variable overrides:
  - API_KEY: your-test-key-123
```

### Error Response Example
```
❌ Error in response: Invalid API key
❌ Simulation failed:
{
  "InstructionError": [
    0,
    {
      "Custom": 6001
    }
  ]
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Invalid Variables**
```
Error parsing variables JSON: Unexpected token
Expected format: '{"API_KEY": "value", "SYMBOL": "BTCUSD"}'
```
**Solution**: Ensure proper JSON format with quoted strings

#### 2. **Missing API Keys**
```
❌ Error in response: Unauthorized
```
**Solution**: Verify API keys are correct and have proper permissions

#### 3. **Stale Bundle**
```
❌ Simulation failed: bundle too stale
```
**Solution**: Bundles expire after ~150 slots. Re-run the command to fetch fresh data

#### 4. **Network Issues**
```
❌ Error running job with variables: fetch failed
```
**Solution**: Check network connectivity and gateway URL

### Debug Mode
Add verbose logging by modifying the gateway URL or using different configurations:

```bash
# Use local gateway for debugging
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --gateway "http://localhost:8082" \
  --variables '{"DEBUG": "true"}'
```

## 📝 Development Tips

### 1. **Start with Simulation**
Always test with `--simulate true` (default) before sending real transactions:

```bash
# Safe testing (default)
bun run scripts/job-testing/runJobWithVariables.ts --feed YOUR_FEED

# Only after validation
bun run scripts/job-testing/runJobWithVariables.ts --feed YOUR_FEED --simulate false
```

### 2. **Use Environment Variables**
Store sensitive data in environment variables:

```bash
# .env file
API_KEY=your-secret-key
POLYGON_API_KEY=your-polygon-key

# Script usage
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --variables '{"API_KEY": "'$API_KEY'"}'
```

### 3. **Incremental Testing**
Test variable substitution incrementally:

```bash
# Step 1: No variables
bun run scripts/job-testing/runJobWithVariables.ts --feed YOUR_FEED

# Step 2: Single variable
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --variables '{"API_KEY": "test-key"}'

# Step 3: Multiple variables
bun run scripts/job-testing/runJobWithVariables.ts \
  --feed YOUR_FEED \
  --variables '{"API_KEY": "test-key", "SYMBOL": "BTCUSD"}'
```

### 4. **Performance Testing**
Measure and optimize oracle response times:

```bash
# Test with different signature counts
for sigs in 1 3 5; do
  echo "Testing with $sigs signatures:"
  bun run scripts/job-testing/runJobWithVariables.ts \
    --feed YOUR_FEED \
    --numSignatures $sigs \
    | grep "Fetch completed"
done
```

## 🔗 Related Scripts

- **Main Feed Scripts**: See `/scripts/feeds/` for production feed operations
- **Streaming Scripts**: See `/scripts/streaming/` for real-time data streaming
- **Benchmarks**: See `/scripts/benchmarks/` for performance testing

## 📚 Additional Resources

- [Switchboard Job Documentation](https://docs.switchboard.xyz/reference/jobs)
- [Variable Substitution Guide](https://docs.switchboard.xyz/guides/variables)
- [Oracle Job Examples](https://github.com/switchboard-xyz/switchboard-v2/tree/main/examples)
- [Discord Support](https://discord.gg/switchboard)

---

**Note**: These testing scripts are designed for development and validation. For production applications, use the optimized scripts in `/scripts/feeds/` and `/scripts/streaming/`.