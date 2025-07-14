import * as sb from "@switchboard-xyz/on-demand";

(async function main() {
  const apiKey = process.env.SURGE_API_KEY!;

  const surge = new sb.Surge({
    apiKey: apiKey,
    crossbarUrl: 'http://localhost:8080',
    // crossbarUrl: 'https://staging.crossbar.switchboard.xyz',
    crossbarMode: true,
    verbose: true,
  });

  // Listen for unsigned price updates
  surge.on('unsignedPriceUpdate', (update: sb.UnsignedPriceUpdate) => {
    const symbols = update.getSymbols();
    const sources = update.getSources();
    const formattedPrices = update.getFormattedPrices();

    symbols.forEach(symbol => {
      const latency = Date.now() - update.data.seen_at_ts_ms
      const latencyInfo = ` | Latency: ${latency}ms`;
      console.log(`${symbol} (${sources[0]}): ${formattedPrices[symbol]}${latencyInfo}`);
    });
  });

  // Connect and subscribe
  await surge.connect();
  await surge.subscribeToAll();
  // await surge.connectAndSubscribe([
    // { symbol: 'BTC/USD' }
  // ]);
  console.log('🎧 Streaming prices...\n');
})()
