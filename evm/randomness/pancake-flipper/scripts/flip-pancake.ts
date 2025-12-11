import { ethers } from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";

const PANCAKE_FLIPPER_ABI = [
    "function flipPancake() public",
    "function catchPancake(bytes calldata encodedRandomness) public returns (bool landed)",
    "function getFlipData(address user) public view returns (bytes32 randomnessId, address oracle, uint256 rollTimestamp, uint256 minSettlementDelay)",
    "function getPlayerStats(address user) public view returns (uint256 currentStack, bool hasPendingFlip)",
    "event PancakeFlipRequested(address indexed user, bytes32 randomnessId)",
    "event PancakeLanded(address indexed user, uint256 newStackHeight)",
    "event StackKnockedOver(address indexed user)",
];

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY is not set");
    }

    const contractAddress = process.env.PANCAKE_FLIPPER_CONTRACT_ADDRESS;
    if (!contractAddress) {
        throw new Error("PANCAKE_FLIPPER_CONTRACT_ADDRESS is not set");
    }

    const provider = new ethers.JsonRpcProvider("https://rpc.monad.xyz");
    const wallet = new ethers.Wallet(privateKey, provider);
    const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

    const contract = new ethers.Contract(contractAddress, PANCAKE_FLIPPER_ABI, wallet);

    // Get current stats before flip
    const [currentStack] = await contract.getPlayerStats(wallet.address);
    console.log(`\nCurrent stack: ${currentStack} pancakes`);

    // Flip a pancake
    console.log("\nFlipping pancake...");
    const tx = await contract.flipPancake();
    await tx.wait();
    console.log("Flip requested:", tx.hash);

    // Get randomness data
    const flipData = await contract.getFlipData(wallet.address);

    // Resolve randomness via Crossbar
    console.log("Resolving randomness...");
    const { encoded } = await crossbar.resolveEVMRandomness({
        chainId: 143,
        randomnessId: flipData.randomnessId,
        timestamp: Number(flipData.rollTimestamp),
        minStalenessSeconds: Number(flipData.minSettlementDelay),
        oracle: flipData.oracle,
    });

    // Catch the pancake
    console.log("Catching pancake...");
    const tx2 = await contract.catchPancake(encoded);
    const receipt = await tx2.wait();

    // Parse events to get the result
    for (const log of receipt.logs) {
        try {
            const parsed = contract.interface.parseLog(log);

            if (parsed?.name === "PancakeLanded") {
                const { newStackHeight } = parsed.args;
                console.log("\n========================================");
                console.log("PANCAKE LANDED!");
                console.log(`Stack height: ${newStackHeight} pancakes`);
                console.log("========================================\n");
            }

            if (parsed?.name === "StackKnockedOver") {
                console.log("\n========================================");
                console.log("STACK KNOCKED OVER!");
                console.log("========================================\n");
            }
        } catch {}
    }

    // Show final stats
    const [finalStack] = await contract.getPlayerStats(wallet.address);
    console.log(`Your stack: ${finalStack} pancakes`);
}

main();
