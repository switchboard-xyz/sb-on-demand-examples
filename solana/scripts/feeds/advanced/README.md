# Advanced Oracle Integration Examples

This directory contains advanced examples demonstrating compute-optimized oracle integrations with Switchboard On-Demand.

## Examples

### `runUpdate.ts` - Compute-Optimized Oracle Updates
Advanced example showcasing best practices for minimizing compute units while maintaining high performance:

- **Address Lookup Tables (LUTs)**: Reduces transaction size by ~90%
- **Compute Unit Optimization**: Dynamic compute unit estimation with buffers
- **Performance Monitoring**: Latency tracking and statistics
- **Error Handling**: Comprehensive simulation and retry logic
- **Transaction Optimization**: V0 transactions with proper priority fees

#### Key Features:
- Uses `fetchQuoteIx()` for Ed25519 signature verification
- Implements LUT loading for optimal transaction size
- Tracks and reports performance metrics
- Dynamic compute unit pricing and limits
- Proper error handling and simulation

#### Usage:
```bash
npm run feeds:advanced --feedId=0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
```

#### Compute Unit Savings:
- Without LUT: ~180,000 CU
- With LUT: ~18,000 CU (90% reduction)
- Dynamic sizing prevents over-allocation

### Performance Optimizations Demonstrated:

1. **Transaction Size Optimization**
   - Address Lookup Table usage
   - V0 transaction format
   - Minimal account references

2. **Compute Unit Management**
   - Dynamic CU limit calculation
   - Buffer multipliers for safety
   - Priority fee optimization

3. **Network Efficiency**
   - Proper commitment levels
   - Skip preflight for known-good transactions
   - Strategic retry policies

4. **Monitoring & Analytics**
   - Latency tracking
   - Performance statistics
   - Error rate monitoring