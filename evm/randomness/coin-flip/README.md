# Switchboard Randomness Example

A coin flip game demonstrating Switchboard's on-chain randomness on EVM chains using Foundry.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/)

---

## Installation

### 1. Install Dependencies

Install the TypeScript/JavaScript dependencies using Bun:

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

To import Switchboard interfaces and libraries in your Solidity contracts, configure forge remappings.

Create or update `remappings.txt` in your project root:

```txt
@switchboard-xyz/on-demand-solidity/=node_modules/@switchboard-xyz/on-demand-solidity
```

This allows you to import Switchboard contracts like so:

```solidity
import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';
```

---

## Integration Guide

### On-Chain: Smart Contract Integration

The `CoinFlip.sol` contract demonstrates the core randomness flow:

#### 1. Store the Switchboard Contract Reference

```solidity
import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract CoinFlip {
    ISwitchboard public switchboard;

    constructor(address _switchboard) {
        switchboard = ISwitchboard(_switchboard);
    }
}
```

#### 2. Request Randomness

Call `createRandomness()` with a unique ID and the number of random words needed:

```solidity
function coinFlip() public payable {
    // Generate a unique randomness ID
    bytes32 randomnessId = keccak256(abi.encodePacked(block.timestamp));
    
    // Request 1 random word from Switchboard
    switchboard.createRandomness(randomnessId, 1);
    
    // Store the randomness ID for later settlement
    wagers[msg.sender] = Wager({
        amount: msg.value,
        user: msg.sender,
        randomnessId: randomnessId,
        flipTimestamp: block.timestamp
    });
}
```

#### 3. Settle Randomness

After the randomness is resolved off-chain, settle it on-chain and use the result:

```solidity
function settleFlip(bytes calldata encodedRandomness) public {
    // Settle the randomness on-chain
    switchboard.settleRandomness(encodedRandomness);

    // Retrieve the wager and randomness
    Wager memory wager = wagers[msg.sender];
    SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(wager.randomnessId);
    
    // Ensure randomness is resolved
    require(randomness.value != 0, "Randomness not resolved");

    // Use the random value (e.g., coin flip: even = win)
    if (uint256(randomness.value) % 2 == 0) {
        (bool success, ) = wager.user.call{value: wager.amount * 2}("");
        require(success, "Transfer failed");
    }

    delete wagers[msg.sender];
}
```

#### 4. Helper Functions for Off-Chain Coordination

Expose data needed by the off-chain component to resolve randomness:

```solidity
function getWagerRandomnessId(address user) public view returns (bytes32) {
    return wagers[user].randomnessId;
}

function getWagerData(address user) public view returns (
    address oracle, 
    uint256 rollTimestamp, 
    uint256 minSettlementDelay
) {
    SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(wagers[user].randomnessId);
    return (randomness.oracle, randomness.rollTimestamp, randomness.minSettlementDelay);
}
```

---

### Off-Chain: Resolving Randomness with Crossbar

The `scripts/flip-coin.ts` script demonstrates the complete off-chain flow:

#### 1. Setup the Crossbar Client

```typescript
import { ethers } from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";

const provider = new ethers.JsonRpcProvider("https://rpc.monad.xyz");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Initialize the Crossbar client
const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");
```

#### 2. Request Randomness On-Chain

```typescript
const coinFlipContract = new ethers.Contract(
    COIN_FLIP_CONTRACT_ADDRESS,
    coinFlipAbi,
    wallet
);

// Send the coin flip transaction (requests randomness)
const tx = await coinFlipContract.coinFlip({ value: ethers.parseEther("1") });
await tx.wait();
```

#### 3. Fetch Wager Data for Resolution

```typescript
// Get the randomness ID stored on-chain
const wagerRandomnessId = await coinFlipContract.getWagerRandomnessId(wallet.address);

// Get oracle assignment and timing data
const wagerData = await coinFlipContract.getWagerData(wallet.address);
```

#### 4. Resolve Randomness via Crossbar

```typescript
// Get the chain ID dynamically from the provider
const network = await provider.getNetwork();
const chainId = Number(network.chainId);

const { encoded } = await crossbar.resolveEVMRandomness({
    chainId,
    randomnessId: wagerRandomnessId,
    timestamp: Number(wagerData.rollTimestamp),
    minStalenessSeconds: Number(wagerData.minSettlementDelay),
    oracle: wagerData.oracle,
});
```

#### 5. Settle On-Chain

```typescript
// Submit the encoded randomness to settle the flip
const tx2 = await coinFlipContract.settleFlip(encoded);
await tx2.wait();
console.log("Flip settled:", tx2.hash);
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
forge script deploy/CoinFlip.s.sol:CoinFlipScript \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast
```

### 4. Run the Coin Flip Script

After deploying, add the contract address to your `.env` file, then run:

```bash
bun run scripts/flip-coin.ts
```

---

## Foundry Commands

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Format

```bash
forge fmt
```

### Gas Snapshots

```bash
forge snapshot
```

### Local Node (Anvil)

```bash
anvil
```

### Help

```bash
forge --help
anvil --help
cast --help
```

---

## Documentation

- [Foundry Book](https://book.getfoundry.sh/)
- [Switchboard Documentation](https://docs.switchboard.xyz/)
