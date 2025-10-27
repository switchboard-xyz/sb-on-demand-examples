// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// forge script script/Deploy.s.sol:DeployScript --rpc-url https://rpc.hyperliquid.xyz/evm --broadcast -vv

import "forge-std/Script.sol";
import {Example} from "../src/Example.sol";
import {ISwitchboard} from "@switchboard-xyz/on-demand-solidity/ISwitchboard.sol";
import {Structs} from "@switchboard-xyz/on-demand-solidity/structs/Structs.sol";

contract DeployScript is Script {
    Example public example;

    function run() external {
        console.log("running deploy script");

        // read env variables and choose EOA for transaction signing
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Get the Aggregator ID
        bytes32 aggregatorId = vm.envBytes32("AGGREGATOR_ID");

        // Get Switchboard address from environment variable
        // For networks addresses, see https://docs.switchboard.xyz/product-documentation/data-feeds/evm
        address switchboard = vm.envAddress("SWITCHBOARD_ADDRESS");

        // Get Switchboard
        ISwitchboard sb = ISwitchboard(switchboard);
        // Get the Aggregator
        (Structs.Aggregator memory aggregator, ) = sb.getAggregator(
            aggregatorId
        );

        // Log the Configs
        console.log("Authority:");
        console.log(aggregator.authority);

        console.log("Name:");
        console.log(aggregator.name);

        console.log("Queue ID:");
        console.logBytes32(aggregator.queueId);

        console.log("Tolerated Delta:");
        console.log(aggregator.toleratedDelta);

        console.log("CID:");
        console.logBytes32(aggregator.cid);

        console.log("Feed Hash:");
        console.logBytes32(aggregator.feedHash);

        console.log("Created At:");
        console.log(aggregator.createdAt);

        console.log("Max Variance:");
        console.log(aggregator.maxVariance);

        console.log("Min Responses:");
        console.log(aggregator.minResponses);

        console.log("Min Samples:");
        console.log(aggregator.minSamples);

        console.log("Max Staleness:");
        console.log(aggregator.maxStaleness);

        vm.startBroadcast(deployerPrivateKey);
        example = new Example(
            switchboard,
            aggregatorId
        );

        vm.setEnv("EXAMPLE_ADDRESS", vm.toString(address(example)));
        vm.stopBroadcast();
    }
}