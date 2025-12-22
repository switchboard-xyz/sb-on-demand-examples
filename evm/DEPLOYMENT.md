# Deployment Guide for EVM Chains

This guide walks you through deploying the SwitchboardPriceConsumer contract to various EVM chains, with a focus on Monad.

## Prerequisites

1. **Foundry installed**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Bun or Node.js installed**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Wallet with native tokens**
   - Monad Testnet: Get MON from faucet
   - Monad Mainnet: Purchase MON tokens
   - Other chains: Get respective native tokens

## Step 1: Configure Environment

Create a `.env` file or export variables:

```bash
# Required
export PRIVATE_KEY=0xyour_private_key_here
export RPC_URL=https://your_rpc_url_here

# Optional (for specific networks)
export SWITCHBOARD_ADDRESS=0x...  # Override default Switchboard address
export NETWORK=monad-testnet      # Network name for scripts
```

### Network-Specific RPC URLs

**Monad:**
- Testnet: `https://testnet-rpc.monad.xyz`
- Mainnet: `https://rpc-mainnet.monadinfra.com/rpc/YOUR_API_KEY`

## Step 2: Build the Contract

```bash
# Install dependencies
forge install

# Build the contract
forge build
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 1 files with 0.8.22
[⠢] Solc 0.8.22 finished in 1.23s
Compiler run successful!
```

## Step 3: Deploy the Contract

### Option A: Using Foundry Script (Recommended)

#### Monad Testnet

```bash
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

#### Monad Mainnet

```bash
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url $MONAD_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

#### With Custom Switchboard Address

```bash
SWITCHBOARD_ADDRESS=0xYOUR_SWITCHBOARD_ADDRESS \
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  -vvvv
```

### Option B: Using npm Scripts

```bash
# Monad Testnet
bun run deploy:monad-testnet

# Monad Mainnet
MONAD_RPC_URL=https://... bun run deploy:monad-mainnet

# General deployment
bun run deploy
```

### Option C: Direct Forge Create

```bash
forge create src/SwitchboardPriceConsumer.sol:SwitchboardPriceConsumer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C
```

## Step 4: Save Contract Address

After deployment, you'll see output like:

```
Deploying SwitchboardPriceConsumer...
Switchboard address: 0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C
Deployer: 0x...

SwitchboardPriceConsumer deployed at: 0xABCD1234...

Configuration:
  Max Price Age: 300 seconds
  Max Deviation: 1000 bps
  Owner: 0x...

Next steps:
1. Save the contract address
2. Run: CONTRACT_ADDRESS=0xABCD1234... bun scripts/run.ts
```

**Save the contract address!** You'll need it for the next steps.

```bash
export CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

## Step 5: Verify the Contract (Optional)

### On Block Explorers

#### Monad

```bash
# Testnet
forge verify-contract \
  --chain-id 10143 \
  --watch \
  $CONTRACT_ADDRESS \
  src/SwitchboardPriceConsumer.sol:SwitchboardPriceConsumer \
  --constructor-args $(cast abi-encode "constructor(address)" 0x90E0B788EfA1986D49c587223b30C8Cb4A3F5c99)

# Mainnet
forge verify-contract \
  --chain-id 143 \
  --watch \
  $CONTRACT_ADDRESS \
  src/SwitchboardPriceConsumer.sol:SwitchboardPriceConsumer \
  --constructor-args $(cast abi-encode "constructor(address)" 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67)
```

## Step 6: Run the Example

```bash
# Complete example with deployment, update, and queries
RPC_URL=$RPC_URL \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
NETWORK=monad-testnet \
bun scripts/run.ts
```

## Troubleshooting

### "Insufficient funds for gas"

Ensure your wallet has enough native tokens:

```bash
# Check balance
cast balance $YOUR_ADDRESS --rpc-url $RPC_URL
```

### "Nonce too low"

Reset your nonce or wait for pending transactions:

```bash
# Check pending transactions
cast tx $TX_HASH --rpc-url $RPC_URL
```

### "Contract creation failed"

Check:
1. RPC URL is correct
2. Private key is valid
3. Switchboard address is correct for the network
4. You have sufficient gas

```bash
# Test RPC connection
cast block latest --rpc-url $RPC_URL

# Test private key
cast wallet address --private-key $PRIVATE_KEY
```

### "Invalid Switchboard address"

Verify you're using the correct Switchboard contract for your network:

| Network | Switchboard Address |
|---------|-------------------|
| Monad Testnet | `0x90E0B788EfA1986D49c587223b30C8Cb4A3F5c99` |
| Monad Mainnet | `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |

### Build Errors

```bash
# Clean and rebuild
forge clean
forge build

# Update dependencies
forge update

# Check Solidity version
forge --version
```

## Network-Specific Notes

### Monad

- **Gas**: Monad has unique gas mechanics; monitor usage carefully
- **Block Time**: Faster than Ethereum; adjust staleness checks accordingly
- **RPC**: Use official RPC endpoints for best performance
- **Faucet**: Get testnet MON from Discord or official faucet

> **Note**: For other EVM chains (Arbitrum, Core, etc.), see the [legacy examples](./legacy/) which use the previous Switchboard implementation.

## Configuration After Deployment

### Update Max Price Age

```bash
cast send $CONTRACT_ADDRESS \
  "updateConfig(uint256,uint256)" \
  600 1000 \  # 10 minutes, 10% deviation
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Transfer Ownership

```bash
cast send $CONTRACT_ADDRESS \
  "transferOwnership(address)" \
  $NEW_OWNER_ADDRESS \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

## Testing the Deployment

### 1. Check Contract State

```bash
# Get max price age
cast call $CONTRACT_ADDRESS \
  "maxPriceAge()" \
  --rpc-url $RPC_URL

# Get max deviation
cast call $CONTRACT_ADDRESS \
  "maxDeviationBps()" \
  --rpc-url $RPC_URL

# Get owner
cast call $CONTRACT_ADDRESS \
  "owner()" \
  --rpc-url $RPC_URL
```

### 2. Submit Test Update

```bash
# Run the complete example
bun scripts/run.ts
```

### 3. Query Price

```bash
# Get price for BTC/USD feed
FEED_ID=0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812

cast call $CONTRACT_ADDRESS \
  "getPrice(bytes32)" \
  $FEED_ID \
  --rpc-url $RPC_URL
```

## Production Deployment Checklist

- [ ] Contract built and tested locally
- [ ] Correct Switchboard address for target network
- [ ] Sufficient gas funds in deployment wallet
- [ ] RPC endpoint is reliable and fast
- [ ] Contract verified on block explorer
- [ ] Configuration parameters set appropriately
- [ ] Ownership transferred to multisig (if applicable)
- [ ] Test update submitted successfully
- [ ] Monitoring set up for price updates
- [ ] Documentation updated with contract address

## Next Steps

After successful deployment:

1. **Integrate into your DApp**
   - Use the contract address in your frontend
   - Set up automated price updates
   - Monitor for events

2. **Set up monitoring**
   - Track price updates
   - Monitor gas usage
   - Alert on stale prices

3. **Configure parameters**
   - Adjust `maxPriceAge` for your use case
   - Set `maxDeviationBps` based on volatility
   - Consider multi-sig for ownership

## Support

If you encounter issues:
- 📖 [Switchboard Documentation](https://docs.switchboard.xyz)
- 💬 [Discord Community](https://discord.gg/switchboardxyz)
- 🐛 [GitHub Issues](https://github.com/switchboard-xyz/evm-on-demand/issues)

