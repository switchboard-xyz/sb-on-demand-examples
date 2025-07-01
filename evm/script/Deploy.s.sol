// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// forge script script/Deploy.s.sol:DeployScript --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast -vv

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

        // Arbitrum Sepolia Switchboard Address
        address switchboard = 0xA2a0425fA3C5669d384f4e6c8068dfCf64485b3b;

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
            // Arbitrum Sepolia: Carbon Intensity Great Britain (0xba2...86572)
            // https://ondemand.switchboard.xyz/arbitrum/sepolia/feed/0xba2c99cb1c50d8c77209adc5a45f82e561c29f5b279dca507b4f1324b6586572

            // Arbitrum Sepolia: UNI / USD (0x755...d4878)
            // https://beta.ondemand.switchboard.xyz/arbitrum/sepolia/feed/0x755c0da00f939b04266f3ba3619ad6498fb936a8bfbfac27c9ecd4ab4c5d4878
            aggregatorId
        );

        vm.setEnv("EXAMPLE_ADDRESS", vm.toString(address(example)));
        vm.stopBroadcast();
    }
}