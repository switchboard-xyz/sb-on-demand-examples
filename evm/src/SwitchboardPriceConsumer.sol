// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { ISwitchboard } from "./switchboard/interfaces/ISwitchboard.sol";
import { SwitchboardTypes } from "./switchboard/libraries/SwitchboardTypes.sol";

/**
 * @title SwitchboardPriceConsumer
 * @notice Example contract demonstrating Switchboard On-Demand oracle integration
 * @dev This contract shows best practices for consuming Switchboard price feeds
 * 
 * Key Features:
 * - Secure price updates with signature verification
 * - Staleness checks to prevent old data usage
 * - Price deviation validation
 * - Multi-feed support
 * - Gas-efficient storage
 * 
 * Use Cases:
 * - DeFi lending protocols (collateral valuation)
 * - DEX price oracles
 * - Options settlement
 * - Prediction markets
 */
contract SwitchboardPriceConsumer {
    // ========== State Variables ==========

    /// @notice The Switchboard contract interface
    ISwitchboard public immutable switchboard;

    /// @notice Stored price data for each feed
    mapping(bytes32 => PriceData) public prices;

    /// @notice Maximum age for price data (default: 5 minutes)
    uint256 public maxPriceAge = 300;

    /// @notice Maximum price deviation in basis points (default: 10% = 1000 bps)
    uint256 public maxDeviationBps = 1000;

    /// @notice Contract owner
    address public owner;

    // ========== Structs ==========

    /**
     * @notice Stored price information for a feed
     * @param value The price value (18 decimals)
     * @param timestamp When the price was last updated
     * @param slotNumber Solana slot number of the update
     */
    struct PriceData {
        int128 value;
        uint256 timestamp;
        uint64 slotNumber;
    }

    // ========== Events ==========

    /**
     * @notice Emitted when a price is updated
     * @param feedId The feed identifier
     * @param oldPrice The previous price (0 if first update)
     * @param newPrice The new price
     * @param timestamp The update timestamp
     * @param slotNumber The Solana slot number
     */
    event PriceUpdated(
        bytes32 indexed feedId,
        int128 oldPrice,
        int128 newPrice,
        uint256 timestamp,
        uint64 slotNumber
    );

    /**
     * @notice Emitted when price validation fails
     * @param feedId The feed identifier
     * @param reason The failure reason
     */
    event PriceValidationFailed(bytes32 indexed feedId, string reason);

    /**
     * @notice Emitted when configuration is updated
     * @param maxPriceAge New maximum price age
     * @param maxDeviationBps New maximum deviation in basis points
     */
    event ConfigUpdated(uint256 maxPriceAge, uint256 maxDeviationBps);

    // ========== Errors ==========

    error InsufficientFee(uint256 expected, uint256 received);
    error PriceTooOld(uint256 age, uint256 maxAge);
    error PriceDeviationTooHigh(uint256 deviation, uint256 maxDeviation);
    error InvalidFeedId();
    error Unauthorized();
    error InvalidConfiguration();

    // ========== Constructor ==========

    /**
     * @notice Initialize the price consumer
     * @param _switchboard Address of the Switchboard contract
     */
    constructor(address _switchboard) {
        if (_switchboard == address(0)) revert InvalidConfiguration();
        switchboard = ISwitchboard(_switchboard);
        owner = msg.sender;
    }

    // ========== Modifiers ==========

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ========== External Functions ==========

    /**
     * @notice Update price feeds with oracle data
     * @dev This is the main entry point for updating prices
     * @param updates Encoded Switchboard updates with signatures
     * @param feedIds Array of feed IDs to process from the update
     */
    function updatePrices(
        bytes[] calldata updates,
        bytes32[] calldata feedIds
    ) external payable {
        // Get the required fee (may be 0 on some networks)
        uint256 fee = switchboard.getFee(updates);
        if (msg.value < fee) {
            revert InsufficientFee(fee, msg.value);
        }

        // Submit updates to Switchboard (this verifies signatures)
        switchboard.updateFeeds{ value: fee }(updates);

        // Process each feed ID
        for (uint256 i = 0; i < feedIds.length; i++) {
            bytes32 feedId = feedIds[i];
            
            // Get the latest verified update from Switchboard
            SwitchboardTypes.LegacyUpdate memory update = switchboard.latestUpdate(feedId);
            
            // Process the feed update (convert timestamp to uint64)
            _processFeedUpdate(
                feedId,
                update.result,
                uint64(update.timestamp),
                update.slotNumber
            );
        }

        // Refund excess payment
        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{ value: msg.value - fee }("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Get the current price for a feed
     * @param feedId The feed identifier
     * @return value The price value
     * @return timestamp The update timestamp
     * @return slotNumber The Solana slot number
     */
    function getPrice(
        bytes32 feedId
    ) external view returns (int128 value, uint256 timestamp, uint64 slotNumber) {
        PriceData memory priceData = prices[feedId];
        if (priceData.timestamp == 0) revert InvalidFeedId();
        return (priceData.value, priceData.timestamp, priceData.slotNumber);
    }

    /**
     * @notice Check if a price is fresh (within maxPriceAge)
     * @param feedId The feed identifier
     * @return bool True if the price is fresh
     */
    function isPriceFresh(bytes32 feedId) public view returns (bool) {
        PriceData memory priceData = prices[feedId];
        if (priceData.timestamp == 0) return false;
        return block.timestamp - priceData.timestamp <= maxPriceAge;
    }

    /**
     * @notice Get the age of a price in seconds
     * @param feedId The feed identifier
     * @return uint256 The age in seconds
     */
    function getPriceAge(bytes32 feedId) external view returns (uint256) {
        PriceData memory priceData = prices[feedId];
        if (priceData.timestamp == 0) return type(uint256).max;
        return block.timestamp - priceData.timestamp;
    }

    /**
     * @notice Update configuration parameters
     * @param _maxPriceAge New maximum price age in seconds
     * @param _maxDeviationBps New maximum deviation in basis points
     */
    function updateConfig(
        uint256 _maxPriceAge,
        uint256 _maxDeviationBps
    ) external onlyOwner {
        if (_maxPriceAge == 0 || _maxDeviationBps == 0) {
            revert InvalidConfiguration();
        }
        maxPriceAge = _maxPriceAge;
        maxDeviationBps = _maxDeviationBps;
        emit ConfigUpdated(_maxPriceAge, _maxDeviationBps);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidConfiguration();
        owner = newOwner;
    }

    // ========== Example Business Logic Functions ==========

    /**
     * @notice Calculate collateral ratio for a lending position
     * @dev Example function showing how to use prices in DeFi logic
     * @param feedId The collateral asset feed ID
     * @param collateralAmount Amount of collateral
     * @param debtAmount Amount of debt (in USD, 18 decimals)
     * @return ratio The collateral ratio in basis points (e.g., 15000 = 150%)
     */
    function calculateCollateralRatio(
        bytes32 feedId,
        uint256 collateralAmount,
        uint256 debtAmount
    ) external view returns (uint256 ratio) {
        // Ensure price is fresh
        if (!isPriceFresh(feedId)) {
            revert PriceTooOld(block.timestamp - prices[feedId].timestamp, maxPriceAge);
        }

        PriceData memory priceData = prices[feedId];
        
        // Calculate collateral value in USD
        uint256 collateralValue = (collateralAmount * uint128(priceData.value)) / 1e18;
        
        // Calculate ratio in basis points
        ratio = (collateralValue * 10000) / debtAmount;
    }

    /**
     * @notice Check if a position should be liquidated
     * @dev Example function for liquidation logic
     * @param feedId The collateral asset feed ID
     * @param collateralAmount Amount of collateral
     * @param debtAmount Amount of debt
     * @param liquidationThreshold Threshold in basis points (e.g., 11000 = 110%)
     * @return bool True if position should be liquidated
     */
    function shouldLiquidate(
        bytes32 feedId,
        uint256 collateralAmount,
        uint256 debtAmount,
        uint256 liquidationThreshold
    ) external view returns (bool) {
        if (!isPriceFresh(feedId)) {
            return false; // Don't liquidate with stale data
        }

        PriceData memory priceData = prices[feedId];
        uint256 collateralValue = (collateralAmount * uint128(priceData.value)) / 1e18;
        uint256 ratio = (collateralValue * 10000) / debtAmount;
        
        return ratio < liquidationThreshold;
    }

    // ========== Internal Functions ==========

    /**
     * @notice Process a single feed update
     * @param feedId The feed identifier
     * @param newValue The new price value
     * @param timestamp The update timestamp
     * @param slotNumber The Solana slot number
     */
    function _processFeedUpdate(
        bytes32 feedId,
        int128 newValue,
        uint64 timestamp,
        uint64 slotNumber
    ) internal {
        PriceData memory oldPrice = prices[feedId];

        // Validate price deviation if we have a previous price
        if (oldPrice.timestamp != 0) {
            uint256 deviation = _calculateDeviation(oldPrice.value, newValue);
            if (deviation > maxDeviationBps) {
                emit PriceValidationFailed(feedId, "Deviation too high");
                revert PriceDeviationTooHigh(deviation, maxDeviationBps);
            }
        }

        // Store the new price
        prices[feedId] = PriceData({
            value: newValue,
            timestamp: timestamp,
            slotNumber: slotNumber
        });

        emit PriceUpdated(
            feedId,
            oldPrice.value,
            newValue,
            timestamp,
            slotNumber
        );
    }

    /**
     * @notice Calculate price deviation in basis points
     * @param oldValue The old price
     * @param newValue The new price
     * @return deviation The deviation in basis points
     */
    function _calculateDeviation(
        int128 oldValue,
        int128 newValue
    ) internal pure returns (uint256 deviation) {
        if (oldValue == 0) return 0;

        uint128 absOld = oldValue < 0 ? uint128(-oldValue) : uint128(oldValue);
        uint128 absNew = newValue < 0 ? uint128(-newValue) : uint128(newValue);

        uint128 diff = absNew > absOld ? absNew - absOld : absOld - absNew;
        deviation = (uint256(diff) * 10000) / uint256(absOld);
    }

    // ========== View Functions ==========

    /**
     * @notice Get the Switchboard contract address
     * @return address The Switchboard contract address
     */
    function getSwitchboardAddress() external view returns (address) {
        return address(switchboard);
    }

    /**
     * @notice Get all price data for a feed
     * @param feedId The feed identifier
     * @return PriceData The complete price data
     */
    function getPriceData(bytes32 feedId) external view returns (PriceData memory) {
        return prices[feedId];
    }
}

