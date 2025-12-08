/**
 * @fileoverview Example demonstrating how to request and resolve Switchboard randomness on Monad Testnet
 *
 * This script shows:
 * - Requesting randomness from the Switchboard oracle
 * - Resolving randomness via Crossbar
 * - Consuming the random value in your contract
 *
 * Run with: bun run examples/requestRandomness.ts
 *
 * Required environment variables:
 *   PRIVATE_KEY - Your wallet private key
 *   RANDOMNESS_CONTRACT_ADDRESS - Your deployed RandomnessConsumer contract address
 */

import * as ethers from "ethers";
import { CrossbarClient } from "@switchboard-xyz/common";
import { sleep } from "./utils.js";

// Monad Testnet configuration
const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
const MONAD_TESTNET_CHAIN_ID = 10143;
const SWITCHBOARD_ADDRESS = "0x33A5066f65f66161bEb3f827A3e40fce7d7A2e6C";

// Queue IDs - use testnet queue
const TESTNET_QUEUE_ID = "0xc9477bfb5ff1012859f336cf98725680e7705ba2abece17188cfb28ca66ca5b0";

// ABI for the RandomnessConsumer contract (see src/RandomnessConsumer.sol)
const RANDOMNESS_CONSUMER_ABI = [
  "function requestRandomness() external returns (bytes32)",
  "function resolveRandomness(bytes[] calldata updates) external",
  "function getRandomnessId() external view returns (bytes32)",
  "function randomValue() external view returns (uint256)",
  "function isResolved() external view returns (bool)",
  "function switchboard() external view returns (address)",
  "event RandomnessRequested(bytes32 indexed randomnessId, address indexed requester)",
  "event RandomnessResolved(bytes32 indexed randomnessId, uint256 value)",
];

// ABI for interacting with Switchboard directly (if needed)
const SWITCHBOARD_ABI = [
  "function requestRandomness(bytes32 randomnessId, address authority, bytes32 queueId, uint64 minSettlementDelay) external",
  "function requestRandomness(bytes32 randomnessId, address authority, bytes32 queueId, uint64 minSettlementDelay, bytes32 oracleId) external",
  "function getRandomness(bytes32 randomnessId) external view returns (tuple(bytes32 randId, bytes32 queueId, uint256 createdAt, address authority, uint256 rollTimestamp, uint64 minSettlementDelay, tuple(bytes32 oracleId, address oracleAuthority, uint256 value, uint256 settledAt) result))",
  "function updateFeeds(bytes[] calldata updates) external payable",
];

async function main() {
  // Parse environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const contractAddress = process.env.RANDOMNESS_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.log("\n⚠️  No RANDOMNESS_CONTRACT_ADDRESS provided.");
    console.log("This script will demonstrate how to request randomness directly from Switchboard.");
    console.log("For full functionality, deploy the RandomnessConsumer.sol contract first.\n");
  }

  // Create provider and signer
  const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
  const signer = new ethers.Wallet(privateKey, provider);

  console.log("=== Switchboard Randomness on Monad Testnet ===\n");
  console.log("Signer address:", signer.address);
  console.log("Chain ID:", MONAD_TESTNET_CHAIN_ID);
  console.log("Switchboard address:", SWITCHBOARD_ADDRESS);
  console.log("Queue ID:", TESTNET_QUEUE_ID);

  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "MON\n");

  if (balance === 0n) {
    console.log("⚠️  Your wallet has no MON. Get testnet tokens from the Monad faucet.");
    return;
  }

  // Initialize Crossbar client
  const crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

  if (contractAddress) {
    // Use the deployed RandomnessConsumer contract
    await requestViaContract(signer, contractAddress, crossbar);
  } else {
    // Demonstrate direct Switchboard interaction
    await requestDirectly(signer, crossbar);
  }
}

async function requestViaContract(
  signer: ethers.Wallet,
  contractAddress: string,
  crossbar: CrossbarClient
) {
  console.log("--- Using RandomnessConsumer Contract ---\n");

  const contract = new ethers.Contract(
    contractAddress,
    RANDOMNESS_CONSUMER_ABI,
    signer
  );

  // Step 1: Request randomness
  console.log("Step 1: Requesting randomness...");
  const requestTx = await contract.requestRandomness();
  console.log("Transaction hash:", requestTx.hash);
  const requestReceipt = await requestTx.wait();
  console.log("Confirmed in block:", requestReceipt.blockNumber);

  // Get the randomness ID from the event
  const iface = new ethers.Interface(RANDOMNESS_CONSUMER_ABI);
  let randomnessId: string | null = null;

  for (const log of requestReceipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === "RandomnessRequested") {
        randomnessId = parsed.args.randomnessId;
        console.log("Randomness ID:", randomnessId);
        break;
      }
    } catch {
      // Skip logs that don't match our interface
    }
  }

  if (!randomnessId) {
    randomnessId = await contract.getRandomnessId();
    console.log("Randomness ID (from contract):", randomnessId);
  }

  // Step 2: Wait for settlement delay
  console.log("\nStep 2: Waiting for minimum settlement delay (5 seconds)...");
  await sleep(5000);

  // Step 3: Resolve randomness via Crossbar
  console.log("\nStep 3: Fetching randomness resolution from Crossbar...");

  try {
    const { encoded } = await crossbar.resolveEVMRandomness({
      chainId: MONAD_TESTNET_CHAIN_ID,
      randomnessId: randomnessId!,
    });

    console.log("Encoded update received, length:", encoded.length);

    // Step 4: Submit the resolution to the contract
    console.log("\nStep 4: Resolving randomness on-chain...");
    const resolveTx = await contract.resolveRandomness([encoded]);
    console.log("Transaction hash:", resolveTx.hash);
    const resolveReceipt = await resolveTx.wait();
    console.log("Confirmed in block:", resolveReceipt.blockNumber);

    // Parse the resolution event
    for (const log of resolveReceipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "RandomnessResolved") {
          console.log("\n=== Randomness Resolved ===");
          console.log("Randomness ID:", parsed.args.randomnessId);
          console.log("Random Value:", parsed.args.value.toString());
          break;
        }
      } catch {
        // Skip logs that don't match our interface
      }
    }

    // Step 5: Read the final value
    const finalValue = await contract.randomValue();
    const isResolved = await contract.isResolved();
    console.log("\n=== Final State ===");
    console.log("Random Value:", finalValue.toString());
    console.log("Is Resolved:", isResolved);
  } catch (error: any) {
    console.error("\nError resolving randomness:", error.message);
    console.log("\nNote: The randomness may not be ready yet. Try again in a few seconds.");
  }
}

async function requestDirectly(
  signer: ethers.Wallet,
  crossbar: CrossbarClient
) {
  console.log("--- Direct Switchboard Interaction Demo ---\n");

  const switchboard = new ethers.Contract(
    SWITCHBOARD_ADDRESS,
    SWITCHBOARD_ABI,
    signer
  );

  // Generate a unique randomness ID
  const randomnessId = ethers.keccak256(
    ethers.solidityPacked(
      ["address", "uint256", "uint256"],
      [signer.address, Date.now(), Math.floor(Math.random() * 1000000)]
    )
  );

  console.log("Generated Randomness ID:", randomnessId);

  // Step 1: Request randomness
  console.log("\nStep 1: Requesting randomness from Switchboard...");
  const minSettlementDelay = 1; // 1 second minimum

  try {
    const requestTx = await switchboard.requestRandomness(
      randomnessId,
      signer.address, // authority
      TESTNET_QUEUE_ID,
      minSettlementDelay
    );
    console.log("Transaction hash:", requestTx.hash);
    const receipt = await requestTx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);

    // Step 2: Wait for settlement
    console.log("\nStep 2: Waiting for settlement delay...");
    await sleep(3000);

    // Step 3: Resolve via Crossbar
    console.log("\nStep 3: Fetching randomness from Crossbar...");
    const { encoded } = await crossbar.resolveEVMRandomness({
      chainId: MONAD_TESTNET_CHAIN_ID,
      randomnessId: randomnessId,
    });

    console.log("Encoded update received");

    // Step 4: Submit the update
    console.log("\nStep 4: Submitting randomness update...");
    const updateTx = await switchboard.updateFeeds([encoded]);
    console.log("Transaction hash:", updateTx.hash);
    await updateTx.wait();

    // Step 5: Read the randomness
    console.log("\nStep 5: Reading randomness result...");
    const randomness = await switchboard.getRandomness(randomnessId);

    console.log("\n=== Randomness Result ===");
    console.log("Randomness ID:", randomness.randId);
    console.log("Queue ID:", randomness.queueId);
    console.log("Authority:", randomness.authority);
    console.log("Created At:", new Date(Number(randomness.createdAt) * 1000).toISOString());
    console.log("Roll Timestamp:", new Date(Number(randomness.rollTimestamp) * 1000).toISOString());
    console.log("Settlement Delay:", randomness.minSettlementDelay.toString(), "seconds");
    console.log("\n--- Result ---");
    console.log("Oracle ID:", randomness.result.oracleId);
    console.log("Oracle Authority:", randomness.result.oracleAuthority);
    console.log("Random Value:", randomness.result.value.toString());
    console.log("Settled At:", randomness.result.settledAt > 0
      ? new Date(Number(randomness.result.settledAt) * 1000).toISOString()
      : "Not settled");

  } catch (error: any) {
    if (error.message?.includes("insufficient funds")) {
      console.error("\n❌ Insufficient funds. Please get testnet MON from the faucet.");
    } else if (error.message?.includes("404")) {
      console.log("\n⚠️  Randomness not yet available from Crossbar.");
      console.log("This could mean:");
      console.log("  1. Randomness support is still being rolled out on Monad testnet");
      console.log("  2. The oracle hasn't processed the request yet - try again in a few seconds");
      console.log("  3. The randomnessId wasn't found (check if the request tx succeeded)");
      console.log("\nRandomness ID:", randomnessId);
      console.log("You can manually check if it's available by trying again.");
    } else {
      console.error("\n❌ Error:", error.message || error);
    }
  }
}

main().catch(console.error);
