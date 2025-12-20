// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title SwitchboardTypes
 * @notice Library containing types used across the Switchboard oracle system
 */
library SwitchboardTypes {
    /**
     * @notice Structure containing feed update data
     * @param slotNumber The Solana slot number (8 bytes)
     * @param timestamp The timestamp of the update
     * @param feedInfos Array of feed information in this update
     * @param signatures Array of oracle signatures (65 bytes each: r + s + v)
     */
    struct FeedUpdateData {
        uint64 slotNumber;
        uint64 timestamp;
        FeedInfo[] feedInfos;
        bytes[] signatures; // Array of 65-byte ECDSA signatures (r + s + v)
    }

    /**
     * @notice Structure containing feed information
     * @param feedId The unique identifier (checksum) of the feed
     * @param value The current value of the feed
     * @param minOracleSamples Minimum number of oracle samples required for this feed
     */
    struct FeedInfo {
        bytes32 feedId;
        int128 value;
        uint8 minOracleSamples;
    }

    /**
     * @notice Packed size constants for data layout compatibility
     */
    uint256 constant FEED_INFO_PACKED_SIZE = 49; // 32 + 16 + 1 bytes

    /**
     * An update to a feed
     * @param result The result of the update
     * @param timestamp The timestamp of the update
     * @param slotNumber The Solana slot number when the update occurred
     */
    struct Update {
        int128 result;
        uint256 timestamp;
        uint64 slotNumber;
    }

    /**
     * Legacy ABI-compatible update structure (matches old on_demand interface)
     * @param feedId The feed identifier (replaces oracleId from legacy)
     * @param result The result of the update
     * @param timestamp The timestamp of the update
     * @param slotNumber The Solana slot number when the update occurred
     */
    struct LegacyUpdate {
        bytes32 feedId;
        int128 result;
        uint256 timestamp;
        uint64 slotNumber;
    }

    /**
     * The current result for a feed (compatible with ISwitchboardModule)
     * @param result The result of the feed
     * @param minTimestamp The minimum timestamp of the feed
     * @param maxTimestamp The maximum timestamp of the feed
     * @param minResult The minimum result of the feed
     * @param maxResult The maximum result of the feed
     * @param stdev The standard deviation of the feed
     * @param range The range of the feed
     * @param mean The mean of the feed
     */
    struct CurrentResult {
        int128 result;
        uint256 minTimestamp;
        uint256 maxTimestamp;
        int128 minResult;
        int128 maxResult;
        int128 stdev;
        int128 range;
        int128 mean;
    }
}
