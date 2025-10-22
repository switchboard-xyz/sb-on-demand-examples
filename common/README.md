# Common Resources

This directory contains chain-agnostic resources and tools that work across all Switchboard On-Demand blockchain implementations.

## What's Here

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
