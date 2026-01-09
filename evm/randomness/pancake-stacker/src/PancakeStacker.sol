// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract PancakeStacker {

    // Events
    event PancakeFlipRequested(address indexed user, bytes32 randomnessId);
    event PancakeLanded(address indexed user, uint256 newStackHeight);
    event StackKnockedOver(address indexed user);
    event SettlementFailed(address indexed user);

    // Pending flip randomness ID for each user (bytes32(0) = no pending flip)
    mapping(address => bytes32) public pendingFlips;

    // Current stack height for each player
    mapping(address => uint256) public stackHeight;

    // declare and initialize switchboard as a parameter 
    // that holds the switchboard contract address
    ISwitchboard public switchboard;

    constructor(address _switchboard) {
        require(_switchboard != address(0), "Invalid switchboard address");
        switchboard = ISwitchboard(_switchboard);
    }

    // Flip a pancake onto the stack
    function flipPancake() public {
        // check no pending flip exists
        require(pendingFlips[msg.sender] == bytes32(0), "Already have pending flip");
        
        // generate randomnessID with sender address and last blockhash
        bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1)));
        
        // ask switchboard contract to create a new randomness request 
        // with 1 second settlement delay
        switchboard.createRandomness(randomnessId, 1);

        // store the randomness request as a pending flip for the sender
        pendingFlips[msg.sender] = randomnessId;

        emit PancakeFlipRequested(msg.sender, randomnessId);
    }

    // Catch the pancake and see if it lands
    function catchPancake(bytes calldata encodedRandomness) public {

        // make sure caller has a pending flip
        bytes32 randomnessId = pendingFlips[msg.sender];
        require(randomnessId != bytes32(0), "No pending flip");

        // Clear the pending flip BEFORE external calls (CEI pattern)
        delete pendingFlips[msg.sender];

        // give the randomness object to the switchboard contract
        // and ask it to verify that it's correct
        try switchboard.settleRandomness(encodedRandomness) {

            // verification succeeded, now get the randomness value
            SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(randomnessId);

            // Verify the randomness ID matches what we requested
            require(randomness.randId == randomnessId, "Randomness ID mismatch");

            // 2/3 chance to land (roll 0-1), 1/3 chance to knock over
            bool landed = uint256(randomness.value) % 3 < 2;

            if (landed) {
                // Pancake lands! Increment stack
                stackHeight[msg.sender]++;
                emit PancakeLanded(msg.sender, stackHeight[msg.sender]);
            } else {
                // Stack knocked over!
                stackHeight[msg.sender] = 0;
                emit StackKnockedOver(msg.sender);
            }

        // if switchboard failed to parse the encoded randomness
        } catch {
            // Caution: could be an issue with the oracle or malformed randomness for another reason
            // to be safe we make the player reset their stack and start over
            stackHeight[msg.sender] = 0;
            emit StackKnockedOver(msg.sender);
            emit SettlementFailed(msg.sender);
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
