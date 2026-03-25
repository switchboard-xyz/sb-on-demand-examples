import { ethers } from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";
import {
    MONAD_NETWORKS,
    getValidatedNetwork,
    requireDeployedContract,
    requirePrivateKey,
} from "../../../network";

const DEFAULT_WAGER_AMOUNT = ethers.parseEther("0.01");

async function main() {
    const privateKey = requirePrivateKey();
    const config = await getValidatedNetwork({
        allowedNetworks: MONAD_NETWORKS,
    });
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Initialize Crossbar
    const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

    const COIN_FLIP_CONTRACT_ADDRESS = await requireDeployedContract(
        config,
        "COIN_FLIP_CONTRACT_ADDRESS",
        "CoinFlip"
    );

    console.log(`Network: ${config.name} (${config.key})`);
    console.log(`Chain ID: ${config.chainId}`);
    console.log(`RPC URL: ${config.rpcUrl}`);
    console.log(`Switchboard: ${config.switchboard}`);
    console.log(`CoinFlip: ${COIN_FLIP_CONTRACT_ADDRESS}`);
    console.log(`Wallet: ${wallet.address}`);
    console.log(
        `Default wager: ${ethers.formatEther(DEFAULT_WAGER_AMOUNT)} ${config.nativeSymbol}`
    );

    // CoinFlip ABI
    const coinFlipAbi = [
        "function getWagerRandomnessId(address user) public view returns (bytes32)",
        "function coinFlip() public payable",
        "function settleFlip(bytes calldata encodedRandomness) public",
        "function getWagerData(address user) public view returns (address oracle, uint256 rollTimestamp, uint256 minSettlementDelay)",
        "event CoinFlipped(address indexed user, bytes32 randomnessId, uint256 amount)",
        "event FlipSettled(address indexed user, bool won, uint256 payout, uint256 randomValue)",
    ];

    // CoinFlip contract
    const coinFlipContract = new ethers.Contract(COIN_FLIP_CONTRACT_ADDRESS, coinFlipAbi, wallet);
    const contractBalance = await provider.getBalance(COIN_FLIP_CONTRACT_ADDRESS);

    console.log(
        `Contract bankroll: ${ethers.formatEther(contractBalance)} ${config.nativeSymbol}`
    );

    if (contractBalance < DEFAULT_WAGER_AMOUNT) {
        throw new Error(
            `CoinFlip bankroll is too low for the default ${ethers.formatEther(
                DEFAULT_WAGER_AMOUNT
            )} ${config.nativeSymbol} wager. Fund the contract with at least ${ethers.formatEther(
                DEFAULT_WAGER_AMOUNT
            )} ${config.nativeSymbol} before running bun run flip.`
        );
    }

    // Run the coin flip
    const tx = await coinFlipContract.coinFlip({ value: DEFAULT_WAGER_AMOUNT });
    await tx.wait();
    console.log("Coin flip transaction sent", tx);

    // Get the wager randomness ID
    const wagerRandomnessId: string = await coinFlipContract.getWagerRandomnessId(wallet.address);
    console.log("Wager randomness ID:", wagerRandomnessId);
    

    const wagerData = await coinFlipContract.getWagerData(wallet.address);
    console.log("Wager data:", wagerData);

    // Get the randomness from Switchboard
    const { encoded } = await crossbar.resolveEVMRandomness({
        chainId: config.chainId,
        randomnessId: wagerRandomnessId,
        timestamp: Number(wagerData.rollTimestamp),
        minStalenessSeconds: Number(wagerData.minSettlementDelay),
        oracle: wagerData.oracle,
    });

    console.log("Encoded randomness:", encoded);

    // Settle the flip
    const tx2 = await coinFlipContract.settleFlip(encoded);
    const receipt = await tx2.wait();

    // Parse the FlipSettled event to get the result
    const settledEvent = receipt.logs
        .map((log: any) => {
            try {
                return coinFlipContract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((event: any) => event?.name === "FlipSettled");

    if (settledEvent) {
        const { won, payout, randomValue } = settledEvent.args;
        
        console.log("\n========================================");
        if (won) {
            console.log("🎉 YOU WON!");
            console.log(`💰 Payout: ${ethers.formatEther(payout)} ${config.nativeSymbol}`);
        } else {
            console.log("😔 YOU LOST");
            console.log("💸 Better luck next time!");
        }
        console.log(`🎲 Random value: ${randomValue}`);
        console.log(`📝 Transaction: ${tx2.hash}`);
        console.log("========================================\n");
    } else {
        console.log("Flip settled:", tx2.hash);
    }
}

main().catch((error) => {
    console.error("Error:", error.message || error);
    process.exit(1);
});
