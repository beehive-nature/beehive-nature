# INVOICE-1 BUILDER — GREEN RETURN (2026-09-17)

## STATE

Synced at claim time: canonical oracle = economic/POS/wallet seat @`4c6a4593`
(branch `zcode/bpay-economic-frontier-2026-09-17`, unmerged — this builder
work is BASED ON that commit so the frozen battery is in-tree). Main has
advanced to `5d4d7569` (PR #95, the x402-door boot-deadlock repair, MERGED —
noted for the sleeping Gesture-D seat's return trigger; NOT acted on: this
mission's fences forbid touching Gesture D). All fences honored: zGenealogy
untouched (vendored reference + pins byte-exact, verified by the frozen
battery's own pin check), bpay-rail/R20 untouched, quote TTL policy observed,
IF-1..IF-4 untouched, VV-2 unopened, Jungle4 untouched.

## CLAIM

The three registered INVOICE-1 REDs are CLOSED on the generic side:
`scripts/lib/bpay-invoice-generic.mjs` (schema `bpay.invoice-generic/1`) +
`scripts/inv1-generic-builder.mjs` (9/9 proofs, CI-wired beside the frozen
battery). The frozen battery `scripts/inv1-bpay-invoice.mjs` runs BYTE-
UNCHANGED — exit 0, pins intact, its registered reds remain the record of the
REFERENCE's gaps. Nothing was weakened to obtain GREEN.

## EVIDENCE

`node scripts/inv1-generic-builder.mjs` → 9/9:
- **P1/P2** canonical bytes deterministic; semantically identical content
  (key-shuffled round-trip, two builds) → same identity.
- **P3** economically meaningful mutation (dropped quote) — and even a new
  issuedAt — changes the content identity.
- **INV-1.1-B** amount tampered WITHIN the ceiling refused; the committed
  attacker (tamper + content-digest recomputed so canonical integrity
  passes) still refused by the commitment law itself
  (`owed ≠ Σ carried quotes`); fabricated commitment digest refused; the
  quote set rides in the canonical bytes.
- **P4/P5** fresh-process child reloads the persisted artifact and validates
  it against its durable digest WHILE today's rates file is mutated
  underneath — the historical obligation is unchanged and no pricing state
  is consulted (VV-1 self-sufficiency, live).
- **INV-1.4-B** bare `void` refused; evidenced void validates; void→settled
  refused while evidence is carried; the stripped re-forge passes ONLY
  unanchored and is refused against `expectedDigest` (the which/who
  separation held honestly); LAWFUL supersession preserved (successor
  named, `priorDigest` lineage); settlement-from-issued works with
  `{receiptId, receiptDigest}` — never a bare id.
- **INV-1.5-B** wherever bytes differ the content identity differs; the
  job-bound id is kept BY CHARTER (additive) with content-addressing riding
  `identity.contentDigest` — the frozen probe's literal `!sameIdDiffBytes`
  clause encoded "the id is a content function," which the additive charter
  deliberately does NOT do; the law (different content ⇒ different identity)
  is proven on `contentDigest` and documented in the battery.
- **P7** job identity and content identity remain distinguishable (same
  `invoiceId` across versions, different `contentDigest`).
- **P8** R20/signature fence: the generic module contains no signing
  primitives (structural assertion); the frozen battery file runs whole
  beside this proof.

`node scripts/inv1-bpay-invoice.mjs` → exit 0 unchanged (4/7 green, 3
registered reds printed — the reference's record, preserved).

## BOUNDARY NOT CROSSED

The honest boundary is encoded, not hidden: content identity proves WHICH
invoice; a full re-forge is detectable ONLY against a durable digest anchor
(`expectedDigest`) or an authority signature — and signatures are NOT this
lane (R20 untouched, no signing code). The smallest durable commitment
representation = the carried quote set + Σ-derivation + commitment digest —
no upstream proof objects are embedded. No zGenealogy field was promoted
into generic law (their specifics ride in the opaque `domain` block).

## CHANGED

- `scripts/lib/bpay-invoice-generic.mjs` — NEW (the generic law).
- `scripts/inv1-generic-builder.mjs` — NEW (proof battery, CI-wired).
- `.github/workflows/tests.yml` — one step added after the frozen battery.
- `docs/agents/BPAY-ECONOMIC-LIFECYCLE.md` — additive "Builder closure"
  section under §INVOICE-1 (verdict table untouched).
- This receipt.
- NOT changed: the frozen battery, the vendored fixtures/pins, zGenealogy
  anything, bpay-rail/R20, meter/escrow, VV files, Jungle4, Gesture D.

## NEXT OWNER

The **economic/POS/wallet seat** — independent verification of this GREEN
against the frozen oracle (re-apply the three charters to
`scripts/lib/bpay-invoice-generic.mjs`; judge the INV-1.5-B re-reading of the
additive charter; then promote the LEDGER rows per the battery's stale law
ONLY in their doc if they rule the reference-side reds closed by successor
implementation). zGenealogy MAY adopt the generic module as a consumer
later, on its own lane.

## FOUNDER ACTION

None for the merge beyond ordinary review of this PR (stacks on the
economic seat's unmerged branch — merge order: theirs first or this PR
retargeted; content is conflict-free). The word, when convenient: whether
the economic seat promotes INV-1.1/1.4/1.5 rows upon their verification, or
keeps them registered as the reference's permanent record with the generic
closure noted beside.
