# Job Testing Scripts

This directory contains scripts for testing and experimenting with Switchboard oracle jobs. These tools are designed for developers who want to test job configurations and oracle responses before integrating into production applications.

## 📋 Scripts Overview

### `runJob.ts` - Oracle Job Definition Testing ⭐

**Purpose**: Test custom oracle job definitions with variable substitution

**Key Features**:
- Define custom Oracle jobs with specific data sources
- Test API integrations with variable overrides
- Fetch signatures directly from oracle consensus
- Low-level oracle response debugging

**Usage**:
```bash
# From the repository root
cd common/job-testing

# Run with environment variables
POLYGON_API_KEY=your_api_key bun run runJob.ts

# Set multiple environment variables
POLYGON_API_KEY=your_key VALUE=12345 bun run runJob.ts
```

## 🧪 Job Examples Included

### 1. **Value Job**
Simple job that returns a static value using variable substitution:
```typescript
{
  tasks: [{
    valueTask: {
      big: "${VALUE}",  // Uses VALUE environment variable
    },
  }],
}
```

### 2. **Polygon API Job**  
Real-world example fetching stock prices from Polygon.io:
```typescript
{
  tasks: [
    {
      httpTask: {
        url: "https://api.polygon.io/v2/last/trade/AAPL?apiKey=${POLYGON_API_KEY}",
        method: "GET",
      }
    },
    {
      jsonParseTask: {
        path: "$.results.p",  // Extract price from response
      }
    }
  ]
}
```

## 🔧 Understanding Variable Substitution

Oracle jobs use `${VARIABLE_NAME}` syntax for dynamic parameters. The script demonstrates:

- **API Authentication**: `${POLYGON_API_KEY}` 
- **Dynamic Values**: `${VALUE}`
- **Environment Variables**: Loaded automatically from process.env

### Common Variable Patterns

```typescript
// API endpoints
"url": "https://api.example.com/v1/price?key=${API_KEY}&symbol=${SYMBOL}"

// Authentication headers  
"headers": [{"key": "Authorization", "value": "Bearer ${AUTH_TOKEN}"}]

// Dynamic values
"big": "${PRICE_MULTIPLIER}"
```

## 🚀 Getting Started

### 1. **Basic Testing**
```bash
# Test the value job with a simple number
cd common/job-testing
VALUE=100 bun run runJob.ts
```

### 2. **API Integration Testing**
```bash
# Test Polygon API integration
cd common/job-testing
POLYGON_API_KEY=your_polygon_key bun run runJob.ts
```

### 3. **Custom Job Development**
Edit `runJob.ts` to add your own job definitions:

```typescript
function getCustomJob(): OracleJob {
  const job = OracleJob.fromObject({
    tasks: [
      {
        httpTask: {
          url: "${BASE_URL}/api/${VERSION}/data?key=${API_KEY}",
          method: "GET",
        }
      },
      {
        jsonParseTask: {
          path: "${JSON_PATH}",
        }
      }
    ]
  });
  return job;
}

// Then use it in main():
const res = await queue.fetchSignaturesConsensus({
  gateway: "http://localhost:8082",
  feedConfigs: [{
    feed: {
      jobs: [getCustomJob()], // Use your custom job
    },
  }],
  numSignatures: 1,
  useEd25519: true,
  variableOverrides: {
    "BASE_URL": process.env.BASE_URL!,
    "VERSION": process.env.VERSION!,
    "API_KEY": process.env.API_KEY!,
    "JSON_PATH": process.env.JSON_PATH!,
  },
});
```

## 📊 Understanding the Output

### Successful Response
```bash
cd common/job-testing
POLYGON_API_KEY=your_key bun run runJob.ts
[
  {
    "value": 150.25,      // The parsed price value
    "timestamp": 1234567, // When the data was fetched
    "oracle": "oracle_pubkey_here"
  }
]
```

### Environment Variable Missing
```bash
cd common/job-testing
bun run runJob.ts
Error: Cannot read property 'POLYGON_API_KEY' of undefined
```

## 🚨 Troubleshooting

### 1. **Missing Environment Variables**
```bash
# Check what variables your job needs
cd common/job-testing
grep '\${' runJob.ts

# Set required variables
POLYGON_API_KEY=your_key VALUE=123 bun run runJob.ts
```

### 2. **API Authentication Errors**
- Verify API keys are correct and active
- Check if API endpoints are accessible
- Ensure proper permissions for the API key

### 3. **Network Issues**
- Check network connectivity to API endpoints
- Verify URLs are correct and accessible
- Consider using a local gateway for testing: `gateway: "http://localhost:8082"`

### 4. **JSON Parsing Errors**
- Verify the JSON path in `jsonParseTask` matches the API response structure
- Test API endpoints manually to understand response format
- Use tools like `curl` to inspect raw API responses

## 🔍 Debugging Tips

### 1. **Inspect API Responses**
Test your API endpoints manually:
```bash
# Test Polygon API
curl "https://api.polygon.io/v2/last/trade/AAPL?apiKey=YOUR_KEY"
```

### 2. **Add Logging**
Modify `runJob.ts` to add debug output:
```typescript
console.log("Variable overrides:", {
  "POLYGON_API_KEY": process.env.POLYGON_API_KEY ? "***" : "MISSING",
});
console.log("Full response:", JSON.stringify(res, null, 2));
```

### 3. **Test Individual Tasks**
Break complex jobs into individual tasks to isolate issues:
```typescript
// Test just the HTTP task
const simpleJob = OracleJob.fromObject({
  tasks: [{
    httpTask: {
      url: "https://api.polygon.io/v2/last/trade/AAPL?apiKey=${POLYGON_API_KEY}",
      method: "GET",
    }
  }]
});
```

## 🛠️ Development Workflow

### 1. **Start Simple**
```bash
# Begin with the value job
cd common/job-testing
VALUE=100 bun run runJob.ts
```

### 2. **Test API Connectivity**
```bash
# Test with real API
cd common/job-testing
API_KEY=your_key bun run runJob.ts
```

### 3. **Validate JSON Parsing**
```bash
# Ensure JSON paths work correctly
curl "your_api_endpoint" | jq ".results.p"  # Test JSON path manually
```

### 4. **Production Testing**
Once working locally, test with production gateway:
```typescript
// In runJob.ts, change gateway to:
gateway: "https://crossbar.switchboard.xyz"
```

## 📚 Job Definition Resources

### Oracle Job Types
- **HttpTask**: Fetch data from HTTP endpoints
- **JsonParseTask**: Extract values from JSON responses  
- **ValueTask**: Return static or calculated values
- **MultiplyTask**: Apply mathematical operations
- **ConditionalTask**: Implement conditional logic

### Example Job Patterns

#### **Cryptocurrency Price**
```typescript
{
  tasks: [
    {
      httpTask: {
        url: "https://api.coinbase.com/v2/exchange-rates?currency=${SYMBOL}",
      }
    },
    {
      jsonParseTask: {
        path: "$.data.rates.USD",
      }
    },
    {
      multiplyTask: {
        scalar: "${PRICE_MULTIPLIER}"
      }
    }
  ]
}
```

#### **Weather Data**
```typescript
{
  tasks: [
    {
      httpTask: {
        url: "https://api.weather.com/v1/current?key=${WEATHER_API_KEY}&location=${LOCATION}",
      }
    },
    {
      jsonParseTask: {
        path: "$.current.temperature",
      }
    }
  ]
}
```

#### **Custom API with Authentication**
```typescript
{
  tasks: [
    {
      httpTask: {
        url: "${BASE_URL}/api/data",
        method: "GET",
        headers: [
          {
            key: "Authorization",
            value: "Bearer ${AUTH_TOKEN}"
          },
          {
            key: "X-API-Version", 
            value: "${API_VERSION}"
          }
        ]
      }
    },
    {
      jsonParseTask: {
        path: "${JSON_PATH}",
      }
    }
  ]
}
```

## 🔗 Related Examples

- **Production Feed Examples**: See `solana/examples/feeds/` for optimized oracle quote operations
- **Streaming Examples**: See `solana/examples/streaming/` for real-time data streaming
- **Benchmarks**: See `solana/examples/benchmarks/` for performance testing
- **Randomness**: See `solana/examples/randomness/` for VRF examples
- **Variable Overrides**: See `solana/examples/variable-overrides/` for credential management

## 📖 Additional Resources

- [Switchboard Job Documentation](https://docs.switchboard.xyz/reference/jobs)
- [Oracle Task Types](https://docs.switchboard.xyz/reference/tasks)
- [Variable Substitution Guide](https://docs.switchboard.xyz/guides/variables)
- [Discord Support](https://discord.gg/switchboard)

---

**Note**: This testing script is designed for development and validation. For production applications, use the optimized examples in `solana/examples/feeds/` and `solana/examples/streaming/`.