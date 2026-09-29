# WORKERB2 — x402-door adversarial pass + live-wiring resolved · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"Run the x402-door
adversarial pass now: consume AV-7 and AV-8 against the implemented
journal, plus replay, duplicate settle, retained-failure exposure, R4
cross-leg correlation, torn journal, and gas-cap escape attempts. Also
resolve the `live-wiring` compile FLAG on Linux by source/code evidence.
Do not guess around upstream's provider topology. If live wiring compiles
and adversarial tests pass, prepare the Base Sepolia smoke but do not
require a funding gesture yet. No production deployment."*

**LANDED:** main @ `a60bd3d2` (CI all-green: test incl. the extended door
step, node, static). **20/20 door tests: 11 acceptance + 9 adversarial.**

## The battery caught three real defects — all fixed green

1. **DUPLICATE-CONCURRENT-SETTLE RACE (the sharpest catch).** Two callers
   could both pass the (old, read-only) settle precheck and BOTH execute
   the facilitator — the on-chain EIP-3009 nonce protects *funds*, but the
   second execution burns settlement gas and races nonces. **Fix (watchpay
   shape): the lock-held `Reserved→Settling` transition** — `begin_settle`
   makes check-and-mark one exclusive-lock transition; exactly one caller
   ever executes; concurrent settles are refused "in flight"; definitive
   failure returns to `FailedKeep` (exposure retained); ambiguity parks in
   `Unknown`; post-completion replays return the stored evidence. **Proven
   by an 8-thread barrier race with a 40ms-spin facilitator: 1 execution,
   1 success, 7 in-flight refusals, replay returns the same evidence.**
2. **THE HUMAN GATE WAS UNBOUNDED.** `resolve_unknown` skipped the upto
   cap check — a human could record an impossible over-authorization
   through the gate. The gate now carries the same evidence law
   ("the gate records truth, not the impossible") — tested via
   over-authorized gate evidence refused, lawful gate evidence settles.
3. **HOSTILE CHAIN STRINGS.** A network id embedding a second namespace or
   path (`eip155:8453/../../eip155:11155111`, extra colons, uppercase)
   survived extraction into records and log tags — a correlation vector.
   `extract_leg` now refuses anything that is not one well-formed
   lowercase CAIP-2 id, fail-closed with the reason named; the R4 test
   also proves well-formed cross-leg records never mention each other.

## The battery (9 tests, alongside the 11 acceptance)

AV-7 two-route acceptance (shared journal: route B **replays route A's
evidence**, never executes its own, never double-debits) · AV-8
settle-UNKNOWN (auto-retry refused; bounded gate) · replay-with-mutated-
amount refused with zero re-execution (leg-identity mismatch = torn
refusal) · retained-failure budget exhaustion by the numbers + evidence
reopens it · torn journal across four corruption modes (truncated, wrong
version, identity mismatch, garbage bytes) all fail closed · gas-cap
concurrent reserve race admits exactly cap/1 · expire-release-then-
re-reserve refused (terminal state) · plus the race test above.

## live-wiring: RESOLVED BY SOURCE EVIDENCE — upstream composes exactly one way

The filtered tree listing had hidden upstream's own composition crate:
**`facilitator/src/{main,chain,schemes,run,config}.rs`** — a server binary
in the workspace root. Its topology is THE answer to the trait puzzle:
the registry stores a **provider ENUM** (`ChainProvider::Eip155(Arc<
Eip155ChainProvider>)` …) that implements `ChainProviderOps` by
delegation, and the reference-shaped blueprint bound
(`for<'a> X402SchemeFacilitatorBuilder<&'a P>`) is satisfied by
**hand-written bridge impls** that pattern-match the enum, `Arc::clone`
the inner provider, and delegate to the blanket `Arc<T>` impls. No
guessing remained: `imp.rs` mirrors it (~60 lines, cited file-for-file).
CI now runs `cargo build --features live-wiring` on Linux beside the
suite — **green** (the single error on the way was a trivial method
ambiguity in the delegation, fixed by UFCS). The FLAG is closed.

## Base Sepolia smoke — PREPARED, not run (per order)

`ops/x402-door/sepolia/`: `chains.example.json` (84532, public RPC,
signer as `$X402_OPS_WALLET_KEY` env-ref), `door.config.example.json`
(loopback bind, capped float/budget), and a five-step `SMOKE-RUNBOOK.md`
(verify→settle→idempotent-replay→upto-reconcile→expired-refusal, with the
USDC-deployment-verified-at-execution-time law). **Pending the founder
ops gesture when ordered; nothing funded, nothing deployed.**

## Alignment with the D-SPECS watchlist (concurrent, 973e188e+)

Already greened by this battery: **D-8** (upto reconcile adversary —
typed refusal, never a clamp; refusal does not poison the leg), **D-4
(half)** (terminal-state refusal blocks release on a settled leg),
**D-1's RED source** (dual-mode acceptance was red-by-live-wiring — now
the wiring compiles, the end-to-end storage-leg case is runnable).
Still open for the next RED-first pass, in the specs' priority order:
**D-3 settle-time float drain, D-4's lying-RPC contradiction shape, D-5
concurrent journal start, D-6 web-unreachability, D-7 HumanGate
immutability, D-2 rollover exposure.** The pipeline law stands: specs
seat attacks → builder proves RED → builder fixes GREEN → CI arbitrates.

**No production deployment. 20/20 green. Roll-forward: the D-3/D-4/D-5
RED-first pass, then the Sepolia smoke on the founder's gesture.**
