import * as sb from "@switchboard-xyz/on-demand";

async function streamPrices() {
  const apiKey = process.env.SURGE_API_KEY!;

  const surge = new sb.Surge({
    apiKey: apiKey,
    // crossbarUrl: 'http://localhost:8080',
    crossbarUrl: 'https://staging.crossbar.switchboard.xyz',
    crossbarMode: true,
    verbose: true,
  });

  // Listen for unsigned price updates
  surge.on('unsignedPriceUpdate', (update: sb.UnsignedPriceUpdate) => {
    const symbols = update.getSymbols();
    const sources = update.getSources();
    const formattedPrices = update.getFormattedPrices();

    symbols.forEach(symbol => {
      console.log(`${symbol} (${sources[0]}): ${formattedPrices[symbol]}`);
    });
  });

  // Connect and subscribe
  await surge.connect();
  // await surge.subscribeToAll(['WEIGHTED']);
  await surge.connectAndSubscribe([
    { symbol: 'BTC/FDUSD', source: 'BINANCE' },
  ]);
  console.log('🎧 Streaming prices...\n');
}

streamPrices().catch(console.error);
