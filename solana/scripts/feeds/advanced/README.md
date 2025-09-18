# Advanced Oracle Integration Examples

This directory contains advanced examples demonstrating **Pinocchio Framework** integration for ultra-low compute unit oracle operations with Switchboard On-Demand.

## Framework Comparison

- **Basic Examples**: Use Anchor Framework (~2k CU with overhead) for ease of development
- **Advanced Examples**: Use Pinocchio Framework (**~190 total CU**) for maximum optimization

## Examples

### `runUpdate.ts` - Pinocchio Framework Oracle Updates
Advanced example using the **Pinocchio Framework** for ultra-low compute unit consumption (**~90 CU for feed crank + ~100 CU framework overhead = ~190 total CU**):

- **Address Lookup Tables (LUTs)**: Reduces transaction size by ~90%
- **Compute Unit Optimization**: Dynamic compute unit estimation with buffers
- **Performance Monitoring**: Latency tracking and statistics
- **Error Handling**: Comprehensive simulation and retry logic
- **Transaction Optimization**: V0 transactions with proper priority fees

#### Key Features:
- **Pinocchio Framework**: Ultra-optimized account parsing and instruction dispatch
- **Admin Authorization**: Bypasses expensive validation checks for authorized crankers
- **Zero-Allocation Parsing**: Direct syscall access without framework abstractions
- **Optimized CPI**: Direct system program calls with minimal overhead
- **Separate Initialization**: Modular state and quote account setup
- Performance monitoring and comprehensive error handling

#### Usage:
```bash
npm run feeds:advanced --feedId=0xef0d8b6fcd0104e3e75096912fc8e1e432893da4f18faedaacca7e5875da620f
```

#### Compute Unit Comparison:
- **Anchor Framework**: ~2k CU with framework overhead
- **Pinocchio Framework**: **~190 total CU** (~90 CU feed crank + ~100 CU framework overhead)
- **Optimization**: ~90% reduction in compute unit consumption

### Pinocchio Framework Optimizations:

1. **Ultra-Low Compute Units**
   - `#[inline(always)]` instruction dispatch
   - Direct syscall access without abstractions
   - Zero-allocation account parsing with `unsafe` operations
   - Admin authorization bypassing expensive validation

2. **Modular Account Management**
   - Separate state account initialization (`init_state`)
   - Separate quote account initialization (`init_oracle`)
   - Conditional initialization only when needed
   - Proper PDA derivation and validation

3. **Framework-Specific Features**
   - Uses `pinocchio` crate for minimal runtime overhead
   - Direct system program CPI with `invoke_signed`
   - Manual account data handling for maximum control
   - Custom error codes for precise debugging

4. **Performance Monitoring**
   - Real-time compute unit tracking
   - Latency measurement and statistics
   - Comprehensive transaction logging
   - Account state debugging