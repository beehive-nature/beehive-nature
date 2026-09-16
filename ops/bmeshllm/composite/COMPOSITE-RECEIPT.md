# The composite battery — verified bounded-compute lifecycle (2026-09-16)

Founder mission executed: **all three staged components integrated
off-production and run end-to-end** — a REAL llama-server (plain decoding,
NO MTP) on 127.0.0.1:8099 under the real `/slots` watchdog, fronted by the
bounded gate :8095, observed by meter-pd `--watch` with a persisted task
ledger. **FAILED=0 — every stage proven, including the mission's centerpiece:
only COMPLETE creates billable output, across restart/recovery AND
duplicate/replayed log input.** P-C cancellation propagation stayed disabled
(no upstream destroy on client departure — proven again in E2). No
production changes.

## The end-to-end chain, as proven (receipt log: `composite-receipt.log`)

| stage | proof |
|---|---|
| **admission** | C0: gate `/readiness` 200 only after llama loaded and `/slots` answered |
| **bounded execution** | E3: in-flight request cut at the idle bound (504 `stream-idle-cut`); wedge-time requests refused 503 `not-ready` — never queued into the void |
| **wedge detection/recovery** | E3: SIGSTOP injection → watchdog WEDGE-DETECTED via `/slots` in ~7 s → SIGTERM ignored 8 s (stopped process) → SIGKILL → respawn with its own startup grace → readiness 200 |
| **four-state observation** | E1/E2/E4a COMPLETE→payment receipts; E2b direct abort→PARTIAL evidence (`billing:null`, `n_tokens` observed, raw lines verbatim); gate 504→FAILED/TIMEOUT; killed in-flight task→UNKNOWN/WEDGED — **cross-source corroboration: the same wedge event produced BOTH the gate's 504 failure receipt and the meter's UNKNOWN/WEDGED marker** |
| **payment/delivery separation** | FINAL AUDIT: zero billable shapes outside the payment chain; payment tip ≠ failure tip; all four states in `state.jsonl` |
| **only COMPLETE is billable — replay** | E4b: re-parsing the FULL log through the persisted ledger produced ZERO new artifacts |
| **…across restart** | E4c: meter killed and restarted (ledger + byte-offsets persisted) — no duplicates; E4a: exactly 3 payment receipts for exactly 3 true completions, across the server restart |

## What the composite caught that the unit batteries could not

1. **Watchdog startup grace** (run 1): a loading server fails `/slots`
   innocently for 60–90 s — the watchdog killed the load as if wedged and
   restart-looped into its bound. Fix: `--start-grace` (default 120 s),
   cleared on first successful probe, re-earned by every respawn. This is a
   production-class fix the tier batteries never exercised.
2. **Meter replay dedupe** (runs 2–3): `parse_delivery` passed a fresh set
   into the production parser, so replayed text re-emitted every completion
   (3→6 payment receipts on replay). Fix: the caller's persisted seen/ledger
   set is the dedupe set passed INTO `parse_stream`.
3. **Cross-segment lifecycle splits** (runs 3–4): a cancel and its
   `n_tokens` release line can land in different 5 s polls (→ null tokens);
   a completing task must not be marked wedged by the silence sweep; a
   server restart opens a fresh task-id space (no open-task carryover).
   Fixes: persistent `pending_cancel` matching across segments; the sweep
   skips tasks completed by sweep-time; restart markers clear `open_tasks`.
4. Test-side, banked: shell variable collision (`C`=dir vs `C`=http code)
   silently broke path-based asserts — bind paths once, name scalars
   distinctly.

## Residual notes for the deployment pass (honest)

- Task ids are per-process: post-restart ids can collide across ledger
  entries. The composite clears open-task carryover on restart markers; a
  production hardening should qualify ledger keys by boot epoch.
- The sweep window (`WEDGE_SILENCE_S`, production default 120 s) must
  exceed worst legitimate launch→settle time under single-slot queueing.
- Payment=3 / failure=5 / evidence=5 in this run: the extra failure/evidence
  records are honest observations of the frozen window's unsettled tasks —
  none billable, which is the law that matters.

## Deployment posture (unchanged)

Everything remains **staged, not installed**. The composite is the
deployment-readiness evidence for the eventual founder decision: gate
bounds → watchdog recovery → four-state accounting, wired as one lifecycle,
proven against a real server, replay-safe, with only COMPLETE billable.
