# Switchboard Randomness Example: Pancake Stacker (Solana)

> **⚠️ WORK IN PROGRESS - NOT FUNCTIONAL**
>
> This example is currently under development. The browser UI does not work due to the `@switchboard-xyz/on-demand` SDK having Node.js-specific dependencies that cannot be polyfilled in the browser. The CLI script (`npm run flip`) works correctly.
>
> **Status:** Waiting for a browser-compatible Switchboard SDK or backend API solution.

A pancake stacking game demonstrating Switchboard's on-chain randomness on Solana using Anchor. Stack pancakes by flipping them onto your pile - each flip has a 2/3 chance to land!

## How It Works

1. **Flip a pancake** - Commit to Switchboard randomness
2. **Catch the pancake** - Reveal the randomness and see if it lands
3. **Build your stack** - Each successful flip adds to your stack height
4. **Don't drop it!** - A failed flip (1/3 chance) knocks over your entire stack

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Bun](https://bun.sh/) or Node.js

---

## Installation

### 1. Install Dependencies

```bash
bun install
```

### 2. Build the Program

```bash
anchor build
```

### 3. Configure Solana CLI

```bash
# Use devnet for testing
solana config set --url devnet

# Create a keypair if you don't have one
solana-keygen new

# Airdrop some SOL for testing
solana airdrop 2
```

---

## Deploying the Program

### 1. Generate Program Keypair

First, create the target directory and generate a program keypair:

```bash
mkdir -p target/deploy
solana-keygen new -o target/deploy/pancake_stacker-keypair.json --no-bip39-passphrase
```

### 2. Sync Program ID

Anchor can automatically update both `lib.rs` and `Anchor.toml` from your keypair:

```bash
anchor keys sync
```

### 3. Build and Deploy

```bash
anchor build
anchor deploy
```

---

## Running the Game

### Command Line

```bash
bun run flip
```

This will:
1. Initialize your player state (first run only)
2. Flip a pancake (commit to randomness)
3. Wait for randomness to be available
4. Catch the pancake (reveal randomness)
5. Show your result and current stack height

### Web UI

```bash
bun start
```

Open [http://localhost:3000](http://localhost:3000) to play in your browser.

---

## Architecture

### On-Chain Program (`programs/pancake-stacker/src/lib.rs`)

The Anchor program has three instructions:

#### 1. Initialize
Creates a player state account to track stack height and pending flips.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()>
```

#### 2. Flip Pancake
Commits to Switchboard randomness. The randomness must be committed in the previous slot.

```rust
pub fn flip_pancake(ctx: Context<FlipPancake>, randomness_account: Pubkey) -> Result<()>
```

#### 3. Catch Pancake
Reveals the randomness and updates the stack. 2/3 chance to land (increment stack), 1/3 chance to knock over (reset to 0).

```rust
pub fn catch_pancake(ctx: Context<CatchPancake>) -> Result<()>
```

### Off-Chain Script (`scripts/index.ts`)

The TypeScript script handles:
- Creating and managing the Switchboard randomness account
- Calling the program instructions
- Retry logic for commit/reveal operations
- Parsing transaction logs for results

---

## Randomness Flow

```
1. Create randomness account (one-time, reused between games)
       ↓
2. Commit to randomness (Switchboard)
       ↓
3. Call flip_pancake (your program)
       ↓
4. Wait ~3 seconds for randomness to be available
       ↓
5. Reveal randomness (Switchboard)
       ↓
6. Call catch_pancake (your program uses revealed value)
```

---

## Development Notes

### Randomness Keypair

The script saves the randomness account keypair to `scripts/randomness-keypair.json` for reuse between sessions. This saves SOL on rent. **This file is gitignored and should never be committed.**

### Retry Logic

The script includes retry logic for both commit and reveal operations:
- **Commit**: 3 attempts with exponential backoff (max 8s)
- **Reveal**: 5 attempts with exponential backoff (max 10s)

This handles temporary Switchboard gateway issues.

### Error Codes

| Error | Description |
|-------|-------------|
| `AlreadyHasPendingFlip` | You have an unresolved flip |
| `NoPendingFlip` | No flip to catch |
| `RandomnessExpired` | Randomness commitment is stale |
| `RandomnessAlreadyRevealed` | Can't commit to already-revealed randomness |
| `RandomnessNotResolved` | Randomness not yet available |

---

## Project Structure

```
pancake-stacker/
├── programs/pancake-stacker/
│   └── src/lib.rs          # Anchor program
├── scripts/
│   ├── index.ts            # Main game script
│   └── utils.ts            # Helper functions
├── ui/
│   └── index.html          # Web UI
├── server.ts               # Static file server
├── Anchor.toml             # Anchor configuration
├── Cargo.toml              # Rust workspace
└── package.json            # Node dependencies
```

---

## Documentation

- [Anchor Book](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Switchboard Documentation](https://docs.switchboard.xyz/)
