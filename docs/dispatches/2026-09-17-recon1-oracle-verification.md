# RECON-1 INDEPENDENT ORACLE VERIFICATION — the builder's primitive under attack

**Date:** 2026-09-17 · **Seat:** economic/oracle (verifier) · **Under test:** PR #107 @`648cb7b5`
**Discipline:** the builder's 23/23 was not accepted as evidence; the verifier
(`scripts/recon1-oracle-verify.mjs`) was written against the mission text and
the frozen oracle bytes only — the builder battery is never imported, the
frozen case table is re-extracted by this seat's own code, every adversarial
expectation is re-derived from the mission wording. No repair from this seat.

## STATE

**RECON-1 CURRENT GENERIC CAPABILITY = GREEN.** All 23 independent checks
pass on `scripts/lib/recon-reconcile.mjs`; the sabotage control convicts the
oracle seat's own seductive reconciler on 15 checks including all five named
seductions. Historical frozen REDs remain historical evidence (the frozen
battery still runs untouched, byte-identical).

## ORACLE RESULT

| gate | result |
|---|---|
| exact PR #107 diff | 4 files, 658 insertions, 0 deletions (lib + battery + CI step + dispatch) |
| frozen RECON-1 oracle byte identity | sha256 `db035b…95432` = pin @`72727c96` |
| VOCAB-1 + INVOICE-1 byte identity | byte-identical to `72727c96` (empty diff over script+doc+lib+3 batteries) |
| rail-native imports | none — the module's only import is `./bpay-invoice-generic.mjs` |
| payment/signing/network | none — no net/key/clock/env/fs tokens in the law text |
| frozen cases reproduced independently | 18/18 + persistence set, with the frozen inline reference cross-checked |
| adversarial lattice A1–A10 | all green |
| sabotage control | CONVICTED (15 fails; named seductions A2/A3/A6/A8/A9 all caught) |

## ADVERSARIAL EVIDENCE

- **A1 finality:** {garbage, none, undefined, "Terminal", "terminal ", 42}
  on value-bearing records all park at FINALITY-PENDING; a zero-value record
  under weird finality stays OPEN (nothing observed, nothing pending).
- **A2 class-upgrade:** nine dressings (instruction/authorization/attempt/
  expense wearing tx-receipt+terminal+full amount; self-reported; signed-
  artifact; novel class names "oracle-attested"/"notarized"; missing class)
  — all stay OPEN. Normalization never deepens evidence.
- **A3 duplicates:** three copies of one 4e14 movement count 4e14 (PARTIAL,
  not 1.2e15-credit); a duplicated half + a distinct half count exactly
  1.0e15 (SATISFIED, not 1.5e15-credit). Conclusion arithmetic — no
  internal coupling.
- **A4 ordering:** exhaustive 24 permutations of a mixed set → one result.
- **A5 restart:** fresh child processes under MUTATED then ABSENT pricing
  derive the identical conclusion and per-asset observed figures.
- **A6 void/supersession:** six weak-evidence shapes → VOID-SUPERSEDED
  (never a manufactured refund); as-reported/reorg → FINALITY-PENDING;
  terminal partial AND exact → REFUND-DUE; successor carried; zero
  resurrection anywhere in the matrix. A6b: an invoice whose own state
  claims settled, without observation records, derives no value-bearing
  conclusion — a state claim is not evidence.
- **A7 overpay:** excess under as-reported/reorg/unknown finality →
  FINALITY-PENDING; only terminal excess → OVERPAID-CREDIT-DUE; a
  duplicated excess txRef counts once.
- **Sabotage (the seat's own "helpful accountant")**: counts every
  amount-bearing record at face value, doubles duplicates, cross-nets all
  assets into one pot, treats every finality as final, manufactures void
  refunds, mints AUTHORIZED, stamps SURFACE_READY — convicted on all five
  named seductions plus ten more checks. Statically clean, so the
  conviction is purely behavioral — the verifier reads economics, not
  cosmetics.

## MULTI-ASSET RULING

Per-asset reconciliation is structurally enforced: asset-gated counting,
no implicit FX (an ANT movement can never reduce an ETH obligation — an
ETH-only invoice pays EVIDENCE-FOR-ANOTHER-OBLIGATION for ANT value, and
asset comparison is case-sensitive), no cross-netting. Ruled and pinned:
**one satisfied asset + one deficient asset is never SATISFIED**
(PARTIALLY-SATISFIED); **excess in one asset beside a deficiency in
another rolls up as OVERPAID-CREDIT-DUE** — lawful BECAUSE (and only
because) the result's per-asset basis exposes BOTH the excess and the
deficiency machine-readably and the credit-due humanAction surfaces the
return gesture; excess ANT is never netted against missing ETH. Any asset's
unfinalized observed value parks exact closure at FINALITY-PENDING.

## FINALITY RULING

**FINALITY-PENDING is the correct generic result for value-bearing records
with unrecognized finality.** The frozen vocabulary defines it as "value
observed but evidence/finality insufficient or contested" — exactly this
case; OPEN would deny the observation (manufacturing absence), and refusing
the record would discard it silently. The primitive fails closed there, is
case/whitespace-strict ("Terminal", "terminal " are not terminal), and
correctly does NOT park zero-value records (nothing observed ⇒ nothing
pending). This is stricter than the frozen inline reference on an untested
edge — in the conservative direction; the oracle seat confirms it as the
generic law.

## HUMAN-INTERACTION RULING

Interaction intent and surface availability are distinct, and the primitive
keeps them distinct: an authorization record — however dressed, even forged
as tx-receipt terminal evidence at the full amount — never closes an
obligation (OPEN), the conclusion vocabulary contains no affirmative
AUTHORIZED/APPROVED/CONFIRMED state for chat intent to mint (AWAITING-
AUTHORIZATION, the waiting state, is the lawful vocabulary), and surface
references make no readiness claim (no ready/live/available/route wording;
surface ids are not URLs). The seat's independent tree scan confirms **no
Review & Pay UI route exists today**, so the current lawful projection is
**AWAITING-AUTHORIZATION → SURFACE_MISSING → bPay / Invoice / Review & Pay**
(wallet/Trezor confirmation where applicable). SURFACE_READY may not be
claimed until the actual UI route exists AND is independently exercised —
the verifier encodes this tripwire: the day a Review & Pay route appears in
`surfaces/`, check A9c FAILS until a SURFACE_READY re-ruling with live
exercise lands.

## BOUNDARY NOT CROSSED

Frozen oracle, VOCAB-1, and INVOICE-1 byte-identical to `72727c96`; the
builder's files untouched by this seat (verifier + fixture + CI only); no
repair performed from the oracle seat — two failures found during the pass
were defects in this seat's own probes (A3 arithmetic miscomputed by the
oracle, A9b regex catching the lawful AWAITING-AUTHORIZATION), corrected in
the verifier, not in the primitive; no rail state machine imported, no
payment/signing/network anywhere in the lane.

## MERGE ORDER

1. **PR #107** (builder: primitive + proof battery) — first.
2. **This PR** (oracle verifier + seductive fixture + two CI steps),
   stacked on the builder branch — second; the verifier step and sabotage
   selftest go green on main only after both land.

## NEXT OWNER

The founder (merge decision), then the bPay/W@tch UI seat: build the
Review & Pay surface that AWAITING-AUTHORIZATION points at — its first
independent exercise flips A9c and forces the SURFACE_READY re-ruling.

## HUMAN INTERACTION

FOUNDER ACTION SURFACE: GitHub → PR #107 → merge, then this PR → merge.
No terminal action, no wallet gesture, no chat-approval substitute — the
first product gesture this lane enables remains
**bPay → Invoice → Review & Pay (wallet/Trezor)**, currently SURFACE_MISSING.
