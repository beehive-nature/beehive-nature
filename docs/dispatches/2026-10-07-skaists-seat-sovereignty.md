# 2026-10-07 — Skaists Seat Sovereignty: the bridge lane canonized

zCode seat, branch `zcode/skaists-seat-sovereignty-2026-10-07`, worktree
`wt-zcode-seatlaw`, base `c4b1b2b2d` (origin/main at lane open; local
shared-checkout main is 47 commits stale and was not touched — the
worktree law). Founder order: the lane-opening message of 2026-10-07,
which is the ruling and is quoted verbatim in the spec.

## What the lane lands

**SPEC-SKAISTS-SEAT-SOVEREIGNTY-1** — the canon:

- **The invariant:** one living human → one active Skaists seat → one
  canonical energy type → one governance constituency.
- **Skaists Seat Sovereignty (founder ruling, verbatim):** at every
  governance epoch, no natural human may control more than one active
  membership seat, every active seat must resolve to exactly one
  eligible living human and exactly one of the five constitutional
  energy types, and no verifier needs access to that human's
  underlying biometric or civil identity to establish eligibility.
- **The five proofs:** UNIQUE / LIVE+authorized / SEAT / ENERGY_TYPE ∈
  {1..5} / CURRENT_EPOCH — the minimum predicate set the public chain
  ever sees.
- **The arithmetic law:** 7,776 = 6⁵ = 2⁵·3⁵ carries no factor five;
  equal integer fifths do not exist (exhausted 0..7,776 in CI). The
  tightest packing {1556,1555,1555,1555,1555} is recorded and NOT
  constitutional. Membership population is a measured variable;
  governance weight is exactly 1/5 per constituency, CONSTANT in
  population; population-weighted governance is a DIFFERENT
  constitution; no float ever represents constitutional weight
  (3 × (1/5) ≠ 0.6 — convicted in CI).
- **The pipeline:** COMMIT owns the private-evidence boundary · PROVE
  emits only the five predicates · COMPRESS folds members into
  fixed-weight results · SETTLE ultimately drives an Antelope/Vaulta
  multisig or whatever successor exists centuries later (named, not
  claimed).
- **Honesty table (§deployment-status):** what exists is the MODEL and
  its battery; live proofs, hiding commitments, and SETTLE are NOT
  BUILT and carry UNVERIFIED. The model's sha256 commitment is binding
  only — hiding is NOT claimed.

## The executable arm — SK001

`scripts/btungsten/sk001-seat.mjs` + `sk001.test.mjs`, riding the
existing CI glob (`node --test scripts/btungsten/*.test.mjs`) — zero
workflow edits. 10 rows, each printing its own 0→N count:

```
bT-SK001: cap derived 6^5 = 7776; factorization 2^5*3^5 carries no five; equal-fifth candidates exhausted 0 -> 7777, none equal
bT-SK001: nearest integer fifths recorded {1556,1555,1555,1555,1555}; constitutional weight stays the exact rational 1/5
bT-SK001: population vectors held at exactly 1/5 per constituency 0 -> 7; the population governor measured on 6 and deviated on 6
bT-SK001: double-seat refusals 0 -> 4 + 1 seat-taken; active seats 8 <-> 8 humans, bijection holds
bT-SK001: malformed energy types refused 0 -> 8; inclusive bounds 1 and 5 accepted
bT-SK001: five-predicate proofs 0 -> 2 (epoch 7 and the explicitly carried epoch 8), both frozen-shape; stale-epoch / not-live / vacant refusals 0 -> 4
bT-SK001: private-evidence byte-scans clean 0 -> 9; commitment bound and distinct across humans
bT-SK001: seats filled 0 -> 7776 of cap 7776; out-of-range and full-cap refusals 0 -> 2; one breath (release + successor) proven
bT-SK001: COMPRESS folded 7776 member votes into 5 exact tallies; verdict YES on constant 1/5 weights
bT-SK001: TEETH — population governor convicted (max 2000/7776 > 1/5 > min 1176/7776); float weight convicted (3*(1/5) !== 0.6)
```

Full glob (SK001 + WB001 + boundary + WB002): **40/40 green** on this
box, node 24.x, before commit. Siblings byte-untouched.

## The battery convicted its own module before it landed

Two bugs the first run caught — both fixed, both receipts:

1. **Buffer identity-comparison defeated the uniqueness index.** `Map`
   identity-compares Buffer keys, so two equal sha256 digests were
   distinct keys and a human's second seat was ADMITTED. Row 4 ran red
   on exactly the clause the law exists for. Fix: the byCommitment
   index keys on the digest hex.
2. **The BigInt wire form.** `JSON.stringify(proof)` throws on
   CURRENT_EPOCH — the byte-scan row must scan the wire a third party
   would actually receive; a thrown serializer would have scanned
   nothing while passing green. Fix: explicit bigint-replacer wire
   form.

A green row that has never failed once proves nothing (the WB001
boundary-repair lesson, held here again).

## Canon wiring

- `scripts/btungsten/README.md` — SK001 section (deployment battery,
  not a WB-sequence workbench; model-scale honesty; the two-bug
  genesis receipt).
- `SPEC-BTUNGSTEN-1 §precedents` — one bullet naming SK001 as the
  umbrella's first bounded deployment instance, axes 2/5/6 model
  scale. The umbrella's own sequence (WB003+ scale and century legs)
  is untouched.
- `SPEC-LOVERNMENT-DAO-1` — untouched; this spec extends its §genesis
  cap, never relitigates it.

## Not invented by this seat (reserved)

- The canonical 1..5 ↔ Human Design type-name mapping — founder
  declaration at the constituency beat.
- Any layer↔type mapping between the 6⁵ geometry's five layers and the
  five constituencies — named as a temptation, ruled nowhere,
  conflated nowhere.
- Epoch-transition mechanics for a live deployment (automatic carry vs
  explicit re-commit) — the model enforces the LAW per epoch; the
  deployment beat chooses the mechanics.

## Boundaries not crossed

Model receipts only — no circuit, chain, relay, or human subject was
run. No live proof was produced or claimed; the ZK lane (closed except
its tungsten 2+4) was cited as precedent, not reopened. No secrets, no
hex ≥48, no surfaces touched (no registration ritual due), no CI YAML
edited (the battery rides the existing globbed step). Hiding of the
placeholder commitment explicitly NOT claimed; crypto wording capped
at "binding placeholder / isolated by design."

HUMAN INTERACTION: NONE.

## NEXT OWNER

- CI green → merge this PR: this seat (no-stall law).
- The constituency beat (canonical type mapping, population
  measurement surfaces): founder declares; any seat executes.
- The commitment beat (hiding+binding scheme) and the live PROVE beat
  (fresh worktree per the standing zkreceipts law when it opens).
