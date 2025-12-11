// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract CoinFlipper {

    // stores flip request for each user
    struct FlipRequest {
        address user;
        bytes32 randomnessId;
        uint256 requestTimestamp;
    }

    // emit events so off-chain logic can follow
    event CoinFlipRequested(address indexed user, bytes32 randomnessId);
    event CoinFlipSettled(address indexed user, bool isHeads, uint256 randomValue);

    // Each user can make 1 flip request at at time, stored in this mapping
    mapping(address => FlipRequest) public flipRequests;

    // Switchboard contract
    ISwitchboard public switchboard;

    constructor(address _switchboard) {
        switchboard = ISwitchboard(_switchboard);
    }

    // Request a coin flip
    function requestFlip() public {
        require(flipRequests[msg.sender].randomnessId == bytes32(0), "Already have pending flip");

        bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        switchboard.createRandomness(randomnessId, 1);

        flipRequests[msg.sender] = FlipRequest({
            user: msg.sender,
            randomnessId: randomnessId,
            requestTimestamp: block.timestamp
        });

        emit CoinFlipRequested(msg.sender, randomnessId);
    }

    // Settle the flip and get the result
    function settleFlip(bytes calldata encodedRandomness) public returns (bool isHeads) {
        FlipRequest memory request = flipRequests[msg.sender];
        require(request.randomnessId != bytes32(0), "No pending flip");

        // Settle the randomness on-chain
        switchboard.settleRandomness(encodedRandomness);

        // Get the randomness value
        SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(request.randomnessId);
        require(randomness.value != 0, "Randomness not resolved");

        // Determine heads or tails: even = heads, odd = tails
        isHeads = uint256(randomness.value) % 2 == 0;

        emit CoinFlipSettled(request.user, isHeads, randomness.value);

        // Clear the request
        delete flipRequests[msg.sender];

        return isHeads;
    }

    // View function to get the flip randomness ID
    function getFlipRandomnessId(address user) public view returns (bytes32) {
        return flipRequests[user].randomnessId;
    }

    // View function to get data needed for off-chain resolution
    function getFlipData(address user) public view returns (address oracle, uint256 rollTimestamp, uint256 minSettlementDelay) {
        SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(flipRequests[user].randomnessId);
        return (randomness.oracle, randomness.rollTimestamp, randomness.minSettlementDelay);
    }
}
