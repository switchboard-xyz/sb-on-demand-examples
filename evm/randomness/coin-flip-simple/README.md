# Switchboard Randomness Example (Simple)

A simple coin flip demonstrating Switchboard's on-chain randomness on EVM chains using Foundry. No wagering - just flip a coin and get a verifiably random result (heads or tails).

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

```solidity
function flipCoin() public {
    bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, block.timestamp));
    switchboard.createRandomness(randomnessId, 1);

    flipRequests[msg.sender] = FlipRequest({
        user: msg.sender,
        randomnessId: randomnessId,
        requestTimestamp: block.timestamp
    });

    emit CoinFlipRequested(msg.sender, randomnessId);
}
```

#### 3. Settle Randomness

```solidity
function settleFlip(bytes calldata encodedRandomness) public returns (bool isHeads) {
    FlipRequest memory request = flipRequests[msg.sender];

    // Settle the randomness on-chain
    switchboard.settleRandomness(encodedRandomness);

    // Get the randomness value
    SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(request.randomnessId);
    require(randomness.value != 0, "Randomness not resolved");

    // Determine heads or tails: even = heads, odd = tails
    isHeads = uint256(randomness.value) % 2 == 0;

    emit CoinFlipSettled(request.user, isHeads, randomness.value);
    delete flipRequests[msg.sender];
}
```

---

### Off-Chain: Resolving Randomness with Crossbar

The `scripts/flip-the-coin.ts` script demonstrates the complete flow:

```typescript
import { CrossbarClient } from "@switchboard-xyz/common";

const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

// 1. Request randomness on-chain
await coinFlipContract.flipCoin();

// 2. Get flip data
const randomnessId = await coinFlipContract.getFlipRandomnessId(wallet.address);
const flipData = await coinFlipContract.getFlipData(wallet.address);

// 3. Resolve via Crossbar
const { encoded } = await crossbar.resolveEVMRandomness({
    chainId: 143,
    randomnessId,
    timestamp: Number(flipData.rollTimestamp),
    minStalenessSeconds: Number(flipData.minSettlementDelay),
    oracle: flipData.oracle,
});

// 4. Settle on-chain and get result
const tx = await coinFlipContract.settleFlip(encoded);
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

A browser-based UI is included for interacting with the deployed contract.

### Running the UI

```bash
bun start
```

Then open [http://localhost:3000](http://localhost:3000).

### Using the UI

1. Enter the deployed contract address
2. Click "Connect Wallet" (MetaMask/Phantom)
3. Click "Flip the Coin" to request randomness
4. Click "Settle & Reveal" to resolve and see the result (heads or tails)

---

## Documentation

- [Foundry Book](https://book.getfoundry.sh/)
- [Switchboard Documentation](https://docs.switchboard.xyz/)
