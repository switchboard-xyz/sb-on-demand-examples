// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {CoinFlip} from "../src/CoinFlip.sol";

contract CoinFlipScript is Script {

    address public constant SWITCHBOARD_ADDRESS = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    CoinFlip public coinFlip;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        coinFlip = new CoinFlip(SWITCHBOARD_ADDRESS);
        
        console.log("CoinFlip contract deployed to:", address(coinFlip));

        vm.stopBroadcast();
    }
}
