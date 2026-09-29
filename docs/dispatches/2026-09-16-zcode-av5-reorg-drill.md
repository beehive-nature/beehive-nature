# 2026-09-16 — AV-5 reorg / flag-not-credit drill, RED → GREEN (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-5 (P1, second per
the founder roll order: AV-6 → AV-5 → AV-4 → AV-11; "no production
deployment; CI arbitrates each step; roll forward automatically"). **Branch**
`zcode/av2-stale-quote-ttl`, worktree `wt-zcode-av2`.

## RED receipts (box, Python 3.12.3, exit 1)

- **The gap, proven live** (PART A, kept in the battery forever): today's
  poller skips consumed-seq rows SILENTLY — a fork that swaps history behind
  the watermark (a consumed seq re-presented MUTATED: new trx, attacker
  amount/memo) leaves ZERO evidence, while new rows landing on the forked
  chain credit normally. The `:423` law ("action read failed — nothing
  written") covers read failures only; **the reorg leg did not exist**.
- The seam absent: `AttributeError: module 'meter' has no attribute
  'process_transfers'`.

## The GREEN

**Python (`meter.py`)** — the poller's credit decision extracted into a PURE,
reorg-aware seam:
- `process_transfers(es, rows, st, meter_keys, flag_writer, detect_reorgs)` —
  first read checkpoints without credit (today's law verbatim); a REORGED
  round **flags loudly and credits NOTHING**: watermark and head-map park
  (fail closed — the whole round is suspect), the flag carries the evidence,
  and the state keeps the newest eight flags (bounded). Clean rounds behave
  exactly as today (memo-routed credit; unbound rows returned to the caller
  for instruction emission). `detect_reorgs=False` is today's crediting
  poller — the negative-control shape only.
- Reorg detection, two shapes: **seq→trx swap** (a remembered seq now
  carries a different trx_id — history rewrote behind the watermark; the
  poller remembers a bounded 64-seq window) and **head rollback** (the best
  seq receded below the watermark).
- `cmd_chainpoll` rewires through the seam (identical observable behavior on
  clean rounds); the production `flag_writer` drops an instruction-style
  `reorg-*.json` file for the founder — the meter writes evidence, never
  acts (baton fence).

**Rust (5.2 — the wiring the spec named "currently unwired")** —
`crates/reversibility/tests/reorg_drill.rs`: the fork across independent
sources, start to verdicts — the SPLIT window reads `NoQuorum` with both
candidates visible at one operator each (never an Agreed-by-one-operator
confirmation; an unreachable source is a gap, not a vote); once the network
resolves, `movement(prev_agreed → fork_head, descends=false)` = **Reorg{depth:
1}** (the crate's own law: an unproved advance and a rewrite look identical,
and the safe reading of "cannot tell" is the one that makes a caller stop);
honest descent reads `Advanced`, the no-op reads `Still`. Verdict-to-law tie:
NoQuorum / Reorg ⇒ flag-and-park, never credit.

## Receipts

- Python battery (box): **3/3 green** — PART A gap receipt; 5.1 both fork
  shapes ⇒ zero credit + evidence-carrying flag + parked watermark +
  identical ledger bytes, clean rounds before/after exact; 5.3
  detection-disabled poller credited the forked round (delta 1.0000 A) and
  5.1's zero-credit assertion FAILS against it — the harness detects the
  class.
- Rust: reversibility 12/12 + drill 1/1 (fmt clean).
- Regressions (box): voucher 16/16, x402 45/45, AV-3 5/5, AV-6 4/4, AV-1
  serve-bridge 5/5.
- CI: the battery joins its siblings; the drill rides `cargo test
  --workspace --locked`. CI arbitrates on push.

## Standing notes

- No production deployment: the seam and flag law are repo-side; the box
  poller gains the reorg leg only when deployed (and the AV-3 door-signal
  reminder holds here verbatim: **implemented invariant ≠ live-wired
  invariant**).
- P1 continues: AV-4 (cross-rail disjointness / handle unlinkability) next,
  then AV-11 (human-gas audit).
