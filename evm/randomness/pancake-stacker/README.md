# Switchboard Randomness Example: Pancake Stacker

A pancake stacking game demonstrating Switchboard's on-chain randomness on EVM chains using Foundry. Stack pancakes by flipping them onto your pile - each flip has a 2/3 chance to land!

## How It Works

1. **Flip a pancake** - Request on-chain randomness from Switchboard
2. **Catch the pancake** - Settle the randomness and see if it lands
3. **Build your stack** - Each successful flip adds to your stack height
4. **Don't drop it!** - A failed flip (1/3 chance) knocks over your entire stack

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/)

---

## Installation

### 1. Install Dependencies

```bash
bun install
```

This installs:
- `@switchboard-xyz/common` — Crossbar client for off-chain randomness resolution
- `@switchboard-xyz/on-demand-solidity` — Solidity interfaces and libraries for Switchboard

### 2. Install Foundry Libraries

```bash
forge install
```

---

## Forge Remappings

To import Switchboard interfaces in your Solidity contracts, configure forge remappings.

`remappings.txt`:
```txt
@switchboard-xyz/on-demand-solidity/=node_modules/@switchboard-xyz/on-demand-solidity
```

---

## Integration Guide

### On-Chain: Smart Contract Integration

The `PancakeStacker.sol` contract demonstrates the core randomness flow:

#### 1. Store the Switchboard Contract Reference

```solidity
import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract PancakeStacker {
    ISwitchboard public switchboard;

    constructor(address _switchboard) {
        require(_switchboard != address(0), "Invalid switchboard address");
        switchboard = ISwitchboard(_switchboard);
    }
}
```

#### 2. Request Randomness

```solidity
function flipPancake() public {
    require(pendingFlips[msg.sender] == bytes32(0), "Already have pending flip");

    // Generate unique randomness ID
    bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1)));

    // Request randomness with 1 second settlement delay
    switchboard.createRandomness(randomnessId, 1);

    pendingFlips[msg.sender] = randomnessId;
    emit PancakeFlipRequested(msg.sender, randomnessId);
}
```

#### 3. Settle Randomness and Apply Game Logic

```solidity
function catchPancake(bytes calldata encodedRandomness) public {
    bytes32 randomnessId = pendingFlips[msg.sender];
    require(randomnessId != bytes32(0), "No pending flip");

    // Clear pending flip before external calls (CEI pattern)
    delete pendingFlips[msg.sender];

    try switchboard.settleRandomness(encodedRandomness) {
        SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(randomnessId);

        // Verify randomness ID matches
        require(randomness.randId == randomnessId, "Randomness ID mismatch");

        // 2/3 chance to land, 1/3 chance to knock over
        bool landed = uint256(randomness.value) % 3 < 2;

        if (landed) {
            stackHeight[msg.sender]++;
            emit PancakeLanded(msg.sender, stackHeight[msg.sender]);
        } else {
            stackHeight[msg.sender] = 0;
            emit StackKnockedOver(msg.sender);
        }
    } catch {
        stackHeight[msg.sender] = 0;
        emit StackKnockedOver(msg.sender);
        emit SettlementFailed(msg.sender);
    }
}
```

---

### Off-Chain: Resolving Randomness with Crossbar

The `scripts/stack-pancake.ts` script demonstrates the complete flow:

```typescript
import { ethers } from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";

// Initialize provider and crossbar
const rpcUrl = process.env.RPC_URL || "https://rpc.monad.xyz";
const provider = new ethers.JsonRpcProvider(rpcUrl);
const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

// 1. Request randomness on-chain
await contract.flipPancake();

// 2. Get flip data for resolution
const flipData = await contract.getFlipData(wallet.address);

// 3. Get chain ID dynamically
const network = await provider.getNetwork();
const chainId = Number(network.chainId);

// 4. Resolve via Crossbar
const { encoded } = await crossbar.resolveEVMRandomness({
    chainId,
    randomnessId: flipData.randomnessId,
    timestamp: Number(flipData.rollTimestamp),
    minStalenessSeconds: Number(flipData.minSettlementDelay),
    oracle: flipData.oracle,
});

// 5. Settle on-chain
await contract.catchPancake(encoded);
```

---

## Running the Example

### 1. Build the Contracts

```bash
forge build
```

### 2. Configure Environment

> **Security:** Never use `export PRIVATE_KEY=...` or pass private keys as command-line arguments—they appear in shell history and process listings. Use a `.env` file instead.

```bash
cp .env.example .env
```

Edit `.env` with your private key and RPC URL.

### 3. Deploy the Contract

```bash
source .env
forge script deploy/PancakeStacker.s.sol:PancakeStackerScript \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast
```

### 4. Run the Pancake Stacking Script

After deploying, add the contract address to your `.env` file, then run:

```bash
bun run scripts/stack-pancake.ts
```

---

## Web UI

A browser-based UI is included for interacting with the deployed contract.

### Running the UI

```bash
bun start
```

Then open [http://localhost:3000](http://localhost:3000).

### Using the UI

1. Click "Connect Wallet" (MetaMask or compatible wallet)
2. Click "Flip Pancake" to request randomness
3. Wait for the randomness to resolve
4. Click "Catch!" to settle and see if your pancake lands
5. Keep stacking to build the highest tower!

---

## Documentation

- [Foundry Book](https://book.getfoundry.sh/)
- [Switchboard Documentation](https://docs.switchboard.xyz/)
