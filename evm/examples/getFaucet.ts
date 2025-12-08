/**
 * Script to get testnet ETH and MON tokens for Monad testnet
 *
 * This script provides links to various faucets for obtaining testnet tokens.
 * Some faucets require mainnet ETH balance verification.
 */

import qrcode from "qrcode-terminal";

const TARGET_ADDRESS = "0x6C4E0c33020269489883197159Eb6f4D321BE672";

// Monad Testnet Configuration
const MONAD_TESTNET = {
  name: "Monad Testnet",
  chainId: 10143,
  rpcUrl: "https://testnet-rpc.monad.xyz",
  blockExplorer: "https://testnet.monadexplorer.com",
  currency: "MON",
};

console.log("=".repeat(60));
console.log("Monad Testnet Faucet Guide");
console.log("=".repeat(60));
console.log(`\nTarget Address: ${TARGET_ADDRESS}`);

// Print QR code for the address (for sending mainnet ETH)
console.log("\n" + "=".repeat(60));
console.log("Scan to send ETH to this address:");
console.log("=".repeat(60));
qrcode.generate(TARGET_ADDRESS, { small: true });
console.log(`\nNetwork Configuration:`);
console.log(`  Chain ID: ${MONAD_TESTNET.chainId}`);
console.log(`  RPC URL: ${MONAD_TESTNET.rpcUrl}`);
console.log(`  Block Explorer: ${MONAD_TESTNET.blockExplorer}`);
console.log(`  Currency: ${MONAD_TESTNET.currency}`);

console.log("\n" + "=".repeat(60));
console.log("Available Faucets for MON (Monad Testnet)");
console.log("=".repeat(60));

const faucets = [
  {
    name: "Official Monad Faucet",
    url: "https://faucet.monad.xyz/",
    amount: "Variable",
    cooldown: "6 hours",
    requirement: "0.03 ETH on Ethereum mainnet + 3 transactions",
  },
  {
    name: "QuickNode Faucet",
    url: "https://faucet.quicknode.com/monad/testnet",
    amount: "Variable",
    cooldown: "~3 hours queue",
    requirement: "0.001 ETH on Ethereum mainnet",
  },
  {
    name: "Alchemy Faucet",
    url: "https://www.alchemy.com/faucets/monad-testnet",
    amount: "0.1 MON",
    cooldown: "24 hours",
    requirement: "0.001 ETH on Ethereum mainnet",
  },
  {
    name: "Gas.zip Faucet",
    url: "https://www.gas.zip/faucet/monad",
    amount: "0.5+ MON",
    cooldown: "12 hours",
    requirement: "None specified",
  },
  {
    name: "Faucet Trade",
    url: "https://faucet.trade/monad-testnet-mon-faucet",
    amount: "0.01-0.05 MON",
    cooldown: "24 hours",
    requirement: "0.005 ETH on mainnet for 0.05 MON",
  },
  {
    name: "Morkie Faucet",
    url: "https://morkie.xyz/faucet",
    amount: "0.05-0.1 MON",
    cooldown: "24 hours",
    requirement: "Morkie ID (no wallet connection needed)",
  },
];

faucets.forEach((faucet, index) => {
  console.log(`\n${index + 1}. ${faucet.name}`);
  console.log(`   URL: ${faucet.url}`);
  console.log(`   Amount: ${faucet.amount}`);
  console.log(`   Cooldown: ${faucet.cooldown}`);
  console.log(`   Requirement: ${faucet.requirement}`);
});

console.log("\n" + "=".repeat(60));
console.log("Instructions");
console.log("=".repeat(60));
console.log(`
1. Visit one of the faucet URLs above
2. Connect your wallet or paste your address: ${TARGET_ADDRESS}
3. Complete any verification requirements
4. Request testnet MON tokens
5. Wait for the transaction to be confirmed

Note: Testnet tokens have no real value and are for development only.
`);

console.log("=".repeat(60));
console.log("Check Balance");
console.log("=".repeat(60));
console.log(`\nView your balance on the block explorer:`);
console.log(`${MONAD_TESTNET.blockExplorer}/address/${TARGET_ADDRESS}`);

// Check balance via RPC
async function getBalance(): Promise<number> {
  try {
    const response = await fetch(MONAD_TESTNET.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [TARGET_ADDRESS, "latest"],
        id: 1,
      }),
    });

    const data = await response.json();
    if (data.result) {
      const balanceWei = BigInt(data.result);
      return Number(balanceWei) / 1e18;
    }
  } catch (error) {
    // Ignore errors
  }
  return 0;
}

// Wait for airdrop with polling
async function waitForAirdrop() {
  const initialBalance = await getBalance();
  console.log(`\nInitial MON Balance: ${initialBalance.toFixed(6)} MON`);

  if (initialBalance > 0) {
    console.log("\nYou already have MON tokens!");
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("Waiting for Airdrop...");
  console.log("=".repeat(60));
  console.log("\nPlease request tokens from one of the faucets above.");
  console.log("This script will check every 10 seconds for new tokens...\n");

  const POLL_INTERVAL = 10_000; // 10 seconds
  const MAX_WAIT_TIME = 30 * 60 * 1000; // 30 minutes
  const startTime = Date.now();
  let dots = 0;

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    const currentBalance = await getBalance();

    if (currentBalance > initialBalance) {
      console.log("\n\n" + "=".repeat(60));
      console.log("AIRDROP RECEIVED!");
      console.log("=".repeat(60));
      console.log(`\nNew MON Balance: ${currentBalance.toFixed(6)} MON`);
      console.log(`Amount received: ${(currentBalance - initialBalance).toFixed(6)} MON`);
      console.log(`\nView on explorer: ${MONAD_TESTNET.blockExplorer}/address/${TARGET_ADDRESS}`);
      return;
    }

    // Progress indicator
    dots = (dots + 1) % 4;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`\rWaiting for airdrop${".".repeat(dots)}${" ".repeat(3 - dots)} (${elapsed}s elapsed, balance: ${currentBalance.toFixed(6)} MON)`);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  console.log("\n\nTimeout: No airdrop received within 30 minutes.");
  console.log("Please try requesting from a faucet again.");
}

await waitForAirdrop();
