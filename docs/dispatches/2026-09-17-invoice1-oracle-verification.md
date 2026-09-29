# INVOICE-1 ORACLE VERIFICATION (2026-09-17)

## STATE

Synced: PR #97 (head `zcode/invoice1-builder-2026-09-17`, base main) inspected
— vs the oracle pin `4c6a4593` it is EXACTLY five files (two new scripts, one
CI step, one additive doc section, the receipt); the frozen battery
`scripts/inv1-bpay-invoice.mjs` and both pinned fixtures are byte-identical to
the pin (verified by direct diff AND by the battery's own pin check). The
frozen battery runs byte-unchanged: exit 0, 4/7 green, 3 registered reds
printed — the reference's record preserved. The builder's battery also runs
green (exit 0). Verification ran in a DETACHED checkout of the remote PR head
(`2d615b63`); the oracle's probes are an INDEPENDENT script
(`scripts/inv1-oracle-verify.mjs`, banked here, NOT CI-wired while a finding
is open) with its own canonicalization implementation — nothing from the
builder's test file was accepted as evidence.

## CLAIM (verified)

INV-1.1 CLOSED (verified). INV-1.4 CLOSED (verified). INV-1.5 PARTIALLY
closed — ONE defect returned to the builder. GREEN is withheld on that
defect alone; no repair was made from the oracle seat.

## ORACLE RESULT — 12/13 attacks PASS, 1 returned

## ADVERSARIAL EVIDENCE

- **A1/A1b** independent canonicalization (written from the spec, not the
  module) reproduces the module's canonical bytes and contentDigest exactly.
- **A2** key-order: reversed keys at every level → same identity ✓.
- **A2q ✗ THE FINDING** — quote-array ORDER is identity-relevant:
  re-deriving identity over a line's reordered quote set yields a different
  digest (`sha256:2bc9904b…` vs `sha256:c4bae285…`) and the reordered
  artifact then FAILS validation as "tampered" — same economics, different
  identity. The document's own two digests DISAGREE about order semantics:
  `commitmentDigest` sorts quote hashes (SET semantics, matching the frozen
  reference's planDigest shape) while `canonicalBytes` preserves array order
  (SEQUENCE semantics). The founder's attack list named quote ordering first
  among the semantic-identity mutations. Charter verdict: INV-1.5's
  "semantically identical ⇒ same identity" holds for object-key order but
  NOT for quote-set order.
- **A3** dropped quote and new issuedAt both change identity ✓.
- **A4/A4b** committed attackers (tamper + recomputed digest) refused by the
  Σ-law at both depths — `owed ≠ Σ carried quotes`, and quote-amount
  substitution refused identically ✓.
- **A5** fresh-process child validates the persisted artifact against its
  durable digest with today's pricing CREATED THEN DELETED — the historical
  obligation provable with no pricing state at all ✓.
- **A6** void→settled state-flip refused; stripped reforge passes only
  unanchored and is refused against the anchor; lawful supersession
  (successor + priorDigest lineage) valid ✓.
- **A7** receiptDigest is reference-binding, never an authorization gate
  (presence-checks only; behaviorally confirmed by A6) ✓.
- **A8** no signing/key machinery ✓. **A9** no genealogy/Autonomi vocabulary
  in the law text; domain block opaque ✓. **A10** job identity routes and
  stays constant while content identity distinguishes versions ✓.

## LEDGER RULING

**Option A — immutable findings against the reference consumer.** The
registered RED rows describe what the zGenealogy reference actually failed
at pin time; they remain historically RED and are NOT promoted. Closure is
recorded as ANNOTATION, not row mutation: INV-1.1 CLOSED-BY-INVOICE-1
(oracle-verified), INV-1.4 CLOSED-BY-INVOICE-1 (oracle-verified), INV-1.5
CLOSED-BY-INVOICE-1 **PARTIAL** — quote-order set-semantics defect OPEN,
returned to the builder with this evidence. The frozen battery needs no
change (its rows are red against the reference and stay so).

## MERGE ORDER (clean ancestry — follow exactly)

1. **Oracle/economic branch first**: open and merge
   `zcode/bpay-economic-frontier-2026-09-17` (`4c6a4593`) → main as its own
   PR, so the oracle/spec lineage is explicit and independently reviewed.
2. **Then #97** (based on that pin): after (1) its diff vs main collapses to
   exactly the builder commit — merge as-is, no rebase needed. Do NOT merge
   #97 before (1): its base=main would carry the oracle content into main
   without the oracle's own PR ancestry.
3. **This verification PR** is stacked on the builder branch (base =
   `zcode/invoice1-builder-2026-09-17`); it merges last and auto-retargets
   to main when #97 lands.
4. The builder's A2q fix lands on the builder branch or a follow-up PR;
   the oracle re-verifies with `scripts/inv1-oracle-verify.mjs` (A2q flips
   to PASS), and only then may the verifier be CI-wired.

## BOUNDARY NOT CROSSED

No repair from the oracle seat (the finding is returned, not fixed); frozen
battery, fixtures, and pins untouched; zGenealogy, R20/bpay-rail, Gesture D,
IF-1..IF-4, VV-2, Jungle4, VOCAB-1, RECON-1 all untouched.

## NEXT OWNER

The **builder lane** — fix A2q: canonicalize quote sets by sort (the
charter-aligned direction: set semantics, matching planDigest/
commitmentDigest) or explicitly declare order meaningful and make the
commitment digest order-sensitive too; either resolves the inconsistency,
but sorting preserves the reference's proven semantics. Then return for
oracle re-verification (all 13 attacks).

## FOUNDER ACTION

Merge per the order above (oracle PR → #97 → verification PR). None beyond
ordinary review; the A2q fix is a normal builder return, not a founder gate.
