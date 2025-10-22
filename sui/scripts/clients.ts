/**
 * Shared client initialization utilities for Sui scripts
 */

import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SwitchboardClient } from "@switchboard-xyz/sui-sdk";

export interface SuiClients {
  suiClient: SuiClient;
  sb: SwitchboardClient;
}

/**
 * Initialize Sui and Switchboard clients
 */
export function initializeClients(rpcUrl: string): SuiClients {
  const suiClient = new SuiClient({ url: rpcUrl });
  const sb = new SwitchboardClient(suiClient);

  return { suiClient, sb };
}

export interface KeypairInfo {
  keypair: Ed25519Keypair;
  address: string;
}

/**
 * Initialize keypair from private key
 */
export function initializeKeypair(privateKey: string): KeypairInfo {
  const keypair = Ed25519Keypair.fromSecretKey(privateKey);
  const address = keypair.getPublicKey().toSuiAddress();

  return { keypair, address };
}
