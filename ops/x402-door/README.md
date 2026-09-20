# x402-door — the box's self-hosted x402 facilitator door

Chartered 2026-09-16 (founder order): the smallest facilitator adapter from the
Mission 6 design. **Reuses `x402-facilitator-local` + `x402-chain-eip155`
(crates.io 2.0.2, Apache-2.0) without forking** — this crate CONFIGURES the
upstream registry and adds the estate's laws on top. Research → design
dispatch: `docs/dispatches/2026-09-16-workerb2-x402rs-deep-read-facilitator-design.md`.

## Scope (charter fence)

- Chains/schemes: **Base (`eip155:8453`) + EIP-3009 `exact` + `upto`** — nothing more.
- **No production deployment.** Local/testnet first. No 4337, no swaps, no LN
  coupling, no extra schemes, no surface-side changes.
- Native-gas rails stay fallback (R5); EIP-7702/LN stay parallel first-line
  routes (7702-delegated payers compose at the payer side via upstream's
  ERC-6492 validation — no dependency either way).

## The laws this door adds (all test-pinned, `tests/acceptance.rs`)

1. **Float fail-closed** — `/verify` refuses when the ops wallet float cannot
   fund settlement gas; no reservation is created.
2. **Reserve→settle with evidence** — reservations (keyed by authorization
   nonce, per-chain directories) reconcile DOWN only with tx-hash evidence;
   `upto` actual ≤ authorized is enforced at reconcile.
3. **Idempotent settle** — a settled nonce replays stored evidence; the
   facilitator executes exactly once.
4. **Expiry law** — an expired window never settles; release requires
   evidence of non-settlement (on-chain check).
5. **Torn fail-closed** — a corrupt journal file refuses operations, named.
6. **R4 per-leg unlinkability** — one chain per log line, truncated payer
   tags, per-chain journal directories; no cross-chain joins anywhere.
7. **Door swap** — the door runs against any `SettlementFacilitator`
   implementation with zero surface change (tested with a second impl).
8. **Daily gas cap** — refusals name the cap and current exposure;
   no-evidence failures RETAIN their exposure (FailedKeep carries it).

Plus watchpay's ledger mechanics verbatim: exclusive-writer OS file lock
across every mutation, kernel-released on death; temp-file + fsync + rename
durability; `Unknown` never auto-retries (HumanGate only).

## live-wiring (upstream-composition mirror; CI-compiled)

`SchemeRegistry::build` composition lives behind `--features live-wiring`
(default OFF). Upstream 2.0.2 ships no public example composing the
registry with a real provider, and the provider-trait impl topology
(`Arc<T>` blankets, no reference impls) leaves the stored provider type to
be settled by a real Linux compile (the box) or upstream guidance. The
door's LAWS and acceptance contract do not depend on it (door-swap seam);
nothing here is claimed working until it compiles green.

## Run (Linux — box/CI)

Upstream `x402-facilitator-local` uses `tokio::signal::unix`: the live binary
targets Unix. The library + acceptance suite are platform-independent
(the Windows dev seat runs them).

```
cargo test --locked --manifest-path ops/x402-door/Cargo.toml   # the 8-point contract
cargo run   --locked --manifest-path ops/x402-door/Cargo.toml -- ops/x402-door/door.config.json
```

`door.config.json` shape: `{bind, journal_root, daily_gas_cap_wei,
reserved_gas_wei, ops_float_available_wei, chain, facilitator_chain_config}` — the last is an
upstream `Eip155ChainConfig` JSON (Base RPC endpoints + signers as ``
references per the env-only law); the two chartered schemes are constructed
in code, not configurable.
The binary binds loopback only; Caddy fronts the same-origin door
(`relay.skaists.dev/x402/*`) when the box run is separately chartered.

## Testnet smoke — PENDING the founder ops gesture

The on-chain leg (Base Sepolia, EIP-3009 USDC) needs: (a) a dedicated ops
wallet floated with testnet ETH (the standard funding ritual — watch-WIF
class, root-owned 600, NEVER the vending/meter treasury), (b) testnet USDC
carrying EIP-3009. Until that gesture, the door's laws are proven offline
against the facilitator seam (the acceptance suite) and the live wiring
compiles against upstream unmodified. No production.
