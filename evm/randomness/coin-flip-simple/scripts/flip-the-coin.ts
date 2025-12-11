import { ethers } from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";

async function main() {

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY is not set");
    }

    const provider = new ethers.JsonRpcProvider("https://rpc.monad.xyz");
    const wallet = new ethers.Wallet(privateKey, provider);

    // Initialize Crossbar
    const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

    const COIN_FLIP_CONTRACT_ADDRESS = process.env.COIN_FLIP_CONTRACT_ADDRESS;

    if (!COIN_FLIP_CONTRACT_ADDRESS) {
        throw new Error("COIN_FLIP_CONTRACT_ADDRESS is not set");
    }

    // CoinFlip ABI
    const coinFlipAbi = [
        "function flipCoin() public",
        "function settleFlip(bytes calldata encodedRandomness) public returns (bool isHeads)",
        "function getFlipRandomnessId(address user) public view returns (bytes32)",
        "function getFlipData(address user) public view returns (address oracle, uint256 rollTimestamp, uint256 minSettlementDelay)",
        "event CoinFlipRequested(address indexed user, bytes32 randomnessId)",
        "event CoinFlipSettled(address indexed user, bool isHeads, uint256 randomValue)",
    ];

    // CoinFlip contract
    const coinFlipContract = new ethers.Contract(COIN_FLIP_CONTRACT_ADDRESS, coinFlipAbi, wallet);

    // Request a coin flip
    console.log("Requesting coin flip...");
    const tx = await coinFlipContract.flipCoin();
    await tx.wait();
    console.log("Coin flip requested:", tx.hash);

    // Get the flip randomness ID
    const flipRandomnessId: string = await coinFlipContract.getFlipRandomnessId(wallet.address);
    console.log("Flip randomness ID:", flipRandomnessId);

    // Get flip data for resolution
    const flipData = await coinFlipContract.getFlipData(wallet.address);
    console.log("Flip data:", flipData);

    // Get the randomness from Switchboard
    console.log("Resolving randomness via Crossbar...");
    const { encoded } = await crossbar.resolveEVMRandomness({
        chainId: 143,
        randomnessId: flipRandomnessId,
        timestamp: Number(flipData.rollTimestamp),
        minStalenessSeconds: Number(flipData.minSettlementDelay),
        oracle: flipData.oracle,
    });

    console.log("Encoded randomness:", encoded);

    // Settle the flip
    console.log("Settling flip...");
    const tx2 = await coinFlipContract.settleFlip(encoded);
    const receipt = await tx2.wait();

    // Parse the CoinFlipSettled event to get the result
    const settledEvent = receipt.logs
        .map((log: any) => {
            try {
                return coinFlipContract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((event: any) => event?.name === "CoinFlipSettled");

    if (settledEvent) {
        const { isHeads, randomValue } = settledEvent.args;

        console.log("\n========================================");
        console.log(isHeads ? "HEADS!" : "TAILS!");
        console.log(`Random value: ${randomValue}`);
        console.log(`Transaction: ${tx2.hash}`);
        console.log("========================================\n");
    } else {
        console.log("Flip settled:", tx2.hash);
    }
}

main();
