# 2026-09-16 — AV-3 meter-vs-delivery-door split-brain, RED → GREEN (zCode)

**Spec**: `docs/agents/ADVERSARIAL-BPAY-SPECS.md` SPEC AV-3 (P0, last of the
P0 queue). Founder order: "prove first that today the meter can accrue while
delivery is unavailable. Then enforce the law: door unavailable ⇒ accrual
parks, charge delta = 0; recovery never retroactively backfills charges.
Preserve park-not-kill. Include the naive-charger negative control. No
production deployment. CI arbitrates." **Branch** `zcode/av2-stale-quote-ttl`
(AV lane), worktree `wt-zcode-av2`.

## RED receipts (box, Python 3.12.3, exit 1)

- **The gap, proven live** (PART A of the battery, kept forever as the naive
  shape): door DOWN, `sess.burn(5)` bills 5s, charges 0.0055 A, session stays
  ACTIVE — accrual ran while delivery was undeliverable. "No availability
  signal feeds accrual at all" was the audit line; this is it behaviorally.
- The law absent: `TypeError: Session.burn() got an unexpected keyword
  argument 'door_reachable'` — the seam did not exist.

## The GREEN (`x402_meter.py` Session)

- `burn(seconds, now=None, door_reachable=True)` — the availability signal
  ENTERS as an explicit parameter, the `seller_can_serve` pattern the quote
  guards already use. The engine stays pure; **the caller owns the signal**
  (production burn sites must pass live door health — wiring is deploy-side,
  not this lane). Default True is the legacy/naive shape, deliberately.
- **Park law (3.1)**: door down on an ACTIVE session ⇒ `(0, "PAUSED")` with
  `park_reason="door"`, ZERO charge written, ledger bytes identical across
  the outage window, session parked — never killed.
- **Recovery law (3.2)**: a door-parked session RESUMES on its next
  `door_reachable=True` burn and bills from the resume-point; nothing accrues
  while parked, so the outage window is structurally impossible to backfill
  (asserted exactly: 15 outage seconds + 2 delivered ⇒ charged exactly the
  2-second all-in, 0.0022 A).
- **Reason separation**: `park_reason` is `"door"` | `"balance"` | None — the
  two park laws (resume-on-door-return vs resume-on-credit) no longer
  conflate; `credit()` resumes either (a topped-up member with a healthy door
  is deliverable). Balance-park sets `"balance"` (3.3's regression-keep:
  parks at the whole-second affordability floor, bills nothing while paused,
  resumes on credit, never killed — the watch-room receipts verbatim).

## Receipts

- Battery (box): **5/5 green** — PART A gap receipt (kept), 3.1 park with
  zero delta + ledger-identical + reason=door, 3.2 resume with exact
  no-backfill arithmetic, 3.3 credit-out regression (floor-adjusted
  expectation: whole-second affordability leaves a sub-second remainder —
  the over-fit `== 0.0000` assertion was the battery's bug, not the
  engine's), 3.4 the naive charger accrues during outage and 3.1's
  zero-delta assertion FAILS against it — the harness detects the class.
- Regressions (box): `test_voucher_escrow.py` 16/16, `test_x402_meter.py`
  45/45 (Session consumers untouched in behavior — positional `burn` calls
  ride the default), AV-1 serve-bridge battery 5/5. Rust untouched (17/17
  standing).
- CI: the battery joins its siblings in `tests.yml`; CI arbitrates on push.

## Standing notes

- **No production deployment** (founder order): the law is repo-side. When a
  deploy is ruled, the burn sites (the watch-door lineage / serve callers)
  pass live door health — the seam is one parameter.
- The spec's closing beat is now satisfied: the invariant (adapter
  availability pause law) is proven live AND enforced at the engine seam;
  the CONTRACTS-side ruling (contracts/vending §x402 wording) can proceed on
  this evidence whenever the spec owner rules it.
- P0 queue complete: AV-1, AV-2, AV-3 all RED→GREEN, CI-arbitrated. P1
  (AV-4 cross-rail disjointness/handle unlinkability, AV-5 reorg drill,
  AV-6 retry-storm, AV-11 human-gas audit) is next per the founder's
  roll-forward.
