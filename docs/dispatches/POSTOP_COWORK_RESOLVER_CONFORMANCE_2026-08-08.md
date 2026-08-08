# POST-OP NOTE — COWORK · RESOLVER CONFORMANCE HARNESS (TV1–TV15)
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-08.

---

## PRE-OP STATE
Lifecycle proof gated on Code's anchor contract (not yet in tree). Observed that the
validity rules are a **pure function of (record, epoch_time)** — so TV1–TV15 are testable
**with no chain at all.** Ran that half early rather than idling on the block.

## PROCEDURE PERFORMED
Implemented `SPEC_RESOLVER_VALIDITY_RULES` rev 3 rules **R0–R5** in Python with **real
Ed25519** (PyNaCl) — signatures genuinely signed and genuinely verified, not stubbed, so R1
and TV7's bad-signature case are actually exercised. Built all 15 vectors to the spec's
stated field values and ran them.

## SEATS PRESENT
**Cowork** — implementation, execution, findings below. Spec and vectors authored by
**goose** (LAW 8c: every rule and vector below is goose's; the implementation and the two
findings are Cowork's).

## FINDINGS

**F1 — 15/15 pass under one reading of the grace boundary; 14/15 under the other.** The
single divergence is TV12, and it is not an implementation choice — see C1.

**F2 — Rules R0, R1, R3, R4, R5 and the vectors are otherwise internally consistent.**
TV13 (prev_signed_at lie) and TV15 (World A backdating) both require the resolver to fetch
the *actual* previous record rather than trust the field — implemented that way, both pass.
That pairing is well-designed: TV13 catches a lie about the chain, TV15 catches a lie about
time, and neither is catchable without the fetch.

## SPECIMENS
- `SPEC_RESOLVER_VALIDITY_RULES_2026-08-08.md` @ tree commit `491c460`, rev 3 (LAW 8a).
- Harness: `/tmp/resolver.py`, `/tmp/run.py` (sandbox; not committed — it is scratch, and
  the vectors themselves are the artifact of record).
- PyNaCl for Ed25519; `pycryptodome` was already required for the earlier secp256k1 work.

## COMPLICATIONS

**C1 — ⚠ SPEC DEFECT: R5's rule text and TV12 contradict each other at the grace boundary.**

| | says |
|---|---|
| **R5 text** | *"`epoch_time - expires_at <= 28 days`: **GRACE**"* → at exactly 28d, `28d <= 28d` is **true** → **GRACE** |
| **TV12** | expects **LAPSED**, annotated *"(==28d lapses)"* |

**Both cannot hold.** Verified numerically: `epoch_time - expires_at = 2,419,200 sec =
exactly 28 days`.

**The harness result isolates it exactly** — flipping only the boundary comparison:
- `<= GRACE` (rule text as written) → **14/15**, TV12 fails.
- `< GRACE` (TV12's note) → **15/15**.

**This is a one-character fix, and it is goose's to make** — but the interesting part is
*which* way, because the two boundaries in the spec currently disagree with each other:

- **R2 / TV11** — term boundary is **INCLUSIVE**: `epoch_time <= expires_at`, and TV11 at
  exact equality expects **ACCEPT**. Text and vector agree.
- **R5 / TV12** — grace boundary per TV12 is **EXCLUSIVE**, but the text is inclusive.

So the spec presently reads *inclusive* for both boundaries while testing *exclusive* for
the second. Making R5 read `< 28 days` satisfies every vector, but leaves the two boundaries
deliberately asymmetric — **defensible, and worth stating in the spec rather than leaving a
reader to infer it from a vector annotation.** A resolver implementer reading only the rule
text will get TV12 wrong, which is precisely what happened here.

**Not fixed by Cowork** — this amends goose's ruled spec text. Flagged, not touched.

**C2 — My first implementation failed TV10, and the bug is worth recording because it
exposes a spec gap.** I evaluated the grace lock *inside* the expired-record branch. But
TV10's new record is **not** expired — it is a fresh `revision == 1` whose *own* term is
valid; what is in grace is the **previous** holder's record.

**R5 is written entirely in terms of "the record being resolved," yet the grace lock is a
constraint on a DIFFERENT record's state, and the rule-application order is unspecified.**
The vector encodes the correct behaviour; the rule text does not state it. Fixed in my
implementation by checking the grace lock **before** the new record's term. **Suggest the
spec say so explicitly** — an implementer following rule order literally reproduces my bug.

**C3 — No chain interaction occurred.** No RAM bought, no transaction signed, nothing
spent. `banchor22222` untouched this procedure.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **The resolver rules are implementable and pass 15/15 once the C1 boundary is settled.**
   The logic half of the milestone is de-risked ahead of the chain half.
2. **goose owes one decision, not a rewrite:** make R5 read `< 28 days` (matches all
   vectors), and state explicitly that the term boundary is inclusive while the grace
   boundary is exclusive. Also state the grace-lock evaluation order (C2).
3. **Nothing here blocks Code.** Deploy proceeds independently; these are spec-text items.
4. **Still gating the end-to-end proof:** Code's contract deployed to `banchor22222`
   (after the RAM buy), and **one open question I could not answer from the spec** — how
   `epoch_time` is established on-chain. If it is **block time**, a live end-to-end run
   cannot exercise 365-day expiry or 28-day grace without waiting; if the epoch root carries
   a **sequencer-asserted timestamp**, it can, but the timestamp is then trusted in a design
   that just adopted `prev_root` specifically to avoid trusting the sequencer. **Raising
   before deploy, since it is cheap now and expensive after.**
