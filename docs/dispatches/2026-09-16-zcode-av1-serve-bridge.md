# 2026-09-16 — AV-1 serve-bridge: crash / concurrency / hostile input, RED → GREEN (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-1 (P0). Founder
disposition this round: AV-2 accepted, 300s TTL ratified as configurable
default; "roll directly into AV-1… No production deployment." **Branch**
`zcode/av2-stale-quote-ttl` (continuing the AV lane), worktree `wt-zcode-av2`.

## RED receipts

1. **The deep gap**: the serve boundary (`meter.py serve`) had NO write path at
   all — view/afford only. The battery's first case against pre-fix main:
   `FAIL: 1.1: crash header did not kill the server`, exit 1 (a POST settle
   simply 404s; nothing can crash, nothing can be idempotent). Battery commit
   precedes the implementation commit.
2. **A live engine race the harness caught mid-GREEN**: first concurrent run
   (8×12 mixed ops) **forked the hash chain at event 5** — `_append` sealed
   events (tip read) outside the append lock, so two writers sealed against
   the same tip. Not hypothetical, not theoretical: event 5 of the first
   mixed-load run. Fixed by making seal+write one critical section; the
   battery's chain assertion is now its permanent regression.

## The GREEN

**meter.py serve — the ADMIN rail** (bearer `VOUCHER_ADMIN_TOKEN`; unset ⇒
503 typed refusal on every write — a bridge deployed read-only stays
read-only, fail closed; no CORS reflection, loopback callers only):
- `POST /v1/admin/settle {idempotency_key, voucher, declared, observed}` —
  credit_from_settlement under the bridge key law.
- `POST /v1/admin/charge {idempotency_key, voucher, usage:[[class,qty]…]}`
  — the till's own pricing construction (`till_rate_set`, the cmd_charge
  lineage, token classes).
- Idempotency law: the key is recorded ON the ledger event (additive field);
  replay returns the ORIGINAL event (`idempotent_replay: true`); same key +
  different payload = 409 conflict, never a second effect. The engine's
  `(voucher, tx)` settle idempotency stays in force UNDER the bridge law.
- Hostile law: strict-JSON duplicate-key refusal, 64 KB body cap (413),
  strict schemas with unknown-field refusal, bool-rejecting integer quantity
  checks bounded at 2^48, voucher/key/amount regexes (the negative/oversized/
  unicode shapes all die typed), every refusal a typed 4xx, zero writes on
  refusal, process survives the whole battery with ledger bytes identical.
- Crash law: appends are single O_APPEND write loops + fsync BEFORE the
  response; the deterministic kill point (`X-AV1-Crash-Before-Respond`,
  authed-admin-only test seam) fires after the durable append, before the
  response.
- `BUZZ_METER_DIR` derives the whole meter state tree (default unchanged) —
  hermetic harness + CI, and a staging knob for any future box deploy.

**Engine (`voucher_escrow.py` / `x402_meter.py`)**: `charge`'s affordability
check + append run under the module append lock (two concurrent charges can
no longer both pass against one stale balance); `_append` = lock{seal +
durable write}; `find_idempotent(kind, key)`; additive `idempotency_key`
params on `charge` / `deposit` / `credit_from_settlement`. Cross-PROCESS
appends remain single-writer-by-discipline on the box — a lockfile is a
ruled follow-up, documented in the code, not assumed away.

## Receipts

- Battery (box, Python 3.12.3, hermetic temp dir): **5/5** —
  1.1 SIGKILL mid-settle → exactly-once across restart, identical
  resubmission returns the SAME event, chain verifies;
  1.2 8×12 mixed ops → chain valid, conservation exact (84.0000 − 35.2000 =
  48.8000), every response coherent;
  1.3 fifteen hostile shapes + 200 KB body → typed 4xx each, process alive,
  ledger bytes IDENTICAL;
  1.4 settle AND charge unknown-response recovery (the charge seam is the
  bridge-key-guarded one — engine alone would double-charge);
  negative control: `AV1_BREAK_IDEMPOTENCY` variant double-charges with
  distinct receipts and the battery catches it.
- Regressions green with the engine changes: `test_voucher_escrow.py` 16/16,
  `test_x402_meter.py` 45/45 (incl. AV-2's six 2.5 proofs); Rust
  `voucher-escrow` 17/17 untouched.
- CI: the battery joins its siblings in `tests.yml` (runs every push).

## Deploy gates (unchanged, founder-ruled)

NO production deployment from this lane. When a box deploy is ever ruled:
mint `VOUCHER_ADMIN_TOKEN`, mount a FRESH `rate_set.json` (AV-2's minted_at
law), then wire the pollers/doors to the admin rail. Rollback for the
repo-side change = revert the commit; the admin rail without a token
environment is inert by construction.
