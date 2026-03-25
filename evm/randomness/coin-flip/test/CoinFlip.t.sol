// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {CoinFlip} from "../src/CoinFlip.sol";
import {SwitchboardTypes} from "@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol";

contract MockSwitchboard {
    mapping(bytes32 => SwitchboardTypes.Randomness) internal randomness;
    address internal oracle = address(0xBEEF);
    bool internal settleShouldSucceed = true;

    function setSettleShouldSucceed(bool value) external {
        settleShouldSucceed = value;
    }

    function createRandomness(
        bytes32 randomnessId,
        uint64 minSettlementDelay
    ) external returns (address) {
        randomness[randomnessId] = SwitchboardTypes.Randomness({
            randId: randomnessId,
            createdAt: block.timestamp,
            authority: msg.sender,
            rollTimestamp: block.timestamp,
            minSettlementDelay: minSettlementDelay,
            oracle: oracle,
            value: 0,
            settledAt: 0
        });

        return oracle;
    }

    function settleRandomness(bytes calldata encodedRandomness) external payable {
        require(settleShouldSucceed, "settle failed");

        (bytes32 randomnessId, uint256 value) = abi.decode(
            encodedRandomness,
            (bytes32, uint256)
        );

        randomness[randomnessId].value = value;
        randomness[randomnessId].settledAt = block.timestamp;
    }

    function getRandomness(
        bytes32 randomnessId
    ) external view returns (SwitchboardTypes.Randomness memory) {
        return randomness[randomnessId];
    }
}

contract CoinFlipTest is Test {
    CoinFlip internal coinFlip;
    MockSwitchboard internal switchboard;

    address internal player = address(0xA11CE);

    function setUp() public {
        switchboard = new MockSwitchboard();
        coinFlip = new CoinFlip(address(switchboard));

        vm.deal(player, 10 ether);
    }

    function testRevertsWhenWagerIsZero() public {
        vm.prank(player);
        vm.expectRevert("Must send a positive wager");
        coinFlip.coinFlip{value: 0}();
    }

    function testAcceptsArbitraryPositiveWager() public {
        uint256 wager = 0.123 ether;

        vm.deal(address(coinFlip), wager);

        vm.prank(player);
        coinFlip.coinFlip{value: wager}();

        (
            uint256 amount,
            address user,
            bytes32 randomnessId,
            uint256 flipTimestamp
        ) = coinFlip.wagers(player);

        assertEq(amount, wager);
        assertEq(user, player);
        assertTrue(randomnessId != bytes32(0));
        assertTrue(flipTimestamp > 0);
    }

    function testRevertsWhenBankrollCannotCoverWin() public {
        vm.prank(player);
        vm.expectRevert("Insufficient bankroll");
        coinFlip.coinFlip{value: 0.01 ether}();
    }

    function testPaysWinnerWhenContractIsFunded() public {
        uint256 wager = 0.01 ether;
        uint256 initialBalance = player.balance;

        vm.deal(address(coinFlip), wager);

        vm.prank(player);
        coinFlip.coinFlip{value: wager}();

        bytes32 randomnessId = coinFlip.getWagerRandomnessId(player);

        vm.prank(player);
        coinFlip.settleFlip(abi.encode(randomnessId, uint256(2)));

        assertEq(player.balance, initialBalance + wager);

        (uint256 amount, , , ) = coinFlip.wagers(player);
        assertEq(amount, 0);
    }
}
