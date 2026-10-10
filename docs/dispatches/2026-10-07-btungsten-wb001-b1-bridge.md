# 2026-10-07 — WB001 B1: the formal-wire bridge made executable

## CLOSEOUT VERIFICATION (founder order 2026-10-10 — verify, preserve, route, record, close)

**Verified at main `c44672b76`** (PR #387 tip; the B1 merge chain
`294d38fbf` → … → `c44672b76`):

- **The repaired wire model is retained.**
  `scripts/btungsten/wb001-cryptol/BTungstenWB001.cry` (renamed from
  `Intent.cry` in the successor lane's round 4 — Cryptol resolves
  module names to same-named files) still carries the true-stream
  rewrite: `byteAt` dispatch over the length-derived block offsets,
  `wire i = [ byteAt i k | k <- take`{MaxEnv} [0 ...] ]`,
  `envLenMatchesOffsets`, and the bridge counterexample story in the
  header (`bridgeIBase = False`, run 37692766559).
- **The bridge receipts are live on main's own runs.** Run
  `38079290787` (head `10c9f7872`, conclusion **success**), formal
  job, verbatim: `FORMAL-CHECK-SAMPLED bridgeIBase…bridgeNearB: PASS`
  (8/8) + `envLenMatchesOffsets: PASS` +
  `FORMAL-WIRE-ALIGNMENT: PASS — 8 pinned terms, exact prefix + zero
  tail + envLen, both legs re-derive every run`. The pin source is now
  `crates/btungsten-wb001/tests/wb001/pin.rs` (the Rust model became
  the model — successor lane, 2026-10-08).
- **wireInjective stays honestly NOT-PROVEN on the Cryptol leg** —
  same run, verbatim: `FORMAL-PROVE-UNIVERSAL wireInjective: NOT-PROVEN
  (memory — RTS exhausted the 6291456 KiB cap, rc=251; recorded,
  never success)`, with `wireIndexDef` and `wireZeroTail` in the same
  state and the decomposed lemmas PROVEN (`validImpliesBounded`,
  `offsetsOrdered`, `zeroTailAtPosition`, all Q.E.D.). **The beat-3
  Q.E.D. remains explicitly invalidated for the deployed encoding** —
  it was a proof about the pre-B1 padded lookalike and is never cited
  as the deployed-wire proof (canon: README artifact row + §result-
  classes corrected-theorem history; the 10-08 founder review's
  zero-tail refutation, `8b2ac34ae`, extended the same discipline).
  The SAW-side `wireInjective` proof (`wb001-saw/injective.saw`,
  PROVEN 2026-10-08) is a SEPARATE result class, recorded separately,
  never as the Cryptol leg's.
- **Routing (founder order 2026-10-10):** universal injectivity on
  the Cryptol leg is OWNED by the active RB05 grammar-equivalence lane
  (`claude-LoVis/rb05-grammar-equivalence` — decode_core ==
  decodeSpec for every buffer and input length, PROVEN on its branch).
  No other seat proofings toward that obligation; recorded in the
  WB001 §next list to prevent duplicate work.

Session state: the zCode seat's SK001 lane (PR #353 + ratification
rider #355), the B1 repair (PR #358), and this closeout are all
merged; no locks, no open worktrees beyond the archived lane trees.
CLOSED and ARCHIVED 2026-10-10.

zCode seat, branch `zcode/btungsten-wb001-b1-2026-10-07`, worktree
`wt-zcode-seatlaw`, base `8046a4a86` (origin/main at lane open). The
finding is the founder's (review B1, relayed with the SK001 closeout
2026-10-07): **the Cryptol/runtime wire mismatch is unresolved — no
Cryptol wire byte had ever been compared to a runtime canonical()
byte, and the deployed-wire proof claim cannot close on prose.**

## The finding, reproduced first-hand

- `wb001-cryptol/Intent.cry` lines 477-482 (as merged): the BRIDGE
  block was a COMMENT — "pinned byte-for-byte by the shared vectors
  (both implementations reproduce them)" — with no `bridge` property
  anywhere in the module.
- `wb001-formal-check.sh` (as merged): TYPECHECK, the :check battery,
  and `:prove wireInjective` — not one comparison of a `wire` byte to
  a runtime byte.
- The shared vectors (`wb001-vectors.json`) are re-derived by the node
  battery ONLY. The claim "both implementations reproduce them" was
  true of zero implementations on the Cryptol side.

So the ladder's own "formal wire alignment" step (§ladder, founder
ruling 2026-10-07) had never run. `wireInjective` was proven
universally — about the model's wire. The claim that its meaningful
prefix is the deployed envelope rested on a comment.

## The repair — the bridge is now executable, from two sides

- **`wb001-bridge-gen.mjs`** — derives the bridge bytes FROM THE
  RUNTIME (`canonical()` on the 8 constructed terms: iBase, twinL,
  twinR, astral, fffd, combining, nearA, nearB — field values identical
  to the .cry closed terms), writes `wb001-bridge.json` (intent,
  envLen, envelopeHex per term), and emits the .cry constant block.
  Pinned bytes are runtime-derived, never hand-written.
- **`Intent.cry` — the BRIDGE block is now code:** one opaque constant
  per term (`biBase : [187][8] = 0x…` — PUBLIC-CONSTANT-marked, 187 B
  for iBase down to 190 B for nearB) and one obligation per term:
  `bridgeX = (wire X == bX # zero-tail) && (envLen X == literal)` —
  exact prefix, exact zero tail, exact length arithmetic. Tail widths
  are MaxEnv − envLen (4626 − 187 = 4439 etc.), spelled so the
  concatenation forces the full padded-wire width.
- **The node leg — `wb001-bridge.test.mjs` (rides the CI glob):**
  re-derives every term's envelope from `canonical()` byte-for-byte
  against the JSON, asserts the .cry carries each envelope hex literal
  verbatim plus each typed declaration and property name (the two
  artifacts cannot silently diverge even though cryptol runs only in
  the formal job), re-validates every JSON field through the runtime's
  own gates, and holds the twin/near pairs distinct. Green 2/2 with
  the count line `bT-WB001-bridge: runtime re-derive identical on 8
  terms; Intent.cry carries 8/8 envelope hex literals…`.
- **The formal leg — `wb001-formal-check.sh`:** eight new `:check`
  obligations (bridgeIBase…bridgeNearB) before the CHECK-SAMPLED class,
  and a new ladder-state line: `FORMAL-WIRE-ALIGNMENT: PASS — 8 pinned
  terms, exact prefix + zero tail + envLen, both legs re-derive every
  run (sampled agreement, never equivalence)`.

## Canon honesty repairs in the same beat

- README WB001 artifact row for `Intent.cry` said "STAGED — written,
  not run; UNVERIFIED" — stale since PR #352 landed the CI formal job
  (TYPECHECK PASS, wireInjective PROVEN Q.E.D.). Now reads the truth,
  including the B1 repair.
- §ladder reference-instance note now records that "formal wire
  alignment" is EXECUTED, and what B1 was.

## Result-class honesty (unchanged, restated)

The bridge is SAMPLED AGREEMENT on 8 pinned terms — exact bytes, but
8 terms. It is not EQUIVALENCE, and EQUIVALENCE stays NOT ATTEMPTED;
`:check` on closed terms is exact evaluation within CHECK-SAMPLED's
mechanism but the bridge class is named for what it is. PROVE-
UNIVERSAL's status is untouched. The deployed-wire proof claim now
closes on receipts: the universal proof covers the model's wire, and
the model's wire is pinned to the runtime's bytes by two independent
CI legs.

## Measured before commit (this box, node 24.x)

- `node --test scripts/btungsten/wb001-bridge.test.mjs` — 2/2.
- Full glob `node --test scripts/btungsten/*.test.mjs` — **52/52**
  (sk001 10 + wb001 10 + boundary 6 + bridge 2 + wb002 24), siblings
  byte-untouched.
- `sh -n wb001-formal-check.sh` — syntax OK.
- The .cry additions could NOT be cryptol-verified on this Windows
  box (cryptol runs in the CI formal job only): TYPECHECK and the
  eight bridge :checks are verified by this PR's own formal job —
  that run is the receipt, and a red there names its obligation.

## Boundaries not crossed

No claim that the runtime equals the model universally; no SAW; no
Rust twin; the vectors file and genesis battery untouched; no CI YAML
edits (runner-only); no secrets; the WB002 and SK001 lanes untouched.

HUMAN INTERACTION: NONE.

## Round 2 — the bridge convicted the pre-B1 wire (this is what B1 was)

Round 1 (commit `214f58f7c`) failed formal TYPECHECK: a bare hex
literal is a bit-vector of digit width, not a byte sequence — the
constants now ride the file's own `split (0x… : [8n])` idiom (commit
`2f018b090`, "Expected 178 / Inferred 1424" is the receipt).

Round 2 (run `37692766559`) TYPECHECKED and then returned
**Counterexample: `bridgeIBase = False`** — the bridge's first
evaluation, convicting exactly what founder review B1 named:

- the pre-B1 `wire` interleaved each field's FULL CAPACITY array
  inside the stream (`wireTlv t f = [t] # split f.len # f.bytes` —
  `f.bytes` is `[cap][8]`, not the meaningful prefix), so after each
  field's meaningful bytes the stream carried `(cap − len)` zeros
  BEFORE the next tag. The deployed envelope was NEVER the first
  envLen bytes of that wire — the header's claim was prose, and the
  interleaving made it structurally false.
- `wireInjective`'s universal Q.E.D. (z3, 23.7s, PR #352) was a real
  proof about that PADDED LOOKALIKE — correct mathematics about the
  wrong encoding; the receipt does not carry over. The result-class
  law applies to this too: the proof obligation is re-attempted on
  the repaired wire every run, and the run's verdict line is the
  live record (NOT-PROVEN on timeout is an honest state, never a
  wedge).

The repair (this round): `wire` REWRITTEN as the true variable-length
stream — `byteAt` dispatches each position to the field block that
owns it, every block offset DERIVED from the field lengths exactly as
the runtime concatenates (bDom..bPld), `blockByte` emits tag + 4 BE
length bytes + MEANINGFUL value bytes only, positions ≥ envLen are
0x00 by the final else, and `envLenMatchesOffsets` pins envLen to the
same chain as a sampled property. The pinned bridge constants, the
JSON, the generator, and the node leg are UNCHANGED — the runtime
never moved; the model was wrong, and only the model side changed.

## NEXT OWNER

- CI green (incl. the formal job's eight bridge checks) → merge: this
  seat (no-stall law).
- If the formal job reds on a bridge obligation: that is a REAL
  Cryptol/runtime wire mismatch surfaced — repair the .cry semantics
  (not the pinned bytes), record what the mismatch was.
