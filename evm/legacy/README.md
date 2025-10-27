# Legacy EVM Examples

This directory contains the previous version of the EVM examples using the older Switchboard implementation.

## 📁 Contents

- **`src/Example.sol`** - Basic example contract using the legacy Switchboard interface
- **`script/Deploy.s.sol`** - Deployment script for the legacy example
- **`examples/`** - TypeScript client examples for the legacy implementation

## 🌐 Legacy Network Support

These examples work with the following networks using the previous Switchboard contracts:

| Network | Chain ID | Switchboard Contract |
|---------|----------|---------------------|
| Arbitrum One | 42161 | `0xAd9b8604b6B97187CDe9E826cDeB7033C8C37198` |
| Arbitrum Sepolia | 421614 | `0xA2a0425fA3C5669d384f4e6c8068dfCf64485b3b` |
| Core Mainnet | 1116 | `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C` |
| Core Testnet | 1114 | `0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C` |
| HyperEVM Mainnet | 999 | `0x316fbe540c719970e6427ccd8590d7e0a2814c5d` |

## 🚀 Quick Start (Legacy)

```bash
# Install dependencies
bun install

# Deploy to Hyperliquid (example)
forge script legacy/script/Deploy.s.sol:DeployScript \
  --rpc-url https://rpc.hyperliquid.xyz/evm \
  --broadcast \
  -vv

# Run legacy update example
export PRIVATE_KEY=0x...
export EXAMPLE_ADDRESS=0x...
bun run legacy/examples/updateFeed.ts
```

## 📖 Documentation

For detailed documentation on the legacy implementation, see the original README structure:

### Legacy Example Contract

```solidity
contract Example {
    ISwitchboard switchboard;
    bytes32 public aggregatorId;
    int256 public latestPrice;
    
    function getFeedData(bytes[] calldata updates) public payable {
        uint256 fee = switchboard.getFee(updates);
        require(msg.value >= fee, "Insufficient fee");
        
        switchboard.updateFeeds{value: fee}(updates);
        
        Structs.Update memory update = switchboard.latestUpdate(aggregatorId);
        latestPrice = update.result;
    }
}
```

### Legacy TypeScript Usage

```typescript
import * as ethers from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";

const crossbar = new CrossbarClient(`https://crossbar.switchboard.xyz`);

// Get the encoded updates
const { encoded } = await crossbar.fetchEVMResults({
  chainId: 999,
  aggregatorIds: [aggregatorId],
});

// Update the contract
const tx = await exampleContract.getFeedData(encoded);
await tx.wait();
```

## ⚠️ Migration to New Implementation

For new projects, we recommend using the new implementation in the parent directory which includes:

- **Better Security**: Price deviation validation and staleness checks
- **More Features**: Multi-feed support and business logic helpers
- **Production Ready**: Comprehensive error handling and events
- **Monad Support**: Optimized for Monad Mainnet and Testnet

See the [main README](../README.md) for the new implementation.

## 📚 Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Legacy Contract Addresses](https://docs.switchboard.xyz/product-documentation/data-feeds/evm/contract-addresses)
- [Discord Community](https://discord.gg/switchboardxyz)

---

**Note**: This legacy implementation is maintained for reference and compatibility with existing deployments on non-Monad chains. For new projects, please use the updated implementation in the parent directory.

