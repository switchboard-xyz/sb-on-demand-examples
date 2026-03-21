// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PancakeStacker} from "../src/PancakeStacker.sol";

contract PancakeStackerScript is Script {
    address public constant MONAD_TESTNET_SWITCHBOARD = 0x6724818814927e057a693f4e3A172b6cC1eA690C;
    address public constant MONAD_MAINNET_SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    PancakeStacker public pancakeStacker;

    function setUp() public {}

    function run() public {
        address switchboardAddress = vm.envOr(
            "SWITCHBOARD_ADDRESS",
            MONAD_TESTNET_SWITCHBOARD
        );

        vm.startBroadcast();

        pancakeStacker = new PancakeStacker(switchboardAddress);

        console.log("PancakeStacker contract deployed to:", address(pancakeStacker));
        console.log("Switchboard contract:", switchboardAddress);

        vm.stopBroadcast();
    }
}
