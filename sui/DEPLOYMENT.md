# Deployment Guide

This guide walks you through deploying the Switchboard Oracle Quote Verifier example to Sui.

## Prerequisites

1. **Sui CLI installed**
   ```bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
   ```

2. **Sui wallet configured**
   ```bash
   sui client
   ```

3. **Testnet or Mainnet SUI tokens**
   - Testnet: Use the [Sui Testnet Faucet](https://discord.com/channels/916379725201563759/971488439931392130)
   - Mainnet: Purchase SUI tokens

## Step 1: Configure Your Network

### For Testnet

```bash
# Switch to testnet
sui client switch --env testnet

# Copy testnet configuration
cp Move.testnet.toml Move.toml
```

### For Mainnet

```bash
# Switch to mainnet
sui client switch --env mainnet

# The default Move.toml is already configured for mainnet
```

## Step 2: Build the Contract

```bash
# Build the Move contract
npm run build

# Or use sui directly
sui move build
```

Expected output:
```
INCLUDING DEPENDENCY Sui
INCLUDING DEPENDENCY Switchboard
BUILDING example
```

## Step 3: Run Tests (Optional)

```bash
npm run test

# Or use sui directly
sui move test
```

## Step 4: Deploy the Contract

### Testnet Deployment

```bash
npm run deploy:testnet

# Or use sui directly
sui client publish --gas-budget 100000000
```

### Mainnet Deployment

```bash
npm run deploy

# Or use sui directly
sui client publish --gas-budget 100000000
```

## Step 5: Save Your Package ID

After deployment, you'll see output like:

```
╭─────────────────────────────────────────────────────────────────────────╮
│ Object Changes                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ Created Objects:                                                        │
│  ┌──                                                                    │
│  │ ObjectID: 0xABCD1234...                                             │
│  │ Sender: 0x...                                                       │
│  │ Owner: Immutable                                                    │
│  │ ObjectType: 0xABCD1234::example::QuoteConsumer                     │
│  └──                                                                    │
╰─────────────────────────────────────────────────────────────────────────╯
```

**Save the Package ID** (the long hex string starting with `0x`). You'll need it to run the examples.

## Step 6: Set Environment Variables

Create a `.env` file or export variables:

```bash
# Set your deployed package ID
export EXAMPLE_PACKAGE_ID=0xYOUR_PACKAGE_ID_HERE

# Optional: Configure other parameters
export SUI_NETWORK=mainnet  # or testnet
export FEED_HASH=0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812
export NUM_ORACLES=3
```

## Step 7: Run the Example

```bash
npm run example
```

## Troubleshooting

### "Insufficient gas"

Increase the gas budget:
```bash
sui client publish --gas-budget 200000000
```

### "Package dependency does not match its on-chain version"

This can happen if the Switchboard package was upgraded. Update your dependencies:
```bash
# Clean build directory
rm -rf build/

# Rebuild
npm run build
```

### "Unable to resolve dependencies"

Make sure you have internet access and can reach GitHub:
```bash
# Test GitHub connectivity
git ls-remote https://github.com/switchboard-xyz/sui.git

# If that works, try building again
npm run build
```

### "Address already published"

If you're trying to republish, you need to use a different address or upgrade the existing package. For testing, you can change the `example` address in Move.toml:

```toml
[addresses]
example = "0x0"  # Change this to a different address
```

## Upgrading Your Contract

If you need to upgrade an already-deployed contract:

1. **Find your UpgradeCap object**
   ```bash
   sui client objects
   ```

2. **Upgrade the package**
   ```bash
   sui client upgrade --upgrade-capability 0xYOUR_UPGRADE_CAP --gas-budget 100000000
   ```

## Network Information

### Mainnet
- **Switchboard Package**: `0xa81086572822d67a1559942f23481de9a60c7709c08defafbb1ca8dffc44e210`
- **RPC URL**: `https://fullnode.mainnet.sui.io:443`
- **Explorer**: `https://suiscan.xyz/mainnet`

### Testnet
- **Switchboard Package**: `0x28005599a66e977bff26aeb1905a02cda5272fd45bb16a5a9eb38e8659658cff`
- **RPC URL**: `https://fullnode.testnet.sui.io:443`
- **Explorer**: `https://suiscan.xyz/testnet`

## Next Steps

After successful deployment:

1. **Run the complete example**
   ```bash
   EXAMPLE_PACKAGE_ID=0xYOUR_PACKAGE_ID npm run example
   ```

2. **Try the simple quote fetching**
   ```bash
   npm run quotes
   ```

3. **Monitor real-time prices with Surge**
   ```bash
   export SURGE_API_KEY=your_api_key
   npm run surge
   ```

4. **Integrate into your own project**
   - Copy the Move code from `sources/example.move`
   - Adapt the TypeScript code from `scripts/run.ts`
   - Customize for your specific use case

## Support

If you encounter issues:
- 📖 [Switchboard Documentation](https://docs.switchboard.xyz)
- 💬 [Discord Community](https://discord.gg/switchboardxyz)
- 🐛 [GitHub Issues](https://github.com/switchboard-xyz/sui/issues)

