// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { ISwitchboard } from '@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol';
import { SwitchboardTypes } from '@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol';

contract CoinFlip {

    // Wager data
    struct Wager {
        uint256 amount;
        address user;
        bytes32 randomnessId;
        uint256 flipTimestamp;
    }

    // Events
    event CoinFlipped(address indexed user, bytes32 randomnessId, uint256 amount);
    event FlipSettled(address indexed user, bool won, uint256 payout, uint256 randomValue);
    event SettlementFailed(address indexed user);

    // minimum flip amount
    uint256 public constant MIN_FLIP_AMOUNT = 1 ether; 

    // Wager data mapping
    mapping(address => Wager) public wagers;

    // Switchboard Smart Contract
    ISwitchboard public switchboard;

    // Pass in the Switchboard Smart Contract address
    // when deploying the contract
    constructor(address _switchboard) {
        switchboard = ISwitchboard(_switchboard);
    }

    // do the flip
    function coinFlip() public payable {
        require(msg.value == MIN_FLIP_AMOUNT, "Must send exactly 1 ETH");
        require(wagers[msg.sender].amount == 0, "Already flipped");
        bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1)));
        switchboard.createRandomness(randomnessId, 1);
        wagers[msg.sender] = Wager({
            amount: msg.value,
            user: msg.sender,
            randomnessId: randomnessId,
            flipTimestamp: block.timestamp
        });

        emit CoinFlipped(msg.sender, randomnessId, msg.value);
    }

    // settle the flip
    function settleFlip(bytes calldata encodedRandomness) public {
        // Check that the user has a pending wager
        Wager memory wager = wagers[msg.sender];
        require(wager.amount > 0, "No pending wager");

        // Clear the wager BEFORE external calls (CEI pattern)
        delete wagers[msg.sender];

        // Try to settle the randomness
        try switchboard.settleRandomness(encodedRandomness) {
            // Check that randomness is resolved
            SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(wager.randomnessId);
            require(randomness.value != 0, "Randomness not resolved");

            // Verify the randomness ID matches the wager
            require(randomness.randId == wager.randomnessId, "Randomness ID mismatch");

            // Determine win/lose: even = win, odd = lose
            bool won = uint256(randomness.value) % 2 == 0;
            uint256 payout = 0;

            // Pay out the winner
            if (won) {
                payout = wager.amount * 2;
                (bool success, ) = wager.user.call{value: payout}("");
                require(success, "Transfer failed");
            }

            emit FlipSettled(wager.user, won, payout, randomness.value);

        } catch {
            // Settlement failed - treat as a loss and clear the wager
            // This could be due to oracle issues or malformed randomness
            emit SettlementFailed(msg.sender);
        }
    }

    // View function to get the wager randomness ID
    function getWagerRandomnessId(address user) public view returns (bytes32) {
        return wagers[user].randomnessId;
    }

    // View function to get the assigned oracle, roll timestamp, and min settlement delay
    function getWagerData(address user) public view returns (address oracle, uint256 rollTimestamp, uint256 minSettlementDelay) {
        SwitchboardTypes.Randomness memory randomness = switchboard.getRandomness(wagers[user].randomnessId);
        return (randomness.oracle, randomness.rollTimestamp, randomness.minSettlementDelay);
    }


    // Just allow the contract to receive ETH
    receive() external payable {}
}
