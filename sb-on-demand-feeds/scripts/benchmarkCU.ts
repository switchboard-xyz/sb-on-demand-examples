import * as sb from "@switchboard-xyz/on-demand";
import { TX_CONFIG, sleep} from "./utils";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorUtils } from "@switchboard-xyz/on-demand";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

(async function main() {
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const keypair = await AnchorUtils.initKeypairFromFile("/Users/alexstewart/.config/solana/switchboard_work.json");
  const wallet = new NodeWallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet);
  const pid = sb.ON_DEMAND_DEVNET_PID;
  const program = await anchor.Program.at(pid, provider);

  const feeds = [
    new PublicKey("CmZjMhReYDmUZnwCLGhuE6Q5UyjUvAxSSEZNLAehMuY9"),
    new PublicKey("ceuXtwYhAd3hs9xFfcrZZq6byY1s9b1NfsPckVkVyuC"),
    new PublicKey("J9nrFWjDUeDVZ4BhhxsbQXWgLcLEgQyNBrCbwSADmJdr"),
    new PublicKey("F8oaENnmLEqyHoiX6kqYu7WbbMGvuoB15fXfWX6SXUdZ"),
    new PublicKey("69XisEUvgWYoKd9TiBWnqgZbFvW7jKTsAitjhjhZ19K"),
  ];

  for (let numFeeds = 1; numFeeds <= 5; numFeeds++) {
    for (let numSignatures = 1; numSignatures <= 5; numSignatures++) {
      console.log(`Running test with ${numFeeds} feed(s) and ${numSignatures} signature(s)...`);
      
      const selectedFeeds = feeds.slice(0, numFeeds);
      const timestart = Date.now();
      try {
        const [pullIx, luts] = await sb.PullFeed.fetchUpdateManyIx(program, {
          feeds: selectedFeeds,
          numSignatures: numSignatures,
        });
        const timeEnd = Date.now();
        console.log(`Time to fetch update: ${timeEnd - timestart}ms`);
        
        const tx = await sb.asV0Tx({
          connection,
          ixs: [pullIx[0], pullIx[1]],
          signers: [keypair],
          computeUnitPrice: 200_000,
          computeUnitLimitMultiple: 1.3,
          lookupTables: luts,
        });
        
        const sim = await connection.simulateTransaction(tx, TX_CONFIG);
        const computeUnits = sim.value.unitsConsumed;
        console.log(`Compute units used: ${computeUnits}`);
        
        const sentTx = await connection.sendTransaction(tx);
        console.log(`Transaction sent: ${sentTx}`);
      } catch (error) {
        console.error(`Error with ${numFeeds} feeds and ${numSignatures} signatures:`, error);
      }
      
      await sleep(3000); // Small delay before next iteration
    }
  }
  
  console.log("All test cases completed.");
})();
