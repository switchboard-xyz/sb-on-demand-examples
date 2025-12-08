# EVM On-Demand Examples

Switchboard On-Demand oracle functionality for EVM-compatible chains.

## 📍 Contract Addresses

| Network | Chain ID | Switchboard Contract |
|---------|----------|---------------------|
| **Monad Mainnet** | 143 | `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67` |
| **Monad Testnet** | 10143 | `0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33` |
| **Hyperliquid Mainnet** | 999 | `0xcDb299Cb902D1E39F83F54c7725f54eDDa7F3347` |
| **Hyperliquid Testnet** | 998 | TBD |

> For legacy EVM chains (Arbitrum, Core, etc.), see the [legacy examples](./legacy/).

## 🌐 Network Guides

Detailed setup and integration guides for each network:

- **[Monad](./docs/MONAD.md)** - High-performance EVM blockchain
- **[Hyperliquid](./docs/HYPERLIQUID.md)** - Layer 1 with native perpetual futures

## 🚀 Quick Start

```bash
# Install dependencies
cd evm && bun install

# Build contracts
forge build

# Deploy (Monad Testnet example)
forge script script/DeploySwitchboardPriceConsumer.s.sol:DeploySwitchboardPriceConsumer \
  --rpc-url https://testnet-rpc.monad.xyz --broadcast -vvvv

# Run price feed example
PRIVATE_KEY=0x... CONTRACT_ADDRESS=0x... NETWORK=monad-testnet bun scripts/run.ts

# Run randomness example
PRIVATE_KEY=0x... NETWORK=monad-testnet bun run randomness
```

## 📁 Directory Structure

```
evm/
├── src/               # Solidity smart contracts
│   └── SwitchboardPriceConsumer.sol
├── script/            # Foundry deployment scripts
├── scripts/           # TypeScript integration examples
│   └── run.ts
├── examples/          # Feature examples
│   ├── updateFeed.ts
│   ├── randomness.ts
│   └── utils.ts
├── docs/              # Network-specific guides
│   ├── MONAD.md
│   └── HYPERLIQUID.md
└── legacy/            # Previous implementation examples
```

## 📋 Prerequisites

- **Bun** (or Node.js 16+)
- **Foundry** for Solidity development
- Native tokens for gas (MON, ETH, etc.)

---

## 📈 Price Feeds

Real-time oracle price data for DeFi applications.

### Integration Example

```typescript
import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';

const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(privateKey, provider);

// Fetch oracle data
const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
const response = await crossbar.fetchOracleQuote([feedHash], 'mainnet');

// Submit update
const switchboard = new ethers.Contract(switchboardAddress, SWITCHBOARD_ABI, signer);
const fee = await switchboard.getFee([response.encoded]);
const tx = await contract.updatePrices([response.encoded], { value: fee });
await tx.wait();

// Query price
const [value, timestamp, slotNumber] = await contract.getPrice(feedId);
console.log(`Price: ${ethers.formatUnits(value, 18)}`);
```

### Available Feeds

> All feeds below are **sponsored on Monad** — oracle updates require no payment from users.

<details>
<summary><b>Major Cryptocurrencies</b></summary>

| Asset | Feed ID |
|-------|---------|
| MON/USD | `0x2d5f0a89b34b1df59445c51474b6ec540e975b790207bfa4b4c4512bfe63ec47` |
| BTC/USD | `0x4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812` |
| ETH/USD | `0xa0950ee5ee117b2e2c30f154a69e17bfb489a7610c508dc5f67eb2a14616d8ea` |
| SOL/USD | `0x822512ee9add93518eca1c105a38422841a76c590db079eebb283deb2c14caa9` |
| SUI/USD | `0x7ceef94f404e660925ea4b33353ff303effaf901f224bdee50df3a714c1299e9` |
| XRP/USD | `0x4403dfe267ac4f30e15c10e21fb8ddfc4a4d42f69f2ca3d88c18c657f0ff8710` |
| BNB/USD | `0x962d4dbb6ae366e1de9315d7055a46bd363d529f54059f6a6c2e6a245bebf825` |
| DOGE/USD | `0x5bc6d1f034f43bb9fb09064ab68334c155d9af931fad52eb13119caa75b126c3` |
| ADA/USD | `0x695237a767cd572030dfecaf163b1e396fc622b739e4bf5b18429e96c7759392` |
| AVAX/USD | `0x816c9411e88fbaecb344754c55cb325db1923c37c2c58980da7c3287d3206697` |

</details>

<details>
<summary><b>Layer 1 & Layer 2</b></summary>

| Asset | Feed ID |
|-------|---------|
| TIA/USD | `0x4a6072c172fcafd15e393b4428fea473135dafa52108870e8da12531ce44ce02` |
| OP/USD | `0x44296a1eda8f9ddc96da874ed8239d1a0d7e911ba267c953c059d3a51ed0f446` |
| ARB/USD | `0xdfb091ce2c14e99ade875c6d0a21761436864dae554e688917cca8d049825109` |
| APT/USD | `0x09e6d48cf5725b99da96c1722cf2319ea9a6aea89cc7451cbfd026d8368e58cb` |
| SEI/USD | `0x40fa0ee232f466da9d17579604ef8984ef672a89f1143388eb91afe252910f45` |
| POL/USD | `0x848c59f0b116434f254d46716d11f66e3fd6f8df1e578998d0d19b629eefd97f` |
| BERA/USD | `0x61d9b5f46c42482507bf862505e845494b5812131db3deacda71ca8302062333` |
| HYPE/USD | `0x63e105a067be323be6114d3b6c6d96293203c4b8ad3d0dee5e159ea2af77b59c` |
| S/USD | `0x7cffc1d82ed8f73b33e06830bb5979e63db793f9bfee7dd0e9a026ad96c2dc7b` |

</details>

<details>
<summary><b>Stablecoins</b></summary>

| Asset | Feed ID |
|-------|---------|
| USDT/USD | `0x8327414619366bc88545bf72da9fb072d1c324fcd94deeea0bd189c8229e5bc9` |
| USDC/USD | `0x883ea8295f70ae506e894679d124196bb07064ea530cefd835b58c33a5ab6549` |
| DAI/USD | `0x5bfcabdc3836d7e16038d225deac28f3ebd6275d6585a906dada1e3bab69ace7` |
| USDS/USD | `0xf2b757149298533cd4e27fe07ef5ef999a4b3383e3888f14bb28cf12a1e6a2c7` |
| PYUSD/USD | `0x9ac21ccc4e8778c25119fa13a1e876f24a4bc42ca4f5912a05bec75759fa66d9` |
| USDE/USD | `0x048ce95123c42eecdb2b2185f5e711aaa4a3e3c1d27869ed271a8f67e294a333` |
| FDUSD/USD | `0xbed6981367231efa695de20057cf2fdb3dfb65f03024f514a333ad4a52a8968b` |
| AUSD/USD | `0x11ab2a6544fd8c4db4299dfd0ac30089cb2d0aac9752e57e816ccc5ab67549fe` |
| USR/USD | `0x1f5a6ebeb522f5ba544cb89697a58b96f19f4929da34a26587b4e3e344504066` |

</details>

<details>
<summary><b>Wrapped & Liquid Staking Tokens</b></summary>

| Asset | Feed ID |
|-------|---------|
| WBTC/USD | `0x0b83fcfc4e041a3154d015f32aa08e07486c108bd5e87512ec914f88eed9e38b` |
| LBTC/USD | `0x16f88b6d98fa4b6be9109571db6ae27077d771fd838a2d74be54167086d1c5c2` |
| cbBTC/USD | `0x2c4138457be2c5e0bc82428240003cb49a2a7835f56d944b3a1e6de23d5414d4` |
| solvBTC/USD | `0xf09bd1f0c42ae5a1a409ada2aab8b9a6e76fc4eb5267eb9d6236c105bf7b247c` |
| WETH/USD | `0x0defbb4974f1afc44e41b96e6d6e8feff8a4ada01307a0a189d90ca6557b2719` |
| STETH/USD | `0x75d4d4262e456396a66c780c0862ccaf759c568dcf42c41e70ced26dc78dbb75` |
| wstETH/USD | `0xd5e712e5dda971f9544a7faf26edda464e558bb62c45cdfb2297b3507213f281` |
| WEETH/USD | `0x17ab4d2ed95630cc9936f5cb37624194ffb4fc0bda387cd2a682c3e0ecd04578` |
| rsETH/USD | `0xc75bd8c010fbfffa832a5827051b92cf02b2ce121fbd860bca5aa27289ad11f3` |
| ezETH/USD | `0x2bd5044aadddce1d28f96ff011b12ea59c565f1ae93505b23714957e81f76bb6` |
| STONE/USD | `0xf228c11fbee4509822ed4d880993040b608ea66e73c6b20e4223a0dcafe2eeab` |
| sUSDS/USD | `0x9e7412b2b399b4b5304a41ed18076bd15195e99d86e4fdeba5d75842c932bf94` |
| sUSDe/USD | `0x024505bcd3408298c7ecc9b4fa1ec227ff8149ec2226db14e37ed2a1bfd81874` |
| GMON/USD | `0x3569d06cfdcdfe181841d5582e09b264402bb49fe377b58ca644438fa59389e7` |

</details>

<details>
<summary><b>DeFi & Bridge Tokens</b></summary>

| Asset | Feed ID |
|-------|---------|
| LINK/USD | `0x8f4abf107a287e17fdd20055d328d74a30d4b636471552508dfb7c5432d4b7d5` |
| UNI/USD | `0x1c8ae5d2eaea755b3ef5146b75c74dc130be3d400d9859fb89407e829fc2d0d9` |
| AAVE/USD | `0x19c581a14f071f9cabab21166d37450203fff792c7937631d30372b3dcd15ad2` |
| CAKE/USD | `0x88ecdee5d25396097c6b07eae577d5e9db264baad344e50a5fbdcad68a72f9cf` |
| PYTH/USD | `0x50189d4b424c7ae432e4d050b4a7bca8816e9e6806932fee04efa79cc9cb9c46` |
| AXL/USD | `0x308ae8b637663ffe5196d156a0f06b27f667e087c0050848d87aa5d68f4ebde9` |
| ZRO/USD | `0xdaae1b232c2f41a2ebbe9add6644b10fb9535ab32f688d90364b0b3831c1801f` |
| STG/USD | `0xfd7a2e4bac42db5ca96a8a50592aedbe5101c87ca46bb8da1565fe9a99102056` |
| W/USD | `0xfbc53ad1560f56b5125607ae214950868cc7a45d7953d48175bcaccfdff362bb` |
| RED/USD | `0xe5fd72332a1e82394cba6527295cc7ec6b88985a825cba9e27f3050a649fdba0` |

</details>

<details>
<summary><b>Commodities</b></summary>

| Asset | Feed ID |
|-------|---------|
| XAU/USD (Gold) | `0xce87065d6e7a7e7913fe01ffc1026500634e753e16df2afe593627aee57f06cf` |
| XAG/USD (Silver) | `0xc67736821132a0cd34c1d7fbc872868c808606666d1e54385dc8a6d60e437546` |

</details>

Find more feeds at: [explorer.switchboard.xyz](https://explorer.switchboard.xyz)

---

## 🎲 On-Chain Randomness

Cryptographically secure verifiable randomness for gaming, NFTs, and DeFi.

### How It Works

1. **Request** — Create a randomness request with unique ID
2. **Commitment** — Oracle is assigned and commits to randomness
3. **Reveal** — After settlement delay, oracle reveals the value
4. **Verification** — Contract verifies signature and stores result

### Quick Start

```bash
# Monad Testnet (default)
PRIVATE_KEY=0x... bun run randomness

# Other networks
PRIVATE_KEY=0x... NETWORK=monad-mainnet bun run randomness
PRIVATE_KEY=0x... NETWORK=hyperliquid-mainnet bun run randomness
```

### Integration Example

```typescript
import { ethers } from 'ethers';
import { CrossbarClient } from '@switchboard-xyz/common';

const switchboard = new ethers.Contract(switchboardAddress, SWITCHBOARD_ABI, signer);
const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');

// 1. Create randomness request
const randomnessId = ethers.keccak256(ethers.toUtf8Bytes(`game-${gameId}`));
await switchboard.createRandomness(randomnessId, 5); // 5 second delay

// 2. Get assigned oracle
const data = await switchboard.getRandomness(randomnessId);

// 3. Fetch reveal from Crossbar (after delay)
const { encoded } = await crossbar.resolveEVMRandomness({
  chainId: 10143,
  randomnessId,
  timestamp: Number(data.rollTimestamp),
  minStalenessSeconds: Number(data.minSettlementDelay),
  oracle: data.oracle,
});

// 4. Settle on-chain
const fee = await switchboard.updateFee();
await switchboard.settleRandomness(encoded, { value: fee });

// 5. Use the random value
const result = await switchboard.getRandomness(randomnessId);
const diceRoll = Number((result.value % 6n) + 1n);
```

### Use Cases

| Application | Example |
|-------------|---------|
| **Gaming** | Fair loot drops, random encounters, card shuffling |
| **NFTs** | Random trait generation, blind box reveals |
| **DeFi** | Random liquidation selection, lottery mechanisms |
| **Governance** | Random jury selection, fair ordering |

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "Insufficient fee" | Query `switchboard.getFee(updates)` before submitting |
| "Price deviation too high" | Normal during volatility; adjust `maxDeviationBps` if needed |
| "Price too old" | Fetch fresh data; adjust `maxPriceAge` if needed |
| Build errors | Run `forge clean && forge build` |

---

## 📚 Resources

- [Switchboard Documentation](https://docs.switchboard.xyz)
- [Switchboard Explorer](https://explorer.switchboard.xyz)
- [Feed Builder](https://explorer.switchboard.xyz/feed-builder)
- [Solidity SDK](https://www.npmjs.com/package/@switchboard-xyz/on-demand-solidity)
- [Discord](https://discord.gg/switchboardxyz)
