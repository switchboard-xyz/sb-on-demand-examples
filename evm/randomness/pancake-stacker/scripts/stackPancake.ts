import { ethers } from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";
import {
    MONAD_NETWORKS,
    getValidatedNetwork,
    requireDeployedContract,
    requirePrivateKey,
} from "../../../network";

// defines interface for the pancake flipper contract we interact with
const PANCAKE_STACKER_ABI = [
    "function flipPancake() public",
    "function catchPancake(bytes calldata encodedRandomness) public",
    "function getFlipData(address user) public view returns (bytes32 randomnessId, address oracle, uint256 rollTimestamp, uint256 minSettlementDelay)",
    "function getPlayerStats(address user) public view returns (uint256 currentStack, bool hasPendingFlip)",
    "event PancakeFlipRequested(address indexed user, bytes32 randomnessId)",
    "event PancakeLanded(address indexed user, uint256 newStackHeight)",
    "event StackKnockedOver(address indexed user)",
    "event SettlementFailed(address indexed user)",
];

async function main() {

    // load your private key for your wallet
    const privateKey = requirePrivateKey();
    const config = await getValidatedNetwork({
        allowedNetworks: MONAD_NETWORKS,
    });
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // load on-chain contract address
    const contractAddress = await requireDeployedContract(
        config,
        "PANCAKE_STACKER_CONTRACT_ADDRESS",
        "PancakeStacker"
    );

    // initialize RPC, wallet, crossbar server
    const wallet = new ethers.Wallet(privateKey, provider);
    const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

    console.log(`Network: ${config.name} (${config.key})`);
    console.log(`Chain ID: ${config.chainId}`);
    console.log(`RPC URL: ${config.rpcUrl}`);
    console.log(`Switchboard: ${config.switchboard}`);
    console.log(`PancakeStacker: ${contractAddress}`);
    console.log(`Wallet: ${wallet.address}`);

    // initialize contract instance to call
    const contract = new ethers.Contract(contractAddress, PANCAKE_STACKER_ABI, wallet);

    // call contract to get current stats before flip
    const [currentStack] = await contract.getPlayerStats(wallet.address);
    console.log(`\nCurrent stack: ${currentStack} pancakes`);

    // call contract to flip a pancake
    console.log("\nFlipping pancake...");
    const tx = await contract.flipPancake();
    await tx.wait();
    console.log("Flip requested:", tx.hash);

    // get data of the randomness you requested
    const flipData = await contract.getFlipData(wallet.address);

    // ask crossbar to talk to oracle and retrieve randomness
    console.log("Resolving randomness...");
    const { encoded } = await crossbar.resolveEVMRandomness({
        chainId: config.chainId,
        randomnessId: flipData.randomnessId,
        timestamp: Number(flipData.rollTimestamp),
        minStalenessSeconds: Number(flipData.minSettlementDelay),
        oracle: flipData.oracle,
    });

    // Call contract with randomness to catch the pancake
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

            if (parsed?.name === "SettlementFailed") {
                console.log("\n========================================");
                console.log("SETTLEMENT FAILED!");
                console.log("Stack reset due to oracle/randomness issue");
                console.log("========================================\n");
            }
        } catch {}
    }

    // Show final stats
    const [finalStack] = await contract.getPlayerStats(wallet.address);
    console.log(`Your stack: ${finalStack} pancakes`);
}

main().catch((error) => {
    console.error("Error:", error.message || error);
    process.exit(1);
});
