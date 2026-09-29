# WORKERB2 — the x402 door IMPLEMENTED: acceptance contract green, landed · 2026-09-16

**Seat:** Workerb 2 (building workerb, per founder charter: *"implement the
smallest x402 door from the Mission 6 design and acceptance contract. Reuse
`x402-facilitator-local`; do not fork/reinvent it. Start Base + EIP-3009
`exact` + `upto`. Reuse watchpay's proven reservation/recovery laws and
enforce R4 per-leg unlinkability. Build and test locally/testnet first. No
production deployment… The implementation is complete when the eight-point
acceptance contract passes—not when code merely compiles."*)

**LANDED:** `ops/x402-door/` on main @ `341c9e1d` (7 commits, rebased clean
over the concurrent ADVERSARIAL-BPAY-QUEUE landing; main CI ALL GREEN:
test incl. the new door step, node, static, secret-scan, pages).

## What shipped

- **A platform-independent door library** carrying every chartered law:
  `journal.rs` (reserve→settle ledger), `orchestrator.rs` (door flow +
  the replaceable `SettlementFacilitator` seam), `wire.rs` (strict
  dual-canonical-shape leg extraction, R4-safe logging, axum surface
  `/verify` `/settle` `/supported`), plus `main.rs`/`imp.rs`.
- **Upstream reused, not forked:** deps on crates.io
  `x402-facilitator-local`/`x402-chain-eip155` 2.0.2 (Apache-2.0) with the
  `facilitator` feature enabled; the chains config deserializes as
  upstream's own `Eip155ChainConfigInner` with signers as `$ENV`
  references (env-only key law); the two chartered schemes are constructed
  in code with an exact-chain pattern — no wildcard, charter fence as
  type-level fact.
- **The acceptance contract: 11/11 green** (8 contract points + 3 journal
  law tests), clippy zero warnings, fmt clean — locally (Windows) for the
  lib and in CI (Linux) via the new workflow step. The suite caught and
  fixed one real LAW BUG en route: `FailedKeep` originally dropped its
  reserved-gas figure — the suite proved a no-evidence failure must RETAIN
  exposure in the daily budget, and the law now carries it.
- **R4 structurally:** journal directory per chain; log lines carry one
  chain + truncated payer tag; CI-greppable; tested.

## The one honest FLAG (live-wiring, default-OFF feature)

Upstream 2.0.2 publishes **no public composition of
`SchemeRegistry::build` with a real provider** (their example is
client-side; only the aptos crate carries facilitator tests). The trait
topology — `X402SchemeBlueprint<P>` requires
`for<'a> X402SchemeFacilitatorBuilder<&'a P>` while provider traits are
implemented for `Eip155ChainProvider` and blanket `Arc<T>` but never
references — leaves the stored provider type unresolved from signatures
alone. The complete wiring lives behind `--features live-wiring` (off by
default), **never claimed working until it compiles green on the box's
Linux toolchain or with upstream guidance**. The door-swap seam means the
laws hold regardless. Also banked: upstream's `tokio::signal::unix` makes
the live path Linux-only by construction.

## En-route discoveries (banked for the roll-forward)

- `x402-chain-eip155` ships `default = []` — the facilitator/blueprint
  impls exist only behind the feature; a plain dep import satisfies
  nothing (bit us, then fixed).
- Upstream request wrappers are serde-only (private constructors by
  design) — the seam deserializes the verbatim request JSON.
- The concurrent **ADVERSARIAL-BPAY-QUEUE** (973e188e) lands exactly as
  the door's roll-forward target: **AV-7 (two-route acceptance fixture)**
  and **AV-8 (settle-UNKNOWN reconciliation)** map one-to-one onto this
  journal's idempotency/evidence and Unknown/HumanGate laws — the door is
  the natural first consumer.

## Next (roll-forward, no pause)

Adversarial testing/security review of the landed door per the charter —
consuming AV-7/AV-8 (and AV-6's aggregate-fee-ceiling shape against the
door's daily cap) — plus resolving the live-wiring compile item on the box
or upstream. Testnet smoke stays PENDING the founder ops gesture (Base
Sepolia EIP-3009 USDC + floated ops wallet; README documents the runbook).

**No production deployment. No 4337, swaps, LN coupling, or extra
schemes. Loopback-only bind.**
