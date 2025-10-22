/**
 * Shared configuration utilities for Sui examples
 */

export interface SuiConfig {
  rpcUrl: string;
  crossbarUrl?: string;
  privateKey?: string;
  surgeApiKey?: string;
}

/**
 * Load environment configuration with sensible defaults
 */
export function loadConfig(): SuiConfig {
  return {
    rpcUrl: process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
    crossbarUrl: process.env.CROSSBAR_URL || "https://crossbar.switchboardlabs.xyz",
    privateKey: process.env.SUI_PRIVATE_KEY,
    surgeApiKey: process.env.SURGE_API_KEY,
  };
}

/**
 * Validate that required environment variables are present
 */
export function validateConfig(
  config: SuiConfig,
  options: {
    requirePrivateKey?: boolean;
    requireSurgeApiKey?: boolean;
  } = {}
): void {
  if (options.requirePrivateKey && !config.privateKey) {
    throw new Error("SUI_PRIVATE_KEY environment variable is required");
  }

  if (options.requireSurgeApiKey && !config.surgeApiKey) {
    throw new Error("SURGE_API_KEY environment variable is required");
  }
}
