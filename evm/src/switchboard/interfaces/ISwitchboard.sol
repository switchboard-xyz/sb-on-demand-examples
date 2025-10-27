// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SwitchboardTypes } from '../libraries/SwitchboardTypes.sol';

/**
 * @title ISwitchboard
 * @notice Interface for the Switchboard contract
 */
interface ISwitchboard {
    /**
     * Update feeds with new oracle results
     * @dev This is for backwards compatibility with Switchboard on-demand contracts
     * @dev reverts if the timestamp is out of valid range (optional flow for timestamp-sequenced updates)
     * @param updates Encoded switchboard update(s) with signatures
     */
    function updateFeeds(bytes[] calldata updates) external payable;

    /**
     * @notice Main API - Updates feeds from encoded bytes data
     * @param feeds The encoded feed update data as bytes
     * @return updateData The parsed FeedUpdateData struct
     */
    function updateFeeds(
        bytes calldata feeds
    )
        external
        payable
        returns (SwitchboardTypes.FeedUpdateData memory updateData);

    /**
     * @notice Gets a verified feed value or reverts
     * @param updateData The feed update data
     * @param feedId The ID of the feed
     * @return value The verified value of the feed
     * @return timestamp The verified timestamp of the feed
     */
    function getFeedValue(
        SwitchboardTypes.FeedUpdateData calldata updateData,
        bytes32 feedId
    )
        external
        view
        returns (int256 value, uint256 timestamp, uint64 slotNumber);

    /**
     * @notice Gets the verifier contract address
     * @return The address of the verifier contract
     */
    function verifierAddress() external view returns (address);

    /**
     * @notice Gets the implementation address
     * @return The address of the implementation contract
     */
    function implementation() external view returns (address);

    /**
     * Get the latest Update struct for a feed
     * @dev This is for backwards compatibility with the old Switchboard contracts
     * @dev Intended to be called within the same transaction as a feed update for the most up-to-date data.
     * @dev Reverts if the feed does not have the minimum number of valid responses
     * @param feedId The identifier for the feed to get the latest update for
     * @return Update The latest update for the given feed (LegacyUpdate format for ABI compatibility)
     */
    function latestUpdate(
        bytes32 feedId
    ) external view returns (SwitchboardTypes.LegacyUpdate memory);

    /**
     * Get the fee in wei for submitting a set of updates
     * @dev This is for backwards compatibility with the old Switchboard contracts
     * @param updates Encoded switchboard update(s) with signatures
     * @return uint256 The fee in wei for submitting the updates
     */
    function getFee(bytes[] calldata updates) external view returns (uint256);
}
