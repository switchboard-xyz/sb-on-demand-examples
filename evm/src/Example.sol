//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {ISwitchboard} from "@switchboard-xyz/on-demand-solidity/ISwitchboard.sol";

contract Example {
    ISwitchboard switchboard;

    // Every Switchboard Feed has a unique aggregatorId.
    bytes32 public aggregatorId;

    // The latest price from the feed
    int256 public latestPrice;

    // If the transaction fee is not paid, the update will fail.
    error InsufficientFee(uint256 expected, uint256 received);

    // If the feed result is invalid, this error will be emitted.
    error InvalidResult(int128 result);

    // If the Switchboard update succeeds, this event will be emitted with the latest price.
    event FeedData(int128 price);

    /**
     * @param _switchboard The address of the Switchboard contract
     * @param _aggregatorId The feed ID for the feed you want to query
     */
    constructor(address _switchboard, bytes32 _aggregatorId) {
        // Initialize the target _switchboard
        // Get the existing Switchboard contract address on your preferred network from the Switchboard Docs
        switchboard = ISwitchboard(_switchboard);
        aggregatorId = _aggregatorId;
    }

    /**
     * getFeedData is a function that uses an encoded Switchboard update
     * If the update is successful, it will read the latest price from the feed
     * See below for fetching encoded updates (e.g., using the Switchboard Typescript SDK)
     * @param updates Encoded feed updates to update the contract with the latest result
     */
    function getFeedData(bytes[] calldata updates) public payable {
        // Get the fee for updating the feeds. If the transaction fee is not paid, the update will fail.
        uint256 fee = switchboard.getFee(updates);
        if (msg.value < fee) {
            revert InsufficientFee(fee, msg.value);
        }

        // Submit the updates to the Switchboard contract
        switchboard.updateFeeds{value: fee}(updates);

        // Read the current value from a Switchboard feed.
        // This will fail if the feed doesn't have fresh updates ready (e.g. if the feed update failed)
        // Get the latest feed result
        // This is encoded as decimal * 10^18 to avoid floating point issues
        int128 result = switchboard.latestUpdate(aggregatorId).result;

        // In this example, we revert if the result is negative
        if (result < 0) {
            revert InvalidResult(result);
        }

        latestPrice = result;

        // Emit the latest result from the feed
        emit FeedData(result);
    }
}