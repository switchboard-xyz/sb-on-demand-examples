// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title RandomnessConsumer
 * @notice Example contract demonstrating Switchboard randomness on Monad Testnet
 * @dev This contract shows how to:
 *      1. Request verifiable randomness from Switchboard oracles
 *      2. Resolve the randomness after settlement delay
 *      3. Use the random value in your application
 *
 * Use Cases:
 * - Gaming: Fair dice rolls, card shuffling, loot drops
 * - NFTs: Random trait generation, fair minting order
 * - DeFi: Random winner selection, lottery systems
 * - DAOs: Random committee selection
 */

// ========== Inline Interfaces (avoiding SDK import path issues) ==========

/**
 * @notice Randomness result structure
 */
struct RandomnessResult {
    bytes32 oracleId;
    address oracleAuthority;
    uint256 value;
    uint256 settledAt;
}

/**
 * @notice Full randomness structure
 */
struct Randomness {
    bytes32 randId;
    bytes32 queueId;
    uint256 createdAt;
    address authority;
    uint256 rollTimestamp;
    uint64 minSettlementDelay;
    RandomnessResult result;
}

/**
 * @notice Interface for Switchboard randomness module
 */
interface ISwitchboardRandomness {
    function requestRandomness(
        bytes32 randomnessId,
        address authority,
        bytes32 queueId,
        uint64 minSettlementDelay
    ) external;

    function requestRandomness(
        bytes32 randomnessId,
        address authority,
        bytes32 queueId,
        uint64 minSettlementDelay,
        bytes32 oracleId
    ) external;

    function rerollRandomness(bytes32 randomnessId) external;

    function getRandomness(bytes32 randomnessId) external view returns (Randomness memory);

    function updateFeeds(bytes[] calldata updates) external payable;
}

// ========== Main Contract ==========

contract RandomnessConsumer {
    // ========== State Variables ==========

    /// @notice The Switchboard contract address
    address public immutable SWITCHBOARD;

    /// @notice Queue ID for randomness requests
    /// @dev Testnet: 0xc9477bfb5ff1012859f336cf98725680e7705ba2abece17188cfb28ca66ca5b0
    /// @dev Mainnet: 0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752
    bytes32 public immutable QUEUE_ID;

    /// @notice Current randomness request ID
    bytes32 public randomnessId;

    /// @notice The resolved random value
    uint256 public randomValue;

    /// @notice Whether randomness has been resolved
    bool public isResolved;

    /// @notice Counter for generating unique randomness IDs
    uint256 private nonce;

    /// @notice Minimum delay before randomness can be settled (seconds)
    uint64 public constant MIN_SETTLEMENT_DELAY = 1;

    /// @notice Contract owner
    address public owner;

    // ========== Events ==========

    event RandomnessRequested(bytes32 indexed randomnessId, address indexed requester);
    event RandomnessResolved(bytes32 indexed randomnessId, uint256 value);
    event RandomnessRerolled(bytes32 indexed randomnessId);

    // ========== Errors ==========

    error Unauthorized();
    error RandomnessNotRequested();
    error RandomnessNotSettled();
    error RandomnessAlreadyResolved();
    error InvalidSwitchboardAddress();

    // ========== Constructor ==========

    /**
     * @notice Initialize the randomness consumer
     * @param _switchboard Address of the Switchboard contract on Monad
     * @param _queueId Queue ID for randomness requests
     */
    constructor(address _switchboard, bytes32 _queueId) {
        if (_switchboard == address(0)) revert InvalidSwitchboardAddress();
        SWITCHBOARD = _switchboard;
        QUEUE_ID = _queueId;
        owner = msg.sender;
    }

    // ========== Modifiers ==========

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) revert Unauthorized();
    }

    // ========== External Functions ==========

    /**
     * @notice Request new randomness from Switchboard
     * @dev Generates a unique randomness ID and submits request to Switchboard
     * @return The randomness ID for this request
     */
    function requestRandomness() external returns (bytes32) {
        // Generate unique randomness ID
        randomnessId = keccak256(
            abi.encodePacked(
                address(this),
                msg.sender,
                block.timestamp,
                nonce++
            )
        );

        // Reset state for new request
        isResolved = false;
        randomValue = 0;

        // Request randomness from Switchboard
        ISwitchboardRandomness(SWITCHBOARD).requestRandomness(
            randomnessId,
            address(this),  // authority - this contract manages the randomness
            QUEUE_ID,
            MIN_SETTLEMENT_DELAY
        );

        emit RandomnessRequested(randomnessId, msg.sender);
        return randomnessId;
    }

    /**
     * @notice Request randomness with a specific oracle
     * @dev Use this if you want to specify which oracle should provide randomness
     * @param oracleId The oracle to request randomness from
     * @return The randomness ID for this request
     */
    function requestRandomnessFromOracle(bytes32 oracleId) external returns (bytes32) {
        // Generate unique randomness ID
        randomnessId = keccak256(
            abi.encodePacked(
                address(this),
                msg.sender,
                block.timestamp,
                nonce++
            )
        );

        // Reset state
        isResolved = false;
        randomValue = 0;

        // Request randomness from specific oracle
        ISwitchboardRandomness(SWITCHBOARD).requestRandomness(
            randomnessId,
            address(this),
            QUEUE_ID,
            MIN_SETTLEMENT_DELAY,
            oracleId
        );

        emit RandomnessRequested(randomnessId, msg.sender);
        return randomnessId;
    }

    /**
     * @notice Resolve randomness by submitting oracle updates
     * @dev Call this after the settlement delay has passed
     * @param updates Encoded oracle updates from Crossbar
     */
    function resolveRandomness(bytes[] calldata updates) external {
        if (randomnessId == bytes32(0)) revert RandomnessNotRequested();
        if (isResolved) revert RandomnessAlreadyResolved();

        // Submit the oracle updates to Switchboard
        ISwitchboardRandomness(SWITCHBOARD).updateFeeds(updates);

        // Get the randomness result
        Randomness memory randomness = ISwitchboardRandomness(SWITCHBOARD).getRandomness(randomnessId);

        // Verify randomness was settled
        if (randomness.result.settledAt == 0) revert RandomnessNotSettled();

        // Store the random value
        randomValue = randomness.result.value;
        isResolved = true;

        emit RandomnessResolved(randomnessId, randomValue);
    }

    /**
     * @notice Reroll randomness (request new randomness with same ID)
     * @dev Use this if the previous randomness request failed or you want fresh randomness
     */
    function rerollRandomness() external {
        if (randomnessId == bytes32(0)) revert RandomnessNotRequested();

        // Reset resolved state
        isResolved = false;
        randomValue = 0;

        // Request reroll
        ISwitchboardRandomness(SWITCHBOARD).rerollRandomness(randomnessId);

        emit RandomnessRerolled(randomnessId);
    }

    // ========== View Functions ==========

    /**
     * @notice Get the current randomness ID
     * @return The current randomness request ID
     */
    function getRandomnessId() external view returns (bytes32) {
        return randomnessId;
    }

    /**
     * @notice Get the full randomness state from Switchboard
     * @return The Randomness struct from Switchboard
     */
    function getRandomnessState() external view returns (Randomness memory) {
        if (randomnessId == bytes32(0)) revert RandomnessNotRequested();
        return ISwitchboardRandomness(SWITCHBOARD).getRandomness(randomnessId);
    }

    // ========== Utility Functions for Using Randomness ==========

    /**
     * @notice Get a random number within a range [0, max)
     * @param max The exclusive upper bound
     * @return A random number between 0 and max-1
     */
    function getRandomInRange(uint256 max) external view returns (uint256) {
        if (!isResolved) revert RandomnessNotSettled();
        return randomValue % max;
    }

    /**
     * @notice Get a random number within a range [min, max)
     * @param min The inclusive lower bound
     * @param max The exclusive upper bound
     * @return A random number between min and max-1
     */
    function getRandomInRangeMinMax(uint256 min, uint256 max) external view returns (uint256) {
        if (!isResolved) revert RandomnessNotSettled();
        require(max > min, "Invalid range");
        return min + (randomValue % (max - min));
    }

    /**
     * @notice Simulate a dice roll (1-6)
     * @return A number between 1 and 6
     */
    function rollDice() external view returns (uint8) {
        if (!isResolved) revert RandomnessNotSettled();
        return uint8((randomValue % 6) + 1);
    }

    /**
     * @notice Simulate a coin flip
     * @return true for heads, false for tails
     */
    function flipCoin() external view returns (bool) {
        if (!isResolved) revert RandomnessNotSettled();
        return randomValue % 2 == 0;
    }

    /**
     * @notice Generate multiple random numbers from a single randomness value
     * @dev Uses keccak256 to derive additional random values
     * @param count Number of random values to generate
     * @return An array of random uint256 values
     */
    function getMultipleRandom(uint256 count) external view returns (uint256[] memory) {
        if (!isResolved) revert RandomnessNotSettled();

        uint256[] memory randoms = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            randoms[i] = uint256(keccak256(abi.encodePacked(randomValue, i)));
        }
        return randoms;
    }

    /**
     * @notice Shuffle an array using Fisher-Yates algorithm
     * @dev Useful for card games, random ordering, etc.
     * @param array The array to shuffle (will be modified in place conceptually, but we return a new array)
     * @return shuffled The shuffled array
     */
    function shuffleArray(uint256[] calldata array) external view returns (uint256[] memory shuffled) {
        if (!isResolved) revert RandomnessNotSettled();

        uint256 length = array.length;
        shuffled = new uint256[](length);

        // Copy array
        for (uint256 i = 0; i < length; i++) {
            shuffled[i] = array[i];
        }

        // Fisher-Yates shuffle
        for (uint256 i = length - 1; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encodePacked(randomValue, i))) % (i + 1);
            // Swap
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }

        return shuffled;
    }

    // ========== Admin Functions ==========

    /**
     * @notice Transfer ownership
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
