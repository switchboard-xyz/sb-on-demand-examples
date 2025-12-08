#!/bin/bash
set -e

# Load .env if it exists
if [ -f .env ]; then
  source .env
fi

# Check required vars
if [ -z "$PRIVATE_KEY" ] || [ -z "$RPC_URL" ]; then
  echo "Error: PRIVATE_KEY and RPC_URL must be set in .env"
  exit 1
fi

echo "Deploying SwitchboardPriceConsumer..."

# Deploy and capture output
OUTPUT=$(forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  2>&1)

echo "$OUTPUT"

# Extract contract address from output
CONTRACT_ADDRESS=$(echo "$OUTPUT" | grep -oE "SwitchboardPriceConsumer deployed at: 0x[a-fA-F0-9]{40}" | grep -oE "0x[a-fA-F0-9]{40}")

if [ -z "$CONTRACT_ADDRESS" ]; then
  echo "Error: Could not extract contract address from deployment output"
  exit 1
fi

echo ""
echo "Updating .env with CONTRACT_ADDRESS=$CONTRACT_ADDRESS"

# Update or add CONTRACT_ADDRESS in .env
if grep -q "^CONTRACT_ADDRESS=" .env 2>/dev/null; then
  # Replace existing
  sed -i.bak "s/^CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=$CONTRACT_ADDRESS/" .env && rm -f .env.bak
else
  # Add new
  echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> .env
fi

echo ""
echo "Done! Now run: bun scripts/run.ts"
