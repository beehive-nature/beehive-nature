# 2026-09-16 — AV-2 stale conversion quote / TTL replay: RED → GREEN (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-2 (P0, founder-named
head of queue). **Protocol**: red-test-first — the implementing workerb writes
the test, receipts the gap, fixes in-lane. **Branch** `zcode/av2-stale-quote-ttl`
from origin/main `4708f8af` (worktree `wt-zcode-av2`, per the standing worktree
discipline).

## The gap (RED receipts)

Rust (`crates/voucher-escrow`): `deposit_usdc` credited any cited rate at any
age — zero ttl/expiry/valid_until handling (the audit's finding at main
`973e188e`, re-confirmed at `4708f8af`). RED commit `0e6a59ff` (this branch)
carried the full battery with enforcement deliberately absent; the receipted
run — **2 passed / 5 failed**, every failure an `Ok(...)` CREDIT:

- 2.2 stale quote (age TTL+1) → **credited 25.0000 A**
- 2.2b future-dated quote → **credited**
- 2.3 boundary age == TTL → **credited**
- 2.4 same quote id re-spent on a second voucher → **credited (double credit)**
- 2.4b replay after `from_jsonl` reload → **credited**

Python (serve-side): new 2.5 tests vs the pre-fix module —
`ImportError: cannot import name 'RATE_SET_TTL_S'` (no freshness law existed
at any level; behavioral RED for the law class is the Rust receipt above).

## The fix (GREEN commit `415162d6`)

**Rust core** — `deposit_usdc` now takes a `ConversionQuote { id, rate_fp8,
rate_ref, quoted_at }`; all refusals run BEFORE the append:
1. **Single-use first**, independent of staleness (2.4): a consumed id refuses
   `QuoteReplay(id)` even fresh-looking; ids burn into the event
   (`quote_id`/`quote_ts` fields) and `from_jsonl` rebuilds the consumed set —
   the ledger IS the nonce set (the python engine's settle-nonce law, applied
   to conversion quotes).
2. **Inclusive TTL** (2.2/2.3): `age = ts - quoted_at`; `age >= QUOTE_TTL_SECS`
   refuses `StaleQuote { age_secs, ttl_secs }` (self-describing refusal);
   future-dated quotes refuse with the same typed error (2.2b).
3. `QUOTE_TTL_SECS = 300` fail-closed default — **the NUMBER is a founder
   ruling** gating the constant, never the test shape (tests derive boundaries
   from the constant so a ruling change cannot silently break them).

**Serve-side mirror (2.5)** — `x402_meter.py`: `StaleRateSet` +
`rate_set_in_force(minted_at, now, ttl)` (inclusive boundary, future-dated
refusal, absent attestation = unjudgeable/passes, documented) +
`rate_set_minted_at_epoch()` (ISO parse). Wired: `Session.open` refuses new
sessions on a stale rate book; `burn` refuses typed with ZERO charge written
(session parks, never killed — AV-3 compatible); `credit` deliberately NOT
blocked (money-in ≠ pricing).

## Receipts (GREEN)

- Rust: stale_quote_replay **7/7**, conformance **5/5** (proofs 11–15 migrated
  to the quote API — same refusals, now at quote construction), lib **5/5**.
- Python on the box (Python 3.12.3, SSH was up): **45 proofs** incl. the six
  new 2.5 cases (fresh opens/bills; stale refuses typed; boundary inclusive;
  future-dated; mid-life burn parks with zero charge + balance fingerprint
  unchanged; credit unblocked; absent passes; ISO parse anchored to
  2026-08-29T00:00:00Z = 1787961600).
- clippy: zero NEW warnings (pre-existing fold/drained lints verified
  identical on pristine baseline via stash-diff). fmt clean. Box /tmp receipts
  cleaned up.

## Deployment note (founder-visible)

The Session wiring is repo-side; the box serve bridge must (a) pass
`rate_set_minted_at_epoch(load_rate_set())` when constructing sessions, and
(b) refresh `minted_at` whenever it refreshes `rate_set.json`. The LIVE file
is dated **2026-08-29** — under the 300s default every guarded session would
refuse until minted. That is the fail-closed default doing its job; the TTL
number and the mint discipline are the founder's ruling.

## Open (queue)

AV-1 (serve-bridge crash/concurrency/hostile harness) and AV-3 (split-brain)
remain the P0 queue behind this; AV-2's TTL ruling (the constant) is with the
founder.
