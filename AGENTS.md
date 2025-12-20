# Repository Guidelines

This repository collects Switchboard On-Demand examples across Solana, EVM, and Sui; keep changes small, repeatable, and runnable per chain.

## Project Structure & Module Organization
- `common/` – chain-agnostic TypeScript/Bun utilities (job-testing, streaming, variable-overrides); scripts live in subfolders.
- `solana/` – Anchor-style Rust program code in `programs/`, TS examples in `examples/`, streaming demos in `surge/`, build outputs in `target/`.
- `evm/` – Foundry Solidity contracts in `src/`, deployment scripts under `script/`, TypeScript helpers in `examples/` and `scripts/`.
- `sui/` – Move modules in `sources/`, transaction helpers in `scripts/`, TS samples in `examples/`; Move config in `Move.toml`.

## Build, Test, and Development Commands
- Prereqs: Node 16+, Bun, pnpm, Rust toolchain/Cargo, Foundry (`forge`), Solana CLI, and Sui CLI.
- Common TypeScript: `cd common && bun install && bun run stream` (Crossbar WebSocket), `bun run job` (job testing).
- Solana: `cd solana && pnpm install && pnpm build` (BPF build), `pnpm test` (Rust unit/integration), `pnpm benchmark` for CU/latency checks.
- EVM: `cd evm && bun install && bun run example` (read a feed), `forge build`, `forge test`, deploy with `pnpm deploy:monad-testnet` after setting RPC/keys.
- Sui: `cd sui && pnpm install && pnpm run build` (Move build), `pnpm test` or `sui move test`, `pnpm run quotes` for TypeScript data pulls.

## Coding Style & Naming Conventions
- TypeScript: ES modules, camelCase for functions/vars, PascalCase for classes; format with `pnpm lint` / `pnpm lint:fix` in `solana/` (Prettier defaults). Keep example files named by feature (e.g., `examples/randomness.ts`).
- Rust: run `cargo fmt` and `cargo clippy` before commits; keep modules focused and tests near the code they cover.
- Solidity/Move: align with Foundry/Sui defaults; use descriptive contract/module names (`SwitchboardPriceConsumer`, `quote_verifier`) and document public functions.

## Testing Guidelines
- Place tests alongside chain folders (`evm/test`, Move tests in `sources/` with `#[test]` blocks, Solana Rust tests in `programs/*/src/tests`).
- Favor deterministic inputs; stub external calls when possible.
- Run chain suites before PRs: `pnpm test` in `solana/`, `forge test` in `evm/`, `sui move test` in `sui/`; capture sample output when behavior changes.

## Commit & Pull Request Guidelines
- Commit messages follow short imperative style seen in history (e.g., “Fix randomness validation”); keep scope focused.
- PRs should describe the chain touched, commands run, and any config changes; link issues and attach logs/screens where helpful (benchmarks, deploy receipts).
- Document required env vars/secrets instead of embedding them; prefer the `common/variable-overrides` pattern for API keys.
