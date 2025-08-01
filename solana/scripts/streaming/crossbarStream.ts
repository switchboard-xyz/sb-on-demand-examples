import * as sb from "@switchboard-xyz/on-demand";

(async function main() {
  const apiKey = process.env.SURGE_API_KEY!;

  const surge = new sb.Surge({
    apiKey: apiKey,
    // crossbarUrl: 'http://localhost:8080',
    crossbarUrl: process.env.CROSSBAR_URL || 'https://staging.crossbar.switchboard.xyz',
    crossbarMode: true,
    verbose: true,
  });

  // Listen for unsigned price updates
  surge.on('unsignedPriceUpdate', (update: sb.UnsignedPriceUpdate) => {
    const symbols = update.getSymbols();
    const sources = update.getSources();
    const formattedPrices = update.getFormattedPrices();
    console.log(`\nReceived unsigned price update for ${JSON.stringify(update)}`);

    // update.rawResponse.feed_values.forEach((feedValue: any) => {
      // const symbol = feedValue.symbol;
      // const latency = Date.now() - feedValue.seen_at_ts_ms;
      // console.log(`\nReceived unsigned price update for ${symbol}:`);
      // const latencyInfo = ` | Latency: ${latency}ms`;
      // console.log(`${symbol} (${sources[0]}): ${formattedPrices[symbol]}${latencyInfo}`);
    // });
  });

  // Connect and subscribe
  // await surge.connect();
  // await surge.subscribeToAll();
  await surge.connectAndSubscribe([
    { symbol: 'BTC/USD' },
    // { symbol: 'ETH/USD' },
  ], 10);
  console.log('🎧 Streaming prices...\n');
})()
