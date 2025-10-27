# Common Resources

This directory contains chain-agnostic resources and tools that work across all Switchboard On-Demand blockchain implementations.

## What's Here

### Variable Overrides
The `variable-overrides/` directory demonstrates secure credential management for oracle feeds:
- **`testVariableOverrides.ts`** - Chain-agnostic variable override examples
- **Security best practices** - Only use variables for API keys/auth tokens
- **Full documentation** - See [variable-overrides/README.md](./variable-overrides/README.md)

### Job Testing Tools
The `job-testing/` directory provides tools for testing and developing custom oracle job definitions:
- **`runJob.ts`** - Test oracle jobs with variable substitution and API integrations
- **Chain-agnostic** - Works with Solana, EVM, and Sui
- **Full documentation** - See [job-testing/README.md](./job-testing/README.md)

### Streaming Examples
The `streaming/` directory contains chain-agnostic real-time price streaming examples:
- **`crossbarStream.ts`** - Stream unsigned price updates via WebSocket for UI/monitoring
- **Chain-agnostic** - Works with any blockchain
- **Full documentation** - See [streaming/README.md](./streaming/README.md)

### Twitter Follower Count Example
The `twitter-follower-count/` directory demonstrates fetching social media metrics via authenticated APIs:
- **`getFollowerCount.ts`** - Fetch real-time Twitter/X follower counts using Switchboard oracles
- **Bearer Token authentication** - Simple app-only auth, no OAuth complexity
- **No .env files** - Fully interactive with hidden token input for security
- **Chain-agnostic** - Works across Solana, EVM, Sui, and any supported blockchain
- **Full documentation** - See [twitter-follower-count/README.md](./twitter-follower-count/README.md)

## Why Job Testing is Chain-Agnostic

Oracle job definitions use a universal format that works across all Switchboard-supported chains:
- Same job definition syntax (HttpTask, JsonParseTask, etc.)
- Same variable substitution patterns (`${API_KEY}`)
- Same oracle consensus mechanism
- Only the final oracle quote verification differs by chain

This means you can:
1. **Design once, deploy everywhere** - Test your job definition here, use it on any chain
2. **Test without blockchain costs** - Validate API integrations before on-chain deployment
3. **Share job definitions** - Cross-chain applications can use identical oracle jobs

## Quick Start

### Variable Overrides
```bash
# Test variable overrides with Polygon.io stock data
cd common/variable-overrides
POLYGON_API_KEY=your_key bun run testVariableOverrides.ts
```

### Job Testing
```bash
# Test a simple oracle job
cd common/job-testing
bun run runJob.ts

# Test with real API integration
POLYGON_API_KEY=your_key bun run runJob.ts
```

### Streaming
```bash
# Stream unsigned price data (requires API key)
cd common/streaming
SURGE_API_KEY=your_key bun run crossbarStream.ts
```

### Twitter Follower Count
```bash
# Fetch Twitter follower counts (interactive Bearer Token prompt)
cd common/twitter-follower-count
npm install
npm start

# Or specify a different username
npm start username_here
```

## Related Examples

Once you've tested your job definitions, see chain-specific examples for implementation:
- **Solana**: `../solana/examples/` - Oracle quotes, streaming, VRF
- **EVM**: `../evm/` - Price feeds on EVM-compatible chains
- **Sui**: `../sui/` - Pull-based oracle feeds

## Contributing

When adding new chain-agnostic tools:
1. Ensure they work across all supported chains
2. Add comprehensive documentation
3. Include usage examples for each chain
4. Keep dependencies minimal and cross-platform compatible
