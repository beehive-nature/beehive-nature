# Handoff: WB004 jungle-live evidence → BNROSE-RUST-001 / SETTLE (Rust execution lane)

**From:** the WB004 jungle-live seat (zCode, PR #406 merged `38c394fac`).
**Founder ruling 2026-10-13:** #406 is **live protocol-characterization
evidence**, not a production-ready autonomous settlement adapter. The retry
defect is carried into the Rust battery; the unsafe retry behavior is NOT
carried into the new core.

## 1 · What you receive

- **Chain receipts** — `scripts/btungsten/wb004-live/state.json` (41 steps,
  verbatim refusal messages, block-inclusion-verified acceptances) and
  `receipt-wb004-live.json`; the dispatch
  `docs/dispatches/2026-10-12-btungsten-wb004-jungle-live.md` with the full
  timeline. Exec `30b68fdf…` at block 291734484 (irreversible, dual-provider);
  the re-proposed instances at blocks 291734646/712 and second exec
  `237aabde…` are PART OF THE EVIDENCE — they are the retry defect realized.
- **The deterministic regression** —
  `scripts/btungsten/wb004-retry-safety.test.mjs` (CI-wired through the
  existing `scripts/btungsten/*.test.mjs` glob; no workflow edits). Two
  CONVICTION rows demonstrate the current failure offline (zero chain, zero
  spend, throwaway key): unresolved inclusion → four replacement signatures
  for one logical step; restart with an unpersisted txid → a second proposal
  instance executes. One REQUIRED row is the executable acceptance criterion
  your Rust implementation must match. Translate it into the Rust battery;
  the JS file is the reference oracle, not a component to reuse.
- **Compatibility vectors, NOT a signer** — per the ruling, do not build
  another custom JavaScript signer. The vectors that matter:
  - K1 wire layout `[v, r, s]`, `v = 27 + recid + 4` ∈ 31..34 —
    `fc/src/crypto/elliptic_secp256k1.cpp:141-156`.
  - The canonical law (r/s lead byte < 0x80; a zero lead byte must be
    followed by ≥ 0x80) — `fc/src/crypto/elliptic_common.cpp:152-157`.
  - Sig digest tail = 32 ZERO bytes for empty CFD — Leap
    `libraries/chain/transaction.cpp:47-57`.
  - Ground truth: `scripts/btungsten/wb004-live/probe-sig-layout.mjs`
    recovers real chain signatures and matches account keys (4/4).
  - Exact live refusal strings (for error-class tests) are in `state.json`:
    `hash mismatch`, `transaction authorization failed`, `proposal not found`,
    `too early to execute`, `transaction expired`, `approval is not on the
    list of requested approvals`, `cannot transfer to self`,
    `duplicate transaction <txid>`, `unable to reconstruct public key from
    signature`, `signature is not canonical`.

## 2 · The persistence law (required of the Rust core)

1. **Persist before submission**: for every logical operation, journal the
   operation id, the proposal-instance identity, the EXACT signed bytes, and
   the transaction id BEFORE the submission leaves the process. (The JS
   reference uses `writeFileSync` as a durability stand-in; you own real
   durability — sync, atomic-rename, whatever your crate law requires.)
2. **Missing observation = UNKNOWN.** An accepted-but-unverified push, a
   timed-out read, an absent row — none of these license a rebuild, a
   re-sign, or a re-propose.
3. **Reconciliation may rebroadcast the IDENTICAL signed bytes only.** The
   chain's own `duplicate transaction <txid>` refusal is then the
   reconciliation (observed live, P6 control). Constructing a new
   transaction for the same logical step is the defect, not the cure.
4. **Refuse automatic replacement under uncertainty.** Where operation-level
   replay protection is not enforceable (it is NOT, today: per-transaction
   dedup is the only chain-side guard; a proposal name becomes reusable
   after exec erases its row), say so and stop for external reconciliation.
5. **Reconcile across interrupted execution AND concurrent workers**: two
   workers on one operation must converge via the journal + the duplicate
   txid refusal, never via instance recreation.
6. Distinguish in code and in logs: **clean refusal** (old tx provably never
   landed → a new transaction is legitimate) versus **unresolved outcome**
   (UNKNOWN → rebroadcast-identical or stop). The 2026-10-12 runner treated
   unresolved like refused; that is the root error.

## 3 · Preserved live findings (do not re-derive, do not over-read)

- **Rotation ≠ withdrawal.** Rotating the approving permission's key does
  NOT withdraw a stored approval (exec succeeded post-rotation, live);
  `invalidate()` DOES drop earlier approvals at exec time. Both convicted.
- **The link law.** `check_transaction_authorization` enforces
  permission→action links for the DECLARED inner authorizations at propose.
  `linkauth` restricts ACTION CLASSES only — this test does NOT establish
  chain-enforced recipient or amount limits.
- **Separation of concerns (four different things):** threshold-1 delegated
  permission behavior (measured live) / multiparty quorum (NOT exercised) /

  BNR policy checks (off-chain, never on-chain here) / on-chain aggregate
  verification (does not exist on Jungle4). Keep them separate in the Rust
  core's claims.
- Cold recovery as built reconstructs KNOWN transactions from a supplied
  receipt; recovering an interrupted operation whose transaction was never
  saved is YOUR battery's job (the REQUIRED row is the shape of it).
- Deployed-code facts: Jungle4 `eosio.msig` wasm `afbc51b5…` writes
  `approvals2`/`invals`; byte-equivalence to the vendored `c526479a`
  specimen is NOT established (behavior probes only — a build-and-hash
  comparison remains a cheap open item).
- PR #378 (SETTLE bridge, model scale) is OPEN with its eternal-class checks
  red; its branch belongs to the archived 2026-10-09 SETTLE session —
  reconcile ownership in your lane before touching it.
