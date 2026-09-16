# ASSURANCE LEDGER — LAW → CODE → CI → DEPLOYED → SIGNAL WIRED → LIVE DRILL → RECEIPT

**Founder order (2026-09-16, verbatim):** *"Do not implement another
adversarial item. Reconcile P0/P1 from the matrix into deployable units…
Never promote a row based on CI alone… Produce no production changes unless
an already-ratified deployment gesture exists. Output the smallest ordered
deployment plan and the exact live drill that would promote each row to D."*
**State:** this is the control surface. The AV matrix is absorbed here.
**Zero production changes made in this pass.** The ONE mechanical gesture
permitted and performed: the R5 audit is now a CI step (49/49 shape
guarded).

**Row classes:** **A** repo-only (nothing deployed consumes it) ·
**B** deployed-dark (deployed component contains the law; its live
signal/config isn't wired) · **C** live-wired (real producer feeds the real
enforcement path) · **D** operationally proven (controlled live drill,
receipted). **CI green never promotes a row.**

## 1 · The payments instantiation (P0/P1)

| row | class | producer → signal/evidence → enforcement → durable state → recovery → operational probe |
|---|---|---|
| **AV-1** serve-bridge crash/concurrency/idempotency | **D — promoted 2026-09-16, Ceremony M** ([receipt](../dispatches/2026-09-16-ceremony-m-receipt.md)): real serve, real admin rail (token wired from deployed-dark), real ledger — crash-after-durable-append → systemd restart → replay returns the ORIGINAL chained event, ledger delta exactly 1 | probe receipted ✓ (rc 52 + journal + replay event `hash db5d9434…`) |
| **AV-2** quote TTL + single-use | **D — promoted 2026-09-16, M-REPAIR** ([receipt](../dispatches/2026-09-16-m-repair-receipt.md)): the ONE shared freshness law (`rate_set_in_force`, TTL=300s) wired into the gate's admission boundary via the serve's `/v1/pricing/admit`; the three beats proven live through gate→llama (299s succeed, 300s refuse with byte-identical economic state, fresh re-mint succeed) | Named follow-up: the gate's null admission cache after a stale refusal needs a re-fetch-on-null (one-line fix, direction safe) |
| **AV-3** meter/door split-brain parking | **D — promoted 2026-09-16, M-REPAIR** ([receipt](../dispatches/2026-09-16-m-repair-receipt.md)): the identified seam (no production burn site was wired with `door_reachable`) changed bounded — the admin charge now probes the gate and PARKS on unreachable; three controls live (healthy charge lands, outage parks with zero mutation and byte-identical tail, recovery re-charges for delivered work only with no backfill) | — |
| **AV-6a** `max_attempts` (per-leg retry ceiling) | **A** (door pre-production) | producer: settle attempts → signal: `settle_attempts` count + `max_settle_attempts_per_leg` → enforcement: `Door::settle` loud refusal → state: journal `Reservation` → recovery: human gate or expiry release → **probe D:** on testnet door, force 3 failing settles on one leg → 4th refused loud, receipted |
| **AV-6b** `max_failure_charge` | **SPECIFIED ONLY — future column** (enforceable when trustworthy monetary failure-fee evidence exists; `gas_actual_wei` is the natural input; NEVER inferred from max_attempts) | — |
| **AV-5** reorg boundary | **A** (door pre-production; notifier unwired — the A2 half) | producer: chain watcher (future: reversibility crate → pollers) → signal: `Reorg{depth}` → enforcement: `flag_reorg` + refusal family → state: `ReorgFlagged` (prior evidence verbatim) → recovery: human-gated `resolve_reorg` with new evidence (upto-bounded) → **probe D:** settle a testnet leg → flag depth-2 → replay/release refused → resolve with new evidence → receipt shows history≠outcome preserved end-to-end |
| **AV-4** cross-rail join detector | **A as scan** (test is CI-shaped; production stores don't exist yet to scan) | producer: any multi-rail journal/receipt store → signal: value-level token joins → enforcement: audit fails → state: none (detector) → recovery: fix emission, re-run → **probe D:** run `r4_audit` against the door's TESTNET journal after a multi-leg drill → zero joins receipted (fixture arm already proves the detector fires) |
| **AV-7 / AV-8** two-route / settle-UNKNOWN | **A** (ride the door) | probes D: door ceremony drills — two-route compute-settles/storage-times-out fixture live; kill facilitator mid-settle → reconcile original proof, never re-blind |
| **AV-11** R5 census | **C** (surfaces ARE the live estate; census ran clean 113/113) → **D at first CI run** (now a 49/49-guarded standing step: every push re-censuses; the CI run URL is the receipt) | producer: surfaces fleet → signal: ask-shaped gas patterns → enforcement: CI failure → state: none → recovery: fix copy/flow or label fallback (`data-r5-fallback`) |
| **AV-9 / AV-10** | **specified** (P3; witness-retention founder question; ring-level substitution drill unlanded) | — |

## 2 · Ceremony grouping (no seven unrelated ceremonies)

**Ceremony M — one meter deployment** (promotes AV-1, AV-2, AV-3 together):
single box maintenance window — deploy the current engine code (serve
bridge + TTL/StaleRateSet), take the founder TTL ruling, re-mint quotes
under discipline, restart serve ONCE; then the three drills back-to-back
(kill-9 restart · stale-quote refusal · door-stop parking). One restart,
three receipts. Precondition: founder gestures already named by the AV-1/2
lanes (token + fresh rates) + the TTL ruling.

**Ceremony D — one door testnet deployment** (promotes AV-4/5/6a/7/8
together): the already-staged Sepolia smoke, extended into a scripted
drill pass — multi-leg settle → retry-storm refusal → reorg flag/resolve →
unknown-reconcile → r4 audit over the resulting journal. One deployment,
five receipts. Production placement of the door is a LATER, separately
ratified gesture (it has no ratified deployment today).

**Standing (no ceremony):** AV-11's CI step — live now.

## 3 · Smallest ordered plan

1. **Now (done this pass):** R5 audit wired into CI (the only zero-decision
   gesture). Ledger = control surface; AV consumption paused.
2. **Founder gesture 1 — Ceremony M** (meter window): restores the
   deployed engines to contain their laws, wires TTL, and takes the three
   D-receipts. Smallest human cost: one window + one TTL number.
3. **Founder gesture 2 — Ceremony D** (Sepolia drill pass): five D-receipts
   on the door family in one testnet session.
4. **Later, separately ratified:** door production placement; `max_attempts`
   config exposure to ops; `max_failure_charge` design once monetary
   failure-fee evidence exists (independent column, never inferred).
5. **Unblocked by M/D:** AV-9/AV-10 remain P3-specified; the reversibility
   crate → poller wiring (AV-5's A2 half) becomes worthwhile only with a
   production door to protect.

## 4 · The pattern, for reuse beyond payments

`LAW → CODE → CI → DEPLOYED → SIGNAL WIRED → LIVE DRILL → RECEIPT` —
with the four A/B/C/D classes as the honest vocabulary for where each row
actually stands. The failure mode it exists to kill: confusing *we designed
it* (law), *we implemented it* (code+CI), and *we proved it under reality*
(drill receipt). Applicable next to: **compute** (bMESHLLM readiness laws),
**storage** (Autonomi/Arweave adapter rails), and **zBlood preservation**
(preservation laws → verify-at-reality drills). Nothing here is built for
those lanes — this section names the pattern's scope, not a work order.

## 5 · Landing

AV-11 CI wiring (49/49 shape-guarded) + this ledger land together; the
adversarial-queue consumption log points here. **Workerb paused per founder
order — the next useful human decision is a deployment gesture, not an
architecture question.**
