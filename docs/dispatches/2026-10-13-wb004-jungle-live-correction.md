# 2026-10-13 — WB004 jungle-live correction: the retry defect recorded at source, convicted deterministically, handed to the Rust core; lane archived

Lane: `zcode/wb004-jungle-live-correction` (worktree `wt-zcode-wb004live`).
Order: founder 2026-10-13 — CONTINUE bounded correction + handoff → ARCHIVE.
No new live transactions were made; the regression is offline and
deterministic (throwaway key, simulator endpoint, zero spend).

## 1 · The ruling, recorded

PR #406 (merged `38c394fac`) is **live protocol-characterization evidence**,
not a production-ready autonomous settlement adapter. The preserved results
stand: hash-bound approvals (wrong-hash refused `hash mismatch`), the
rotation-vs-invalidation distinction (rotation does not withdraw stored
approvals; `invalidate()` does), irreversible execution dual-provider
verified, 31-transaction reconstruction with no client on the critical path.

The re-classified fact stands with a harder name: the retries did not merely
mis-report — **the orchestration created a second proposal instance and a
replacement operation executed** (re-proposals at blocks 291734646/712,
second exec `237aabde…`). Per-proposal execution protection did not prevent
it because nothing operation-level existed to protect: per-transaction-id
dedup is the chain's only guard, and every retry carried a fresh id.

## 2 · The defect, at source (run-lifecycle.mjs, as merged)

1. **`pushAction`'s unresolved-inclusion loop re-signs replacements.** When
   the bounded inclusion search finds nothing, the loop fetches fresh TAPOS,
   builds NEW bytes, signs a NEW signature (new txid) and pushes it. Under
   reads that lag (observed on the CryptoLions load balancer), each retry is
   a genuinely new transaction the chain cannot dedup. A clean refusal
   legitimately permits a new transaction — the old one provably never
   landed; the defect is treating an UNRESOLVED outcome (accepted-but-
   unverified, timed-out, absent row) like a refusal.
2. **`stageP1`'s resume re-instances.** `waitForRow` (single try, lag-able)
   plus an absent `p1_exec_txid` FIELD falls through to buildProposal +
   propose. The exec txid WAS in the steps journal — `record()` wrote it —
   but the resume path consults only the field: recovery data existed and
   was not consulted.
3. Consequence chain (live): exec erases the row → name reusable → restart
   re-proposes → second instance → approves hash-bound → executes. Exactly
   once held per instance; nothing held per operation.

## 3 · The regression (deterministic, non-spending, CI-wired)

`scripts/btungsten/wb004-retry-safety.test.mjs` — picked up by the existing
`scripts/btungsten/*.test.mjs` CI glob (no workflow edits). Local receipt:
**4/4 pass**.

- **CONVICTION 1** (the current `pushAction` semantics, faithfully copied
  and cited): unresolved inclusion → **four distinct signatures and txids
  for one logical step**; the simulator's per-txid dedup is blind to all
  but byte-identical repeats.
- **CONVICTION 2** (the live incident, zero chain): lifecycle executes →
  crash before the exec txid reaches the resume field → restart → row
  legitimately gone → current resume re-proposes → **the operation executes
  a second time**.
- **REQUIRED** (executable acceptance criteria for the Rust core):
  journal-before-submit (operation id, instance identity, exact signed
  bytes, txid — persisted BEFORE submission), unresolved reads resolve to
  **UNKNOWN** with no retry loop, restart reconciliation may rebroadcast
  the IDENTICAL bytes only (the chain's `duplicate transaction <txid>`
  refusal is the reconciliation — matching the live P6 observation),
  automatic replacement is REFUSED, exactly one signature per operation,
  one instance, nothing executed under unresolved reads.
- **SCOPE** (pinned so no successor over-reads a green run): linkauth
  bounds action CLASSES, not recipients or amounts; threshold-1 delegated
  permission, no multiparty quorum; cold recovery reconstructed KNOWN
  transactions from a supplied receipt — interrupted-unsaved-operation
  recovery is the Rust battery's; threshold-1 behavior, quorum, BNR policy
  checks and on-chain aggregate verification are four separate things.

## 4 · Handoff

`docs/handoffs/2026-10-13-wb004-jungle-live-settle-rust.md` → the
**BNROSE-RUST-001 / SETTLE owner**: the chain receipts, the regression as
reference oracle, the persistence law (§2 of the handoff), the concurrency
reconciliation duty, and the compatibility vectors (fc wire laws with
citations, the signer ground-truth probe, the exact live refusal strings).
Per the ruling: **no new custom JavaScript signer** — the codec/signature
counterexamples are vectors for the established signer and the Rust
adapters, and production credential handling stays with the established
custody, not re-guessed here.

## 5 · Cross-lane reconciliation (done before this dispatch was written)

- **PR #378** (SETTLE bridge, model scale): OPEN, head
  `zcode/skaists-settle-bridge-2026-10-09`, checks 40 success / 6 skip /
  2 failure (eternal class). Its branch belongs to the archived 2026-10-09
  SETTLE session; implementation follow-through now routes to the
  BNROSE-RUST-001 lane per this order. Not touched here.
- **The bDroP eternal timing failure** from #406's merge window: already
  repaired by the keychain continuity lane (`e59d41913` widened the
  mid-handoff restart reconcile window 20s→45s, naming main's own failing
  runs; `9f5128526` made non-native keychain scenarios inert; main's tests
  workflow green at `f00b6e50c`). Historical only — **no rerun loop
  restarted**.
- **RB05 label corrected.** The 10-12 dispatch's "real aggregation
  cryptography stays routed to RB05" was a stale label: RB05 is the CLOSED
  wire-injectivity workbench lane (closed `df25b1886` with the item not
  started; the cryptol leg took it over per the 10-10 dispatch). Aggregate
  cryptography has **no seated owner today** and is named open — it is not
  assigned to any closed session or to the Rust execution lane.
- This lane's processes: none running (no watchers, no background tasks;
  the standing automations on this box belong to other seats — verified
  before archive). No new live transactions, no duplicate watchers, no
  founder approval loop.

## NEXT OWNER

- **BNROSE-RUST-001 / SETTLE**: the handoff above — persistence law,
  interrupted-execution and concurrent-worker reconciliation, the Rust
  translation of the REQUIRED row, the compatibility vectors.
- Named open (no owner): deployed-vs-vendored msig wasm hash comparison;
  the follower-node second witness; aggregation cryptography behind
  WB004's fixed interface.
- PR #378 rebase/rerun: its owning lane, coordinated with BNROSE-RUST-001.

HUMAN INTERACTION: NONE.
