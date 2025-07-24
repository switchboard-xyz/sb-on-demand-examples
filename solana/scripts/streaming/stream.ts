import * as sb from "@switchboard-xyz/on-demand";
import { Connection, Keypair } from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import { CrossbarClient } from "@switchboard-xyz/common";
import { TX_CONFIG, myAnchorProgram, myProgramIx, DEMO_PATH } from "../utils";

/**
 * Switchboard On-Demand Streaming Example
 *
 * This example demonstrates real-time price feed streaming with transaction throttling.
 * - Connects to Switchboard price feeds via WebSocket
 * - Receives real-time price updates
 * - Submits on-chain transactions every 5 seconds (throttled)
 * - Runs for 30 seconds total, then disconnects
 */
async function streamingExample() {
    console.log('🚀 Starting Switchboard On-Demand Streaming Example');
    console.log('📋 Configuration:');
    console.log('   - Transaction interval: 5 seconds');
    console.log('   - Total runtime: 30 seconds');
    console.log('   - Feed: BTC/USD\n');

    // Initialize Solana connection and programs
    const { keypair, connection, program } = await sb.AnchorUtils.loadEnv();
    const testProgram = await myAnchorProgram(program!.provider, DEMO_PATH);
    const crossbar = CrossbarClient.default();
    const queue = await sb.Queue.loadDefault(program!);
    console.log(`📍 Queue: ${queue.pubkey.toString()}`);

    const gateway = await queue.fetchGatewayFromCrossbar(crossbar);
    const lut = await queue.loadLookupTable();

    // Configuration constants
    const TRANSACTION_INTERVAL = 5000; // 5 seconds between transactions
    const TOTAL_RUNTIME = 300000; // 30 seconds total runtime

    // State tracking variables
    const latencies: number[] = [];
    let lastTransactionTime = 0;
    let transactionCount = 0;
    let priceUpdateCount = 0;
    let heartbeatCount = 0;
    let priceChangeCount = 0;
    let oracleProcessingTimes: number[] = []; // Track processing times for non-heartbeats
    let lastUpdateTime = 0; // Track time between updates
    let isRunning = true;

    // Initialize Switchboard Surge streaming client
    const surge = new sb.Surge({
        apiKey: process.env.SURGE_API_KEY!,
        gatewayUrl: 'https://92.222.100.185.xip.switchboard-oracles.xyz/devnet',
        // gatewayUrl: 'http://localhost:8082',
        // crossbarMode: true,  // ✅ Enable crossbar mode
        verbose: true,
    });

    // Set up automatic disconnection after 30 seconds
    setTimeout(() => {
        isRunning = false;
        console.log('\n⏰ 30 seconds elapsed - disconnecting from stream...');
        surge.disconnect();

        // Print final statistics
        console.log('\n📊 Final Statistics:');
        console.log(`   🔔 Total price updates: ${priceUpdateCount}`);
        console.log(`   💓 Heartbeats: ${heartbeatCount}`);
        console.log(`   📈 Price changes: ${priceChangeCount}`);
        console.log(`   📤 Transactions submitted: ${transactionCount}`);
        console.log(`   ⚡ Transaction success rate: ${transactionCount > 0 ? ((latencies.length / transactionCount) * 100).toFixed(1) : 0}%`);

        if (oracleProcessingTimes.length > 0) {
            const avgOracleProcessing = oracleProcessingTimes.reduce((a, b) => a + b, 0) / oracleProcessingTimes.length;
            console.log(`   🔧 Average Oracle Processing (non-heartbeats): ${avgOracleProcessing.toFixed(2)} ms`);
        }

        console.log('\n✅ Streaming example complete!');
        process.exit(0);
    }, TOTAL_RUNTIME);

    // Listen for price updates from the WebSocket stream
    surge.on('signedPriceUpdate', async (response: sb.SurgeUpdate) => {

        if (!isRunning) return;
        // console.log('🔄 Received price update {}', response);
        priceUpdateCount++;
        const now = Date.now();
        const timeSinceLastTx = now - lastTransactionTime;

        // Calculate time since last update
        const timeSinceLastUpdate = lastUpdateTime === 0 ? 0 : now - lastUpdateTime;
        lastUpdateTime = now;

        // Get price information
        const formattedPrices = response.getFormattedPrices();
        const currentPrice = Object.values(formattedPrices)[0] || 'N/A';
        const latencyMetrics = response.getLatencyMetrics();
        const isHeartbeat = !response.isTriggeredByPriceChange();

        // Track heartbeats vs price changes
        if (isHeartbeat) {
            heartbeatCount++;
        } else {
            priceChangeCount++;
            // Track oracle processing time for non-heartbeats only
            if (typeof latencyMetrics.exchangeToOracleUpdate === 'number') {
                oracleProcessingTimes.push(latencyMetrics.exchangeToOracleUpdate);
            }
        }
        // console.log('\n Latency Metrics:', latencyMetrics);
        // One-line price update log with color coding
        const statusText = isHeartbeat
            ? 'Exchange To Update Processing Time: N/A [\x1b[31mScheduled Price Heartbeat\x1b[0m]' // Only "Heartbeat" word in red
            : `\x1b[32mExchange To Update Processing Time: ${latencyMetrics.exchangeToOracleUpdate}ms\x1b[0m`; // Green for oracle processing time

        const timeDiffText = timeSinceLastUpdate > 0 ? ` | \x1b[94m+${timeSinceLastUpdate}ms\x1b[0m` : '';
        console.log(`Update #${priceUpdateCount} | BTC/USD: ${currentPrice} | ${statusText}${timeDiffText}`);

        // Throttling: Check if enough time has passed since last transaction
        if (timeSinceLastTx < TRANSACTION_INTERVAL) {
            return;
        }

        // Update transaction timing and counter
        lastTransactionTime = now;
        transactionCount++;

        try {
            // Measure processing latency
            const processingStart = Date.now();
            const [sigVerifyIx, bundle] = response.toBundleIx();
            const processingEnd = Date.now();
            const processingLatency = processingEnd - processingStart;
            latencies.push(processingLatency);

            // Create our program instruction
            const testIx = await myProgramIx(testProgram, queue.pubkey, bundle, keypair.publicKey);

            // Build the transaction
            const tx = await sb.asV0Tx({
                connection,
                ixs: [sigVerifyIx, testIx],
                signers: [keypair],
                computeUnitPrice: 20_000,
                computeUnitLimitMultiple: 1.3,
                lookupTables: [lut],
            });

            // Simulate before sending
            const sim = await connection.simulateTransaction(tx, TX_CONFIG);

            if (sim.value.err === null) {
                // Submit the transaction
                const signature = await connection.sendTransaction(tx, TX_CONFIG);
                console.log(`🚀 TRANSACTION #${transactionCount} | Submitting to Solana | Signature: ${signature}`);

                // Wait for confirmation
                const confirmation = await connection.confirmTransaction({
                    signature,
                    blockhash: tx.message.recentBlockhash!,
                    lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
                }, 'confirmed');

                if (confirmation.value.err) {
                    console.error(`❌ Transaction failed: ${confirmation.value.err}`);
                } else {
                    console.log(`✅ Transaction CONFIRMED | OracleProcessing: ${processingLatency}ms`);
                }
            } else {
                console.error(`❌ Simulation failed: ${sim.value.err.toString()}`);
            }

        } catch (error) {
            console.error(`💥 Transaction error: ${error}`);
        }
    });

    // Error handling
    surge.on('error', (error) => {
        console.error('🚨 Surge error:', error);
    });

    // Subscribe to BTC/USDT feed from Binance
    try {
        await surge.connectAndSubscribe([
            { symbol: 'BTC/USD' },
        ]);

        console.log('🎧 Connected and subscribed to price feeds!');
    } catch (error) {
        console.error('❌ Failed to connect and subscribe:', error);
        process.exit(1);
    }
}

// Run the example
streamingExample().catch((error) => {
    console.error('💥 Example failed:', error);
    process.exit(1);
});
