// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {CoinFlip} from "../src/CoinFlip.sol";

contract CoinFlipScript is Script {
    address public constant MONAD_TESTNET_SWITCHBOARD = 0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33;
    address public constant MONAD_MAINNET_SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    CoinFlip public coinFlip;

    function setUp() public {}

    function run() public {
        address switchboardAddress = vm.envOr(
            "SWITCHBOARD_ADDRESS",
            MONAD_TESTNET_SWITCHBOARD
        );

        vm.startBroadcast();

        coinFlip = new CoinFlip(switchboardAddress);
        
        console.log("CoinFlip contract deployed to:", address(coinFlip));
        console.log("Switchboard contract:", switchboardAddress);

        vm.stopBroadcast();
    }
}
