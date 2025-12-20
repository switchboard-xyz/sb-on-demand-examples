// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PancakeStacker} from "../src/PancakeStacker.sol";

contract PancakeStackerScript is Script {

    // Mainnet: 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67
    // Testnet: 0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33
    address public constant SWITCHBOARD_ADDRESS = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    PancakeStacker public pancakeStacker;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        pancakeStacker = new PancakeStacker(SWITCHBOARD_ADDRESS);

        console.log("PancakeStacker contract deployed to:", address(pancakeStacker));

        vm.stopBroadcast();
    }
}
