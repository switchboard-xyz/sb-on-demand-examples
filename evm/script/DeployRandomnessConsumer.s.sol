// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {RandomnessConsumer} from "../src/RandomnessConsumer.sol";

/**
 * @title DeployRandomnessConsumer
 * @notice Deployment script for the RandomnessConsumer contract
 *
 * Usage:
 *   # Monad Testnet
 *   forge script script/DeployRandomnessConsumer.s.sol:DeployRandomnessConsumer \
 *     --rpc-url https://testnet-rpc.monad.xyz \
 *     --broadcast \
 *     -vvvv
 *
 *   # With environment variables
 *   SWITCHBOARD_ADDRESS=0x... QUEUE_ID=0x... forge script script/DeployRandomnessConsumer.s.sol:DeployRandomnessConsumer \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     -vvvv
 */
contract DeployRandomnessConsumer is Script {
    // Monad Switchboard addresses
    address constant MONAD_TESTNET_SWITCHBOARD = 0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C;
    address constant MONAD_MAINNET_SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    // Queue IDs
    bytes32 constant TESTNET_QUEUE_ID = 0xc9477bfb5ff1012859f336cf98725680e7705ba2abece17188cfb28ca66ca5b0;
    bytes32 constant MAINNET_QUEUE_ID = 0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752;

    function run() external {
        // Get configuration from environment or use defaults (testnet)
        address switchboardAddress = vm.envOr("SWITCHBOARD_ADDRESS", MONAD_TESTNET_SWITCHBOARD);
        bytes32 queueId = vm.envOr("QUEUE_ID", TESTNET_QUEUE_ID);

        console.log("Deploying RandomnessConsumer...");
        console.log("Switchboard address:", switchboardAddress);
        console.log("Queue ID:", vm.toString(queueId));
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        RandomnessConsumer consumer = new RandomnessConsumer(switchboardAddress, queueId);

        vm.stopBroadcast();

        console.log("");
        console.log("RandomnessConsumer deployed at:", address(consumer));
        console.log("");
        console.log("Configuration:");
        console.log("  Switchboard:", consumer.SWITCHBOARD());
        console.log("  Queue ID:", vm.toString(consumer.QUEUE_ID()));
        console.log("  Owner:", consumer.owner());
        console.log("  Min Settlement Delay:", consumer.MIN_SETTLEMENT_DELAY(), "seconds");
        console.log("");
        console.log("Next steps:");
        console.log("1. Set the contract address in your environment:");
        console.log("   export RANDOMNESS_CONTRACT_ADDRESS=", address(consumer));
        console.log("2. Run the randomness script:");
        console.log("   bun run randomness");
    }
}
