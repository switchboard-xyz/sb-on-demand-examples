// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/SwitchboardPriceConsumer.sol";

/**
 * @title DeploySwitchboardPriceConsumer
 * @notice Deployment script for the SwitchboardPriceConsumer contract
 * 
 * Usage:
 *   # Monad Testnet
 *   forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
 *     --rpc-url https://testnet.monad.xyz \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 * 
 *   # Monad Mainnet
 *   forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
 *     --rpc-url https://rpc-mainnet.monadinfra.com/rpc/YOUR_KEY \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 * 
 *   # With environment variables
 *   SWITCHBOARD_ADDRESS=0x... forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     -vvvv
 */
contract DeploySwitchboardPriceConsumer is Script {
    // Monad Switchboard addresses
    address constant MONAD_TESTNET_SWITCHBOARD = 0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33;
    address constant MONAD_MAINNET_SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    function run() external {
        // Get Switchboard address from environment or use default (testnet)
        address switchboardAddress = vm.envOr("SWITCHBOARD_ADDRESS", MONAD_TESTNET_SWITCHBOARD);
        
        console.log("Deploying SwitchboardPriceConsumer...");
        console.log("Switchboard address:", switchboardAddress);
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        SwitchboardPriceConsumer consumer = new SwitchboardPriceConsumer(switchboardAddress);

        vm.stopBroadcast();

        console.log("SwitchboardPriceConsumer deployed at:", address(consumer));
        console.log("");
        console.log("Configuration:");
        console.log("  Max Price Age:", consumer.maxPriceAge(), "seconds");
        console.log("  Max Deviation:", consumer.maxDeviationBps(), "bps");
        console.log("  Owner:", consumer.owner());
        console.log("");
        console.log("Next steps:");
        console.log("1. Save the contract address");
        console.log("2. Run: CONTRACT_ADDRESS=", address(consumer), " bun scripts/run.ts");
    }
}

