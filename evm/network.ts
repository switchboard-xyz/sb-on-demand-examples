import { spawn } from "node:child_process";

export type ExampleNetwork =
  | "monad-testnet"
  | "monad-mainnet"
  | "hyperliquid-mainnet";

export interface NetworkConfig {
  key: ExampleNetwork;
  name: string;
  chainId: number;
  defaultRpcUrl: string;
  switchboard: string;
  explorer: string;
  nativeSymbol: string;
  family: "monad" | "hyperliquid";
}

export interface ResolvedNetworkConfig extends NetworkConfig {
  rpcUrl: string;
}

const NETWORKS: Record<ExampleNetwork, Omit<NetworkConfig, "key">> = {
  "monad-testnet": {
    name: "Monad Testnet",
    chainId: 10143,
    defaultRpcUrl: "https://testnet-rpc.monad.xyz",
    switchboard: "0x6724818814927e057a693f4e3A172b6cC1eA690C",
    explorer: "https://testnet.monadscan.io",
    nativeSymbol: "MON",
    family: "monad",
  },
  "monad-mainnet": {
    name: "Monad Mainnet",
    chainId: 143,
    defaultRpcUrl: "https://rpc.monad.xyz",
    switchboard: "0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67",
    explorer: "https://mainnet-beta.monvision.io",
    nativeSymbol: "MON",
    family: "monad",
  },
  "hyperliquid-mainnet": {
    name: "Hyperliquid Mainnet",
    chainId: 999,
    defaultRpcUrl: "https://rpc.hyperliquid.xyz/evm",
    switchboard: "0xcDb299Cb902D1E39F83F54c7725f54eDDa7F3347",
    explorer: "https://explorer.hyperliquid.xyz",
    nativeSymbol: "ETH",
    family: "hyperliquid",
  },
};

export const DEFAULT_NETWORK: ExampleNetwork = "monad-testnet";
export const MONAD_NETWORKS: readonly ExampleNetwork[] = [
  "monad-testnet",
  "monad-mainnet",
];

interface ResolveNetworkOptions {
  allowedNetworks?: readonly ExampleNetwork[];
  defaultNetwork?: ExampleNetwork;
}

function assertHexAddress(address: string, label: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid ${label} address: ${address}`);
  }
  return address;
}

function normalizeAddress(address: string, label: string): string {
  return assertHexAddress(address, label).toLowerCase();
}

function formatUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionString = fraction.toString().padStart(decimals, "0");
  return `${whole}.${fractionString.replace(/0+$/, "")}`;
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`${method} failed: ${body.error.message}`);
  }

  return body.result as T;
}

export function listNetworks(
  allowedNetworks: readonly ExampleNetwork[] = Object.keys(
    NETWORKS
  ) as ExampleNetwork[]
): string {
  return allowedNetworks.join(", ");
}

export function resolveNetworkConfig(
  options: ResolveNetworkOptions = {}
): ResolvedNetworkConfig {
  const allowedNetworks =
    options.allowedNetworks ||
    (Object.keys(NETWORKS) as ExampleNetwork[]);
  const requestedNetwork =
    (process.env.NETWORK?.trim() as ExampleNetwork | undefined) ||
    options.defaultNetwork ||
    DEFAULT_NETWORK;

  if (!allowedNetworks.includes(requestedNetwork)) {
    throw new Error(
      `Unknown NETWORK="${requestedNetwork}". Allowed values: ${listNetworks(
        allowedNetworks
      )}`
    );
  }

  const base = NETWORKS[requestedNetwork];
  const rpcUrl = process.env.RPC_URL?.trim() || base.defaultRpcUrl;
  const manualSwitchboard = process.env.SWITCHBOARD_ADDRESS?.trim();

  if (manualSwitchboard && base.family === "monad") {
    const expectedSwitchboard = normalizeAddress(
      base.switchboard,
      `${requestedNetwork} Switchboard`
    );
    const providedSwitchboard = normalizeAddress(
      manualSwitchboard,
      "SWITCHBOARD_ADDRESS"
    );

    if (providedSwitchboard !== expectedSwitchboard) {
      throw new Error(
        `SWITCHBOARD_ADDRESS=${manualSwitchboard} does not match the canonical ${requestedNetwork} Switchboard address ${base.switchboard}`
      );
    }
  }

  return {
    key: requestedNetwork,
    ...base,
    rpcUrl,
    switchboard: manualSwitchboard || base.switchboard,
  };
}

export function requirePrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string");
  }
  return privateKey;
}

export async function assertRpcMatchesNetwork(
  config: ResolvedNetworkConfig
): Promise<void> {
  const chainIdHex = await rpcCall<string>(config.rpcUrl, "eth_chainId", []);
  const actualChainId = Number.parseInt(chainIdHex, 16);

  if (actualChainId !== config.chainId) {
    throw new Error(
      `RPC_URL resolved to chain ID ${actualChainId}, but NETWORK=${config.key} requires chain ID ${config.chainId}`
    );
  }
}

export async function assertContractCode(
  config: ResolvedNetworkConfig,
  address: string,
  label: string
): Promise<string> {
  const normalizedAddress = assertHexAddress(address, label);
  const code = await rpcCall<string>(
    config.rpcUrl,
    "eth_getCode",
    [normalizedAddress, "latest"]
  );

  if (code === "0x") {
    throw new Error(
      `No bytecode found at ${label} address ${normalizedAddress}`
    );
  }

  return normalizedAddress;
}

export async function getValidatedNetwork(
  options: ResolveNetworkOptions = {}
): Promise<ResolvedNetworkConfig> {
  const config = resolveNetworkConfig(options);
  await assertRpcMatchesNetwork(config);
  await assertContractCode(config, config.switchboard, "Switchboard");
  return config;
}

export async function requireDeployedContract(
  config: ResolvedNetworkConfig,
  envVar: string,
  label: string
): Promise<string> {
  const address = process.env[envVar]?.trim();
  if (!address) {
    throw new Error(`${envVar} environment variable is required`);
  }
  return assertContractCode(config, address, label);
}

export async function getNativeBalance(
  config: ResolvedNetworkConfig,
  address: string
): Promise<bigint> {
  const normalizedAddress = assertHexAddress(address, "wallet");
  const balanceHex = await rpcCall<string>(
    config.rpcUrl,
    "eth_getBalance",
    [normalizedAddress, "latest"]
  );
  return BigInt(balanceHex);
}

export function formatNativeBalance(value: bigint): string {
  return formatUnits(value, 18);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ForgeDeployOptions {
  script: string;
  label: string;
  allowedNetworks?: readonly ExampleNetwork[];
  extraArgs?: string[];
}

export async function runForgeDeploy(
  options: ForgeDeployOptions
): Promise<void> {
  requirePrivateKey();
  const config = await getValidatedNetwork({
    allowedNetworks: options.allowedNetworks,
  });

  console.log(`Deploying ${options.label}`);
  console.log(`  Network: ${config.name} (${config.key})`);
  console.log(`  Chain ID: ${config.chainId}`);
  console.log(`  RPC URL: ${config.rpcUrl}`);
  console.log(`  Switchboard: ${config.switchboard}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "forge",
      [
        "script",
        options.script,
        "--rpc-url",
        config.rpcUrl,
        "--broadcast",
        "-vvvv",
        ...(options.extraArgs ?? []),
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
          ...process.env,
          NETWORK: config.key,
          RPC_URL: config.rpcUrl,
          SWITCHBOARD_ADDRESS: config.switchboard,
        },
      }
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `forge script exited with status ${code ?? "unknown"}`
        )
      );
    });
  });
}
