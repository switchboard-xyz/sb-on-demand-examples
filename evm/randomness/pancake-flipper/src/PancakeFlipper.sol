// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract PancakeFlipper {

    // Events
    event PancakeFlipRequested(address indexed user, bytes32 randomnessId);
    event PancakeLanded(address indexed user, uint256 newStackHeight);
    event StackKnockedOver(address indexed user);
    event SettlementFailed(address indexed user);

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

        // Try to settle the randomness on-chain
        try switchboard.settleRandomness(encodedRandomness) {
            // Settlement succeeded, now get the randomness value
            SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(randomnessId);

            if (randomness.value == 0) {
                // Randomness not resolved yet - clear flip so user can retry
                delete pendingFlips[msg.sender];
                return false;
            }

            // 2/3 chance to land (roll 0-1), 1/3 chance to knock over (roll 2)
            landed = uint256(randomness.value) % 3 < 2;

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
        } catch {
            // Settlement failed - clear the pending flip so user can try again
            delete pendingFlips[msg.sender];
            emit SettlementFailed(msg.sender);
            return false;
        }
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
