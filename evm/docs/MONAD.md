# Monad Integration

Monad is a high-performance EVM-compatible blockchain optimized for speed and efficiency. Switchboard On-Demand provides native oracle support for Monad with the same security guarantees and ease of use as other EVM chains.

## Network Information

| Network | Chain ID | RPC URL | Switchboard Contract |
|---------|----------|---------|---------------------|
| **Mainnet** | 143 | `https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY` | `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |
| **Testnet** | 10143 | `https://testnet-rpc.monad.xyz` | `0x90E0B788EfA1986D49c587223b30C8Cb4A3F5c99` |

## Quick Start

### 1. Setup Environment

```bash
# Testnet
export RPC_URL=https://testnet-rpc.monad.xyz
export PRIVATE_KEY=0xyour_private_key_here
export NETWORK=monad-testnet

# Mainnet
export RPC_URL=https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY
export PRIVATE_KEY=0xyour_private_key_here  
export NETWORK=monad-mainnet
```

### 2. Deploy Contract

```bash
# Testnet
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast -vvvv

# Mainnet
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY \
  --private-key $PRIVATE_KEY \
  --broadcast -vvvv
```

### 3. Run Examples

```bash
# Price Feeds
RPC_URL=$RPC_URL PRIVATE_KEY=$PRIVATE_KEY CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
  NETWORK=monad-testnet bun scripts/run.ts

# Randomness
PRIVATE_KEY=$PRIVATE_KEY NETWORK=monad-testnet bun run randomness
```

## Integration Example

```typescript
import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';

const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Switchboard contract on Monad Testnet
const switchboardAddress = '0x90E0B788EfA1986D49c587223b30C8Cb4A3F5c99';
const switchboard = new ethers.Contract(switchboardAddress, SWITCHBOARD_ABI, signer);

// Fetch and update prices
const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
const feedHash = '0xa0950ee5ee117b2e2c30f154a69e17bfb489a7610c508dc5f67eb2a14616d8ea'; // ETH/USD

const response = await crossbar.fetchOracleQuote([feedHash], 'mainnet');
const fee = await switchboard.getFee([response.encoded]);

const tx = await priceConsumer.updatePrices([response.encoded], { value: fee });
const receipt = await tx.wait();

console.log(`Price updated on Monad! Block: ${receipt.blockNumber}`);
```

## Monad-Specific Considerations

- **Native Token**: MON (for gas fees)
- **High Performance**: Monad's optimized execution enables faster oracle updates
- **Low Fees**: Efficient gas usage for frequent price updates
- **EVM Compatibility**: All existing Ethereum tooling works seamlessly

## Getting MON Tokens

**Testnet:**
- Use the [Monad Testnet Faucet](https://faucet.monad.xyz) to get testnet MON

**Mainnet:**
- Acquire MON tokens through supported exchanges
- Bridge from other networks using official Monad bridges

