// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/SwitchboardPriceConsumer.sol";

/**
 * @title DeploySwitchboardPriceConsumer
 * @notice Deployment script for the SwitchboardPriceConsumer contract
 * 
 * Usage:
 *   # Preferred: use the packaged wrapper so NETWORK and RPC stay in sync
 *   bun run deploy
 *
 *   # Direct forge execution
 *   NETWORK=monad-testnet RPC_URL=https://testnet-rpc.monad.xyz forge script \
 *     deploy/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     -vvvv
 */
contract DeploySwitchboardPriceConsumer is Script {
    address constant MONAD_TESTNET_SWITCHBOARD = 0x6724818814927e057a693f4e3A172b6cC1eA690C;
    address constant MONAD_MAINNET_SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    function run() external {
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

        address deployer = vm.addr(privateKey);

        console.log("Deploying SwitchboardPriceConsumer...");
        console.log("Network:", networkName);
        console.log("Switchboard address:", switchboardAddress);
        console.log("Deployer:", deployer);

        vm.startBroadcast(privateKey);

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
