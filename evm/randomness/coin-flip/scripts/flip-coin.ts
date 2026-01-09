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
        "function getWagerRandomnessId(address user) public view returns (bytes32)",
        "function coinFlip() public payable",
        "function settleFlip(bytes calldata encodedRandomness) public",
        "function getWagerData(address user) public view returns (address oracle, uint256 rollTimestamp, uint256 minSettlementDelay)",
        "event CoinFlipped(address indexed user, bytes32 randomnessId, uint256 amount)",
        "event FlipSettled(address indexed user, bool won, uint256 payout, uint256 randomValue)",
    ];

    // CoinFlip contract
    const coinFlipContract = new ethers.Contract(COIN_FLIP_CONTRACT_ADDRESS, coinFlipAbi, wallet);

    // Run the coin flip
    const tx = await coinFlipContract.coinFlip({ value: ethers.parseEther("1") });
    await tx.wait();
    console.log("Coin flip transaction sent", tx);

    // Get the wager randomness ID
    const wagerRandomnessId: string = await coinFlipContract.getWagerRandomnessId(wallet.address);
    console.log("Wager randomness ID:", wagerRandomnessId);
    

    const wagerData = await coinFlipContract.getWagerData(wallet.address);
    console.log("Wager data:", wagerData);

    // Get the chain ID dynamically from the provider
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    // Get the randomness from Switchboard
    const { encoded } = await crossbar.resolveEVMRandomness({
        chainId,
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
            console.log(`💰 Payout: ${ethers.formatEther(payout)} ETH`);
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

main();