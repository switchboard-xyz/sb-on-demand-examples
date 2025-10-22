import * as sb from "@switchboard-xyz/on-demand";

(async function main() {
  const apiKey = process.env.SURGE_API_KEY!;

  const surge = new sb.Surge({
    apiKey: apiKey,
    crossbarUrl: "https://crossbar.switchboardlabs.xyz",
    crossbarMode: true,
    verbose: true,
  });

  // Listen for unsigned price updates
  surge.on("unsignedPriceUpdate", (update: sb.UnsignedPriceUpdate) => {
    const symbols = update.getSymbols();
    const sources = update.getSources();
    const formattedPrices = update.getFormattedPrices();
    // Uncomment the line below to see the full update object
    // console.log(`\nReceived unsigned price update for ${JSON.stringify(update)}`);

    const rawResponse = update.getRawResponse();
    rawResponse.feed_values.forEach((feedValue: any) => {
      const symbol = feedValue.symbol;
      const latency = Date.now() - feedValue.seen_at_ts_ms;
      console.log(`\nReceived unsigned price update for ${symbol}:`);
      const latencyInfo = ` | Latency: ${latency}ms`;
      console.log(
        `${symbol} (${sources[0]}): ${formattedPrices[symbol]}${latencyInfo}`
      );
    });
  });

  // Connect and subscribe
  await surge.connectAndSubscribe([
    { symbol: "2Z/USD" },
  ]);
  console.log("🎧 Streaming prices...\n");
})();
