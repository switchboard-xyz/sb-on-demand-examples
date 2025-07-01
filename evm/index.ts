/* Example Using Crossbar (equivalent to index.ts) */
import * as ethers from "ethers";
import * as fs from "fs";
import { CrossbarClient } from "@switchboard-xyz/on-demand";

// Parse the response as JSON
const secret = process.env.PRIVATE_KEY as string;
if (!secret) {
  throw new Error("No private key provided");
}

// Create a provider
const provider = new ethers.JsonRpcProvider(
  "https://sepolia-rollup.arbitrum.io/rpc"
);

// Create a signer
const signerWithProvider = new ethers.Wallet(secret, provider);

// Target contract address
const exampleAddress = process.env.EXAMPLE_ADDRESS as string;

// for tokens (this is the Human-Readable ABI format)
const abi = [
  "function getFeedData(bytes[] calldata updates) public payable",
  "function aggregatorId() public view returns (bytes32)",
  "function latestPrice() public view returns (int256)",
];

const crossbar = new CrossbarClient(`https://crossbar.switchboard.xyz`);

// The Contract object
const exampleContract = new ethers.Contract(
  exampleAddress,
  abi,
  signerWithProvider
);

// Get the encoded updates
const { encoded } = await crossbar.fetchEVMResults({
  chainId: 421614,
  aggregatorIds: [await exampleContract.aggregatorId()],
});

// Update the contract + do some business logic
const tx = await exampleContract.getFeedData(encoded);

console.log(tx);

// Log the transaction hash
console.log("Transaction completed!");

// Log the result
console.log("Value stored in contract: ", await exampleContract.latestPrice());