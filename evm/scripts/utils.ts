/**
 * @fileoverview Utility functions for EVM Switchboard On-Demand examples
 */

import * as ethers from "ethers";

/**
 * Default transaction configuration for EVM networks
 */
export const TX_CONFIG = {
  // Max priority fee per gas (in gwei)
  maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
  // Max fee per gas (in gwei)
  maxFeePerGas: ethers.parseUnits("50", "gwei"),
};

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms: number): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Format a price value for display
 * @param {bigint} value - The raw price value from the contract
 * @param {number} decimals - Number of decimals (default 18)
 * @returns {string} Formatted price string
 */
export const formatPrice = (value: bigint, decimals: number = 18): string => {
  const formatted = ethers.formatUnits(value, decimals);
  return parseFloat(formatted).toFixed(2);
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Result of the function
 */
export const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms delay...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Common Switchboard contract addresses by chain ID
 */
export const SWITCHBOARD_ADDRESSES: Record<number, string> = {
  1: "0x...", // Ethereum Mainnet (placeholder)
  42161: "0x...", // Arbitrum One (placeholder)
  421614: "0xA2a0425fA3C5669d384f4e6c8068dfCf64485b3b", // Arbitrum Sepolia
  10: "0x...", // Optimism (placeholder)
  137: "0x...", // Polygon (placeholder)
  8453: "0x...", // Base (placeholder)
  56: "0x...", // BNB Chain (placeholder)
  43114: "0x...", // Avalanche (placeholder)
};

/**
 * Get Switchboard contract address for a given chain ID
 * @param {number} chainId - The chain ID
 * @returns {string} The Switchboard contract address
 * @throws {Error} If chain ID is not supported
 */
export const getSwitchboardAddress = (chainId: number): string => {
  const address = SWITCHBOARD_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return address;
};

/**
 * Example aggregator IDs for different price feeds
 */
export const EXAMPLE_FEEDS = {
  // Arbitrum Sepolia feeds
  "ETH/USD": "0x...", // placeholder
  "BTC/USD": "0x...", // placeholder
  "UNI/USD": "0x755c0da00f939b04266f3ba3619ad6498fb936a8bfbfac27c9ecd4ab4c5d4878",
  "CARBON_INTENSITY_GB": "0xba2c99cb1c50d8c77209adc5a45f82e561c29f5b279dca507b4f1324b6586572",
};