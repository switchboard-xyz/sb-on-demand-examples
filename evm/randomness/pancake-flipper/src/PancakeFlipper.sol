// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract PancakeFlipper {

    // Events
    event PancakeFlipRequested(address indexed user, bytes32 randomnessId);
    event PancakeLanded(address indexed user, uint256 newStackHeight);
    event StackKnockedOver(address indexed user);

    // Pending flip randomness ID for each user (bytes32(0) = no pending flip)
    mapping(address => bytes32) public pendingFlips;

    // Current stack height for each player
    mapping(address => uint256) public stackHeight;

    // Switchboard contract
    ISwitchboard public switchboard;

    constructor(address _switchboard) {
        switchboard = ISwitchboard(_switchboard);
    }

    // Flip a pancake onto the stack
    function flipPancake() public {
        require(pendingFlips[msg.sender] == bytes32(0), "Already have pending flip");

        bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, block.timestamp, stackHeight[msg.sender]));
        switchboard.createRandomness(randomnessId, 1);

        pendingFlips[msg.sender] = randomnessId;

        emit PancakeFlipRequested(msg.sender, randomnessId);
    }

    // Catch the pancake and see if it lands
    function catchPancake(bytes calldata encodedRandomness) public returns (bool landed) {
        bytes32 randomnessId = pendingFlips[msg.sender];
        require(randomnessId != bytes32(0), "No pending flip");

        // Settle the randomness on-chain
        switchboard.settleRandomness(encodedRandomness);

        // Get the randomness value
        SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(randomnessId);
        require(randomness.value != 0, "Randomness not resolved");

        // 80% chance to land (roll 0-79), 20% chance to knock over (roll 80-99)
        landed = uint256(randomness.value) % 100 < 80;

        if (landed) {
            // Pancake lands! Increment stack
            stackHeight[msg.sender]++;
            emit PancakeLanded(msg.sender, stackHeight[msg.sender]);
        } else {
            // Stack knocked over!
            stackHeight[msg.sender] = 0;
            emit StackKnockedOver(msg.sender);
        }

        // Clear the request
        delete pendingFlips[msg.sender];

        return landed;
    }

    // View function to get data needed for off-chain resolution
    function getFlipData(address user) public view returns (bytes32 randomnessId, address oracle, uint256 rollTimestamp, uint256 minSettlementDelay) {
        randomnessId = pendingFlips[user];
        SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(randomnessId);
        return (randomnessId, randomness.oracle, randomness.rollTimestamp, randomness.minSettlementDelay);
    }

    // Get player stats
    function getPlayerStats(address user) public view returns (uint256 currentStack, bool hasPendingFlip) {
        return (
            stackHeight[user],
            pendingFlips[user] != bytes32(0)
        );
    }
}
