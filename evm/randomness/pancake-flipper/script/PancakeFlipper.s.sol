// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PancakeFlipper} from "../src/PancakeFlipper.sol";

contract PancakeFlipperScript is Script {

    address public constant SWITCHBOARD_ADDRESS = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    PancakeFlipper public pancakeFlipper;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        pancakeFlipper = new PancakeFlipper(SWITCHBOARD_ADDRESS);

        console.log("PancakeFlipper contract deployed to:", address(pancakeFlipper));

        vm.stopBroadcast();
    }
}
