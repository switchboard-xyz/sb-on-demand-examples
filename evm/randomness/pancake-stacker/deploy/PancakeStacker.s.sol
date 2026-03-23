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
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        string memory networkName = vm.envString("NETWORK");
        (address expectedSwitchboard, uint256 expectedChainId) =
            resolveNetwork(networkName);
        address switchboardAddress =
            vm.envOr("SWITCHBOARD_ADDRESS", expectedSwitchboard);

        require(
            switchboardAddress == expectedSwitchboard,
            "SWITCHBOARD_ADDRESS must match NETWORK"
        );
        require(
            block.chainid == expectedChainId,
            "RPC chain ID does not match NETWORK"
        );
        require(
            switchboardAddress.code.length > 0,
            "No code at Switchboard address"
        );

        vm.startBroadcast(privateKey);

        pancakeStacker = new PancakeStacker(switchboardAddress);

        console.log("PancakeStacker contract deployed to:", address(pancakeStacker));
        console.log("Network:", networkName);
        console.log("Switchboard contract:", switchboardAddress);

        vm.stopBroadcast();
    }

    function resolveNetwork(string memory networkName)
        internal
        pure
        returns (address switchboardAddress, uint256 chainId)
    {
        if (equal(networkName, "monad-testnet")) {
            return (MONAD_TESTNET_SWITCHBOARD, 10143);
        }

        if (equal(networkName, "monad-mainnet")) {
            return (MONAD_MAINNET_SWITCHBOARD, 143);
        }

        revert("Unsupported NETWORK");
    }

    function equal(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
