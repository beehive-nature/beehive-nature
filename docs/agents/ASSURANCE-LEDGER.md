# ASSURANCE LEDGER — LAW → CODE → CI → DEPLOYED → SIGNAL WIRED → LIVE DRILL → RECEIPT

**Founder order (2026-09-16, verbatim):** *"Do not implement another
adversarial item. Reconcile P0/P1 from the matrix into deployable units…
Never promote a row based on CI alone… Produce no production changes unless
an already-ratified deployment gesture exists."*

**State (post-reconciliation, 2026-09-17):** both detectors reconciled on
the same tree; the four AV-11 findings recorded individually; the AV-4
deterministic/probabilistic distinction banked; Ceremony M results absorbed
from the landed receipt; Gesture D blocked (M did not close cleanly). P2
remains frozen.

**Row classes:** **A** repo-only · **B** deployed-dark (law in deployed
component; live signal/config not wired) · **C** live-wired (real producer
feeds real enforcement) · **D** operationally proven (live drill, receipted).
**CI green never promotes a row.**

## 1 · The payments instantiation (P0/P1)

| row | class | evidence chain |
|---|---|---|
| **AV-1** serve-bridge crash/concurrency/idempotency | **D** — Ceremony M live drill PASS | crash-after-durable-append → systemd restart → replay returns original chained event (hash `db5d9434…`); ledger delta exactly 1; [receipt](../dispatches/2026-09-16-ceremony-m-receipt.md) |
| **AV-2** quote TTL + single-use | **B** — live bar FAILED (STOP #1) | engine-proven on deployed-equal bytes; live compute-gate request at rate-age ~12min > TTL 300s SUCCEEDED — the gate→llama path does not traverse `rate_set_in_force`; wiring TTL onto the gate = founder architecture decision, named in the receipt. **TTL = 300s ratified-configurable** |
| **AV-3** split-brain parking | **B** — half-proven (STOP #2) | outage half live-proven (gate stopped → refused → ledger delta 0 → resumed); billing half UNPROVEN (no charge event in window; root cause not chased per stop law) |
| **AV-6a** `max_attempts` | **A** (door pre-production) | probe D: force 3 failing settles on one testnet leg → 4th refused loud |
| **AV-6b** `max_failure_charge` | **SPECIFIED ONLY** — future column; enforceable when trustworthy monetary failure-fee evidence exists (`gas_actual_wei` natural input); NEVER inferred from max_attempts |
| **AV-5** reorg boundary | **A** (door pre-prod; notifier unwired = the A2 half) | probe D: settle testnet leg → flag depth-2 → replay/release refused → resolve with new evidence |
| **AV-4** cross-rail join detector | **A as scan** | see §1a below for the deterministic/probabilistic distinction |
| **AV-7/AV-8** two-route / settle-UNKNOWN | **A** (ride the door) | probes D: door ceremony drills |
| **AV-11** human-gas surface audit | **C** — live, registered findings tracked; see §1b below for the four findings and the detector reconciliation |
| **AV-9/AV-10** | **specified** (P3) | — |

### 1a · AV-4 — deterministic identifier unlinkability vs probabilistic metadata correlation

The **deterministic** law (R4, enforced by `r4_audit.rs`): no byte-level
identifier (address, tx hash, plan id, payment key) may appear as a VALUE
in two or more rail stores. This is checkable exactly — the detector walks
emitted artifacts' JSON values and reports any cross-rail repetition. A
single violation is a join.

The **probabilistic** reality (not checkable exactly, not enforced): timing
correlation between transactions on different rails, amount-pattern
similarity, network-level observer inference. These are **unavoidable**
without timing-obfuscation infrastructure (which is out of scope). The
ledger records this distinction so no future row claims to have "solved"
metadata correlation by byte-level disjointness alone.

**Enforcement state:** the detector is repo-gated (`r4_audit.rs`, CI). It
has NOT been run against production journal/receipt stores (the door is
pre-production). Promotion to D requires a testnet multi-leg drill →
`r4_audit` over the resulting journal → zero joins receipted.

### 1b · AV-11 — the four registered findings and the detector reconciliation

**Provenance conflict (recorded, not resolved by choosing one):**

| detector | scope | live verdict |
|---|---|---|
| `r5-surface-audit.mjs` (earlier) | ASK-shaped patterns only: does the surface tell the human to acquire/manage/pay for native gas? | **0 hits / 113 surfaces** — no surface asks |
| `audit-human-gas.mjs` (later) | Broad human-facing gas vocabulary: any gas-related string visible to a human on a first-line rail | **4 registered findings** (all on wallet.html + one meter.py mirror) |

**Why they differ:** the R5 detector checks for the *violation* (asking);
the later detector tracks the *exposure* (any human-visible gas
vocabulary). Both are correct for their own definitions. The R5 verdict
("zero asks") is true; the later verdict ("four human-facing gas
presentations exist") is also true. Neither erases the other.

**Authoritative standing gate:** `audit-human-gas.mjs` — because it
distinguishes human-facing gas UX from RPC/code vocabulary (the R5
detector would miss a new surface that exposes gas without asking), has
known-bad and known-good fixtures, and maintains the registered-findings
ledger. The R5 detector remains as a second net for ask-shaped patterns.

**The four findings, individually:**

| # | source location | classification | remediation | state |
|---|---|---|---|---|
| 1 | `wallet.html:788` — "USDC · Base — tiny gas" label on the Base top-up card | FIRST_LINE — the human sees "tiny gas" as part of a rail label | R5 gas abstraction: sponsored send / paymaster / relayer — the human sends USDC and nothing else | **registered** |
| 2 | `wallet.html:706` — "Gas is estimated live before you confirm the broadcast" on the Arbitrum ANT flow | FIRST_LINE — a gas-estimate presentation on a human-facing rail | R5 gas abstraction on the Arbitrum ANT flow: sponsor the broadcast or fold gas into the quoted price | **registered** |
| 3 | `wallet.html:642` — "gas: reading…" in the send-panel status line | FIRST_LINE — a human-visible gas-read status line | same R5 abstraction; display price-inclusive totals only | **registered** |
| 4 | `wallet.html:4510` — `' · gas ' + … + ' gwei'` rendered via innerHTML in the EVM status | FIRST_LINE — gwei denomination exposed in human-facing text | gwei belongs in the adapter, never the panel | **registered** |

Plus a mirror: `scripts/buzz-meter/meter.py:705` (`voucher_view`) carries
finding 1's same text + remediation.

**CI discovery is not remediation.** These four are registered, tracked,
and visible — none is resolved. The audit **fails on new unregistered
findings** and on stale ledger entries (a resolved finding still in the
register). Resolution requires the actual R5 gas-abstraction work on each
rail, then re-classification.

## 2 · Ceremony state

**Ceremony M — EXECUTED 2026-09-16, STOPPED AT FAILURE** (per founder
law; [receipt](../dispatches/2026-09-16-ceremony-m-receipt.md)):
- **AV-1 → D** (full live proof, promoted)
- **AV-2 → B** (STOP #1: TTL wiring gap on the compute-gate path)
- **AV-3 → B** (STOP #2: billing-half observability gap)
- Pre-ceremony backup preserved; journal windows banked; no invisible
  fix-forward. Restart count: 3 (deploy, token wiring, drill crash-restart).

**Ceremony D — BLOCKED** (precondition "M closes cleanly" is unmet).
Requires: AV-2 re-drill (after the gate→TTL wiring architecture decision)
and/or AV-3 re-drill (after the billing observability answer), then M
closes, then D opens.

**Standing:** AV-11's `audit-human-gas.mjs` is a CI step; the R5 detector
remains as a second check.

## 3 · Ordered plan (current state)

1. ~~R5 audit wired into CI~~ — done (now joined by audit-human-gas.mjs)
2. ~~Ceremony M~~ — **executed, partially failed** (AV-1 D; AV-2/AV-3 B)
3. **Founder decision needed:** AV-2 gate→TTL wiring architecture; AV-3
   billing observability — then M re-drill to close
4. Ceremony D (Sepolia) — blocked until M closes
5. Later, separately ratified: door prod placement; max_attempts ops
   exposure; max_failure_charge design on evidence
6. P2 remains frozen until this ledger is reconciled post-M+D

## 4 · The pattern

`LAW → CODE → CI → DEPLOYED → SIGNAL WIRED → LIVE DRILL → RECEIPT` —
the failure mode it kills: confusing *designed* (law), *implemented*
(code+CI), and *proven under reality* (drill receipt). AV-1 is the one
row that has traveled the full chain. AV-2 and AV-3 are deployed but
their live signal wires are named gaps — exactly what class B is for.

## 5 · Landing

This reconciliation pass lands with: both detectors CI-wired, the four
AV-11 findings individually recorded with registered/remediation/resolved
states, the AV-4 distinction banked, the provenance conflict documented,
and the Ceremony M results absorbed. P2 frozen. Workerb rolls forward on
the named founder decisions.
