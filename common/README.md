# Common Resources

This directory contains chain-agnostic resources shared across all Switchboard On-Demand examples.

## Directory Structure

- **docs/** - Documentation about Switchboard concepts that apply to all chains
- **job-testing/** - Oracle job testing and development tools (chain-agnostic)
- **scripts/** - Cross-chain utilities and helper scripts
- **types/** - Shared TypeScript type definitions

## Available Tools

### Job Testing
The `job-testing/` directory contains tools for testing custom oracle job definitions:
- **`runJob.ts`** - Test oracle jobs with variable substitution
- Works across all chains (Solana, EVM, Sui)
- See [job-testing/README.md](./job-testing/README.md) for usage

## Usage

Resources in this directory are referenced by the blockchain-specific examples in:
- `../solana/`
- `../sui/`
- `../evm/`

For chain-specific documentation and examples, see the README files in each blockchain directory.
