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

The `scripts/flip-the-coin.ts` script demonstrates the complete off-chain flow:

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
const { encoded } = await crossbar.resolveEVMRandomness({
    chainId: 143,  // Monad chain ID
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

### 2. Deploy the Contract

```bash
forge script script/CoinFlip.s.sol:CoinFlipScript \
    --rpc-url <your_rpc_url> \
    --private-key <your_private_key> \
    --broadcast
```

### 3. Run the Coin Flip Script

```bash
PRIVATE_KEY=<your_private_key> \
COIN_FLIP_CONTRACT_ADDRESS=<deployed_contract_address> \
bun run scripts/flip-the-coin.ts
```

---

## Web UI

A simple browser-based UI is included for interacting with the deployed contract.

### Running the UI

Start the server:

```bash
bun start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Using the UI

1. **Enter the deployed contract address** in the input field
2. **Click "Connect Wallet"** — MetaMask will prompt you to connect
3. **Click "Flip the Coin"** — sends 1 ETH to the contract and requests randomness
4. **Click "Settle & Reveal"** — resolves randomness via Crossbar and settles on-chain
5. **View the result** — win (heads) doubles your ETH, lose (tails) and the house keeps it

> **Note:** The UI is configured for Monad (chain ID 143). Modify the `CHAIN_ID` constant in `ui/index.html` for other networks.

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
