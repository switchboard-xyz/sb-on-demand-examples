/**
 * @fileoverview Utility Functions for Switchboard On-Demand SDK
 *
 * This module provides core utilities and helper functions for interacting
 * with Switchboard oracles. It includes:
 *
 * - Program loading and initialization helpers
 * - Oracle job builders for various data sources
 * - Transaction utilities
 * - Common configuration constants
 *
 * @module utils
 */

import { OracleJob } from "@switchboard-xyz/common";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Commitment,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionInstruction,
  TransactionSignature,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import * as sb from "@switchboard-xyz/on-demand";

/**
 * Program keypair file paths
 * These are generated when you deploy the example programs using Anchor
 */
export const BASIC_PROGRAM_PATH = "target/deploy/basic_oracle_example-keypair.json";
export const ADVANCED_PROGRAM_PATH = "target/deploy/advanced_oracle_example-keypair.json";

/**
 * Default transaction configuration for Switchboard interactions
 *
 * @constant {Object}
 * @property {Commitment} commitment - Use "confirmed" for better slot hash stability with Ed25519
 * @property {boolean} skipPreflight - Skip simulation for better performance
 * @property {number} maxRetries - Disable automatic retries for more control
 */
export const TX_CONFIG = {
  commitment: "confirmed" as Commitment,
  skipPreflight: true,
  maxRetries: 0,
};

/**
 * Loads an Anchor program from a keypair file
 *
 * This utility function handles the common pattern of loading a deployed
 * Anchor program using its keypair file and fetching its IDL.
 *
 * @async
 * @param {anchor.Provider} provider - Anchor provider with connection and wallet
 * @param {string} keypath - Path to the program's keypair JSON file
 * @returns {Promise<anchor.Program>} Initialized Anchor program instance
 *
 * @throws {Error} If the program hasn't been deployed or IDL can't be fetched
 *
 * @example
 * ```typescript
 * const provider = anchor.AnchorProvider.env();
 * const program = await myAnchorProgram(provider, "./target/deploy/my_program-keypair.json");
 * ```
 */
export async function myAnchorProgram(
  provider: anchor.Provider,
  keypath: string
): Promise<anchor.Program> {
  const myProgramKeypair = await sb.AnchorUtils.initKeypairFromFile(keypath);
  const pid = myProgramKeypair.publicKey;
  let idl: anchor.Idl | null = null;
  try {
    idl = (await anchor.Program.fetchIdl(pid, provider))!;
  } catch (e) {
    throw new Error(
      `Failed to fetch IDL for program ${pid.toBase58()}. Was it deployed?`
    );
  }
  try {
    const program = new anchor.Program(idl!, provider);
    return program;
  } catch (e) {
    throw new Error("Failed to load demo program. Was it deployed?");
  }
}

/**
 * Creates an instruction to consume Switchboard oracle data in your program
 *
 * This function builds the instruction that will verify and use the oracle
 * quote in your on-chain program. It includes all required accounts for
 * quote verification.
 *
 * @async
 * @param {anchor.Program} program - Your Anchor program instance
 * @param {PublicKey | string} queue - Switchboard queue account address
 * @returns {Promise<TransactionInstruction>} Instruction ready to add to transaction
 *
 * @example
 * ```typescript
 * const quote = await queue.fetchUpdateQuote(gateway, crossbar, [feedHash]);
 * const ix = await myProgramIx(program, queue.pubkey, quote, payer.publicKey);
 * const tx = new Transaction().add(ix);
 * ```
 */
export async function oracleUpdateIx(
  program: anchor.Program,
  queue: PublicKey | string,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );
  const [oraclePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle")],
    program.programId
  );

  const myIx = await program.methods
    .switchboardOracleUpdate()
    .accounts({
      state: statePda,
      oracle: oraclePda,
      payer: payer,
      queue: new PublicKey(queue),
      slothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    })
    .instruction();
  return myIx;
}

export async function verifyIx(
  program: anchor.Program,
  queue: PublicKey | string,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );
  const [oraclePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle")],
    program.programId
  );

  const myIx = await program.methods
    .verify()
    .accounts({
      state: statePda,
      oracle: oraclePda,
      payer: payer,
      queue: new PublicKey(queue),
      slothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    })
    .instruction();
  return myIx;
}

/**
 * Builds an oracle job for fetching Sanctum LST fair prices
 *
 * Sanctum provides liquid staking token (LST) price data. This job
 * fetches the fair value price for a given LST mint.
 *
 * @param {string} lstMint - The mint address of the liquid staking token
 * @returns {OracleJob} Oracle job configuration for Sanctum price fetch
 *
 * @example
 * ```typescript
 * const msolJob = buildSanctumFairPriceJob("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
 * ```
 */
export function buildSanctumFairPriceJob(lstMint: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        sanctumLstPriceTask: {
          lstMint,
        },
      },
    ],
  });
  return jobConfig;
}

/**
 * Builds an oracle job for fetching Binance spot prices
 *
 * Creates a job that fetches the current spot price for a trading pair
 * from Binance's public API. The job uses JSONPath to extract the price
 * from the API response.
 *
 * @param {string} pair - Trading pair symbol (e.g., "BTCUSDT", "ETHUSDT")
 * @returns {OracleJob} Oracle job configuration for Binance price fetch
 *
 * @example
 * ```typescript
 * const btcJob = buildBinanceJob("BTCUSDT");
 * const ethJob = buildBinanceJob("ETHUSDT");
 * ```
 *
 * @see https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker
 */
export function buildBinanceJob(pair: string): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          url: `https://www.binance.com/api/v3/ticker/price`,
        },
      },
      {
        jsonParseTask: {
          path: `$[?(@.symbol == '${pair}')].price`,
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Builds an oracle job for fetching Coinbase exchange rates
 *
 * Creates a job that fetches exchange rates from Coinbase's public API.
 * The job handles Coinbase's inverted rate format by dividing 1 by the
 * returned rate to get the correct price.
 *
 * @param {String} pair - Trading pair in format "BASE-QUOTE" (e.g., "BTC-USD")
 * @returns {OracleJob} Oracle job configuration for Coinbase price fetch
 *
 * @example
 * ```typescript
 * const btcUsdJob = buildCoinbaseJob("BTC-USD");
 * const ethUsdJob = buildCoinbaseJob("ETH-USD");
 * ```
 *
 * @note Coinbase returns rates as QUOTE/BASE, so we invert to get BASE/QUOTE
 * @see https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/api-exchange-rates
 */
export function buildCoinbaseJob(pair: String): OracleJob {
  const parts = pair.split("-");
  const jobConfig = {
    tasks: [
      {
        valueTask: { value: 1 },
      },
      {
        divideTask: {
          job: {
            tasks: [
              {
                httpTask: {
                  url: `https://api.coinbase.com/v2/exchange-rates?currency=${parts[1]}`,
                  headers: [
                    { key: "Accept", value: "application/json" },
                    { key: "User-Agent", value: "Mozilla/5.0" },
                  ],
                },
              },
              {
                jsonParseTask: {
                  path: `$.data.rates.${parts[0]}`,
                },
              },
            ],
          },
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Builds an oracle job for fetching OKX index prices
 *
 * Creates a job that fetches index prices from OKX's market data API.
 * Index prices are composite prices calculated from multiple exchanges.
 *
 * @param {String} pair - Trading pair in format "BASE-QUOTE" (e.g., "BTC-USD")
 * @returns {OracleJob} Oracle job configuration for OKX price fetch
 *
 * @example
 * ```typescript
 * const btcUsdJob = buildOkxJob("BTC-USD");
 * const ethUsdJob = buildOkxJob("ETH-USD");
 * ```
 *
 * @see https://www.okx.com/docs-v5/en/#rest-api-market-data-get-index-tickers
 */
export function buildOkxJob(pair: String): OracleJob {
  const parts = pair.split("-");
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          url: `https://www.okx.com/api/v5/market/index-tickers?quoteCcy=USD`,
        },
      },
      {
        jsonParseTask: {
          path: `$.data[?(@.instId == "${parts[0]}-${parts[1]}")].idxPx`,
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Builds an oracle job for fetching Bybit spot prices
 *
 * Creates a job that fetches spot market prices from Bybit's public API.
 * Returns the last traded price for the specified trading pair.
 *
 * @param {String} pair - Trading pair symbol (e.g., "BTCUSDT", "ETHUSDT")
 * @returns {OracleJob} Oracle job configuration for Bybit price fetch
 *
 * @example
 * ```typescript
 * const btcJob = buildBybitJob("BTCUSDT");
 * const ethJob = buildBybitJob("ETHUSDT");
 * ```
 *
 * @see https://bybit-exchange.github.io/docs/v5/market/tickers
 */
export function buildBybitJob(pair: String): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          url: `https://api.bybit.com/v5/market/tickers?category=spot`,
        },
      },
      {
        jsonParseTask: {
          path: `$.result.list[?(@.symbol == '${pair}')].lastPrice`,
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Builds an oracle job for fetching Gate.io spot prices
 *
 * Creates a job that fetches spot market prices from Gate.io's public API.
 * Returns the last traded price for the specified currency pair.
 *
 * @param {String} pair - Currency pair in format "BASE_QUOTE" (e.g., "BTC_USDT")
 * @returns {OracleJob} Oracle job configuration for Gate.io price fetch
 *
 * @example
 * ```typescript
 * const btcJob = buildGateJob("BTC_USDT");
 * const ethJob = buildGateJob("ETH_USDT");
 * ```
 *
 * @note Gate.io uses underscore format for pairs (BTC_USDT not BTCUSDT)
 * @see https://www.gate.io/docs/apiv4/en/#retrieve-ticker-information
 */
export function buildGateJob(pair: String): OracleJob {
  const jobConfig = {
    tasks: [
      {
        httpTask: {
          url: `https://api.gateio.ws/api/v4/spot/tickers`,
        },
      },
      {
        jsonParseTask: {
          path: `$[?(@.currency_pair == '${pair}')].last`,
        },
      },
    ],
  };
  return OracleJob.fromObject(jobConfig);
}

/**
 * Builds an oracle job for fetching Pyth Network prices
 *
 * Creates a job that reads price data from an on-chain Pyth price account.
 * Pyth provides high-fidelity market data from institutional sources.
 *
 * @param {string} id - Pyth price account address
 * @returns {OracleJob} Oracle job configuration for Pyth price fetch
 *
 * @example
 * ```typescript
 * // BTC/USD Pyth price account on mainnet
 * const btcJob = buildPythJob("GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU");
 * ```
 *
 * @note The confidence interval of 1.0 means the price must be within 100% confidence
 * @see https://pyth.network/developers/price-feed-ids
 */
export function buildPythJob(id: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        oracleTask: {
          pythAddress: id,
          pythConfigs: {
            pythAllowedConfidenceInterval: 1.0,
          },
        },
      },
    ],
  });
  return jobConfig;
}

/**
 * Builds an oracle job for fetching Chainlink prices
 *
 * Creates a job that reads price data from an on-chain Chainlink aggregator.
 * Chainlink provides decentralized price feeds with multiple node operators.
 *
 * @param {string} id - Chainlink aggregator account address
 * @returns {OracleJob} Oracle job configuration for Chainlink price fetch
 *
 * @example
 * ```typescript
 * // SOL/USD Chainlink feed on devnet
 * const solJob = buildChainlinkJob("99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR");
 * ```
 *
 * @see https://docs.chain.link/data-feeds/price-feeds/addresses
 */
export function buildChainlinkJob(id: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        oracleTask: {
          chainlinkAddress: id,
          chainlinkConfigs: {},
        },
      },
    ],
  });
  return jobConfig;
}

/**
 * Builds an oracle job for fetching Switchboard V3 prices
 *
 * Creates a job that reads price data from an existing Switchboard V3
 * aggregator account. This allows you to reference traditional Switchboard
 * feeds within your on-demand jobs.
 *
 * @param {string} id - Switchboard V3 aggregator account address
 * @returns {OracleJob} Oracle job configuration for Switchboard price fetch
 *
 * @example
 * ```typescript
 * // Reference an existing Switchboard V3 feed
 * const btcJob = buildSwitchboardJob("8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee");
 * ```
 *
 * @note This references Switchboard V3 feeds, not on-demand feeds
 */
export function buildSwitchboardJob(id: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        oracleTask: {
          switchboardAddress: id,
          switchboardConfigs: {
            version: 3,
          },
        },
      },
    ],
  });
  return jobConfig;
}

/**
 * Builds an oracle job for fetching Redstone prices
 *
 * Creates a job that fetches price data from Redstone oracles.
 * Redstone provides modular oracle infrastructure with customizable data feeds.
 *
 * @param {string} id - Redstone price feed identifier
 * @returns {OracleJob} Oracle job configuration for Redstone price fetch
 *
 * @example
 * ```typescript
 * const btcJob = buildRedstoneJob("BTC");
 * const ethJob = buildRedstoneJob("ETH");
 * ```
 *
 * @see https://docs.redstone.finance/
 */
export function buildRedstoneJob(id: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        oracleTask: {
          redstoneId: id,
          redstoneConfigs: {},
        },
      },
    ],
  });
  return jobConfig;
}

/**
 * Builds an oracle job for fetching Edge oracle prices
 *
 * Creates a job that fetches price data from Edge oracles.
 * Edge provides decentralized oracle services with focus on edge computing.
 *
 * @param {string} id - Edge oracle feed identifier
 * @returns {OracleJob} Oracle job configuration for Edge price fetch
 *
 * @example
 * ```typescript
 * const btcJob = buildEdgeJob("BTC-USD");
 * ```
 */
export function buildEdgeJob(id: string): OracleJob {
  const jobConfig = OracleJob.fromObject({
    tasks: [
      {
        oracleTask: {
          edgeId: id,
          edgeConfigs: {},
        },
      },
    ],
  });
  return jobConfig;
}

/**
 * Sends and confirms a versioned transaction
 *
 * This utility function handles the common pattern of signing, sending,
 * and confirming a transaction on Solana. It waits for confirmation
 * before returning.
 *
 * @async
 * @param {Connection} connection - Solana RPC connection
 * @param {VersionedTransaction} tx - Transaction to send (v0 or legacy)
 * @param {Array<Keypair>} signers - Array of keypairs to sign the transaction
 * @returns {Promise<TransactionSignature>} Transaction signature
 *
 * @throws {Error} If transaction fails to confirm
 *
 * @example
 * ```typescript
 * const tx = new VersionedTransaction(message, [ix1, ix2]);
 * const sig = await sendAndConfirmTx(connection, tx, [payer]);
 * console.log(`Transaction confirmed: ${sig}`);
 * ```
 */
export async function sendAndConfirmTx(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Array<Keypair>
): Promise<TransactionSignature> {
  tx.sign(signers);
  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/**
 * Utility function to pause execution for a specified duration
 *
 * @param {number} ms - Duration to sleep in milliseconds
 * @returns {Promise<void>} Promise that resolves after the specified delay
 *
 * @example
 * ```typescript
 * // Wait 3 seconds between iterations
 * await sleep(3000);
 * ```
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateStatistics(latencies: number[]) {
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const min = sortedLatencies[0];
  const max = sortedLatencies[sortedLatencies.length - 1];
  const median =
    sortedLatencies.length % 2 === 0
      ? (sortedLatencies[sortedLatencies.length / 2 - 1] +
          sortedLatencies[sortedLatencies.length / 2]) /
        2
      : sortedLatencies[Math.floor(sortedLatencies.length / 2)];
  const sum = sortedLatencies.reduce((a, b) => a + b, 0);
  const mean = sum / sortedLatencies.length;

  return {
    min,
    max,
    median,
    mean,
    count: latencies.length,
  };
}

/**
 * Creates an instruction to read oracle data from the basic program
 *
 * This is the simplest way to consume Switchboard oracle data.
 * Perfect for basic examples and learning.
 *
 * @param {anchor.Program} program - Basic oracle example program instance
 * @param {PublicKey} oracleAccount - The canonical oracle account (derived from feed hashes)
 * @param {PublicKey} queue - The Switchboard queue public key
 * @param {PublicKey} payer - The payer account
 * @returns {Promise<TransactionInstruction>} Instruction to read oracle data
 */
export async function basicReadOracleIx(
  program: anchor.Program,
  oracleAccount: PublicKey,
  queue: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  return await program.methods
    .readOracleData()
    .accounts({
      queue: queue,                                    // accounts[1]
      oracleAccount: oracleAccount,                   // accounts[2]
      ixSysvar: sb.SPL_SYSVAR_INSTRUCTIONS_ID,       // accounts[3]
      slotSysvar: sb.SPL_SYSVAR_SLOT_HASHES_ID,      // accounts[4]
      clockSysvar: SYSVAR_CLOCK_PUBKEY,              // accounts[5]
      payer: payer,                                   // accounts[6]
      systemProgram: anchor.web3.SystemProgram.programId, // accounts[7]
    })
    .instruction();
}

/**
 * Creates an instruction to process oracle data in the advanced program
 *
 * This demonstrates production-ready patterns with state management,
 * authority validation, and advanced business logic.
 *
 * @param {anchor.Program} program - Advanced oracle example program instance
 * @param {PublicKey} oracleAccount - The canonical oracle account (derived from feed hashes)
 * @param {PublicKey} queue - The Switchboard queue public key
 * @param {PublicKey} authority - The program authority (signer)
 * @returns {Promise<TransactionInstruction>} Instruction to process oracle data
 */
export async function advancedProcessOracleIx(
  program: anchor.Program,
  oracleAccount: PublicKey,
  queue: PublicKey,
  authority?: PublicKey // Made optional since we don't need it anymore
): Promise<TransactionInstruction> {
  return await program.methods
    .parseOracleData()
    .accounts({
      oracleAccount: oracleAccount,
      queue: queue,
      sysvars: {
        clock: SYSVAR_CLOCK_PUBKEY,
        slothashes: sb.SPL_SYSVAR_SLOT_HASHES_ID,
        instructions: sb.SPL_SYSVAR_INSTRUCTIONS_ID,
      },
    })
    .instruction();
}


/**
 * Loads the basic oracle example program
 *
 * @param {anchor.Provider} provider - Anchor provider
 * @returns {Promise<anchor.Program>} Basic program instance
 */
export async function loadBasicProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  return await myAnchorProgram(provider, BASIC_PROGRAM_PATH);
}

/**
 * Loads the advanced oracle example program
 *
 * @param {anchor.Provider} provider - Anchor provider
 * @returns {Promise<anchor.Program>} Advanced program instance
 */
export async function loadAdvancedProgram(
  provider: anchor.Provider
): Promise<anchor.Program> {
  return await myAnchorProgram(provider, ADVANCED_PROGRAM_PATH);
}
