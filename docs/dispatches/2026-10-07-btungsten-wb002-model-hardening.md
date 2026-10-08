# 2026-10-07 — bTunGsTeN WB002 model-hardening beat: rollback fidelity + authenticated display (founder review of the merged landing)

zCode seat, branch `zcode/btungsten-wb002-hardening-2026-10-07`. Founder
ruling 2026-10-07 (review of the merged WB002 landing @`c4b1b2b2d`):
**accept #351 as the completed WB002 landing; the merge and existing
test results stand.** Before the JS model is used as the reference for
WASM equivalence, one focused model-hardening pass: rejected actions
retain state changes (R-1), and the adapter UI can accept an
unauthenticated checkpoint fragment or log extension (R-2). Close the
landing milestone, NOT the model-correctness claim. No founder action,
live deployment, or ZK coupling change required. After these repairs,
proceed with WASM-vs-model comparison and the separately classified
formal-proof work — the next equivalence result must compare WASM with
a model that preserves transaction atomicity and distinguishes
consensus evidence from merely self-consistent data.

## Boundary of the review evidence

The reviewer's bundle (`sandbox:/mnt/data/wb002_boundary_review_c4b1b2b2d.zip`)
is not reachable from this seat; per the ruling's own instruction ("the
executing seat should first reproduce them against the complete pinned
module"), both findings were reproduced from the review's written
counterexamples against the pinned module at `c4b1b2b2d`, red-first,
before any repair. The review's own boundary is preserved in kind: this
beat touched the JS workbench only — the frozen subtree is byte-untouched
(all three PROVENANCE sha256 pins re-verified against the working tree
this session; zero modifications under
`wb002-specimen/simpleassets-e6a042f/`).

## Red-first receipt (against the merged module, before the repair)

`node --test scripts/btungsten/wb002-hardening.test.mjs` on `c4b1b2b2d`:

- RED (6 failing cases, matching the review's tally):
  1. rejected return-to-lender transfer with a stranger's signature
     refused `bt-wb002:auth` BUT consumed the delegation record, emitted
     `delegateclose`, and flipped the sovereign — specimen profile.
  2. the same, bnr-adapter profile.
  3. partial batch (valid asset + nonexistent asset): refused
     `bt-wb002:not-found` with the first asset already moved and its
     event committed — specimen.
  4. the same, bnr-adapter.
  5. checkpoint-body substitution: a checkpoint whose ASSETS were
     rewritten while keeping its genuine root string passed
     `chainConsistent()` and the adapter's root comparison — displayed
     the forged owner (mallory) for a quiescent victim.
  6. unconfirmed log extension: a fabricated move appended after the
     genuine log with a fully correct hash link displayed mallory,
     though the chain never executed that transfer.
- GREEN (3 controls): a refusal that precedes any mutation changed
  nothing; honest full log displayed truth; honest checkpoint fragment
  displayed truth.

## Repairs (both landed, specimen policy untouched)

**R-1 — transactional atomicity.** Antelope specifies failed
transactions restore prior state; the 2021 C++ relies on that boundary,
and the port must reproduce it. `Chain` now wraps every public action in
`tx()`: a proxy at the constructor opens a transaction per external
action call; state tables, counters, AND committed event-log effects
roll back on any throw. Nested action calls (`delegate`→`transfer`,
`undelegate`→`transfer`, `issuef`→`transferf`) are internal method calls
that join the outer transaction — inline-action semantics. `tx()` is
public: a caller can bundle several actions into one atomic unit (the
multi-action transaction shape). Offer rows no longer carry
undefined-valued keys so snapshots and canonical fingerprints stay
byte-exact. `fingerprint()` serializes everything an action can touch
plus the log — the battery's preservation demand. The specimen's
authorctrl behavior is unchanged: rollback fidelity is not
modernization.

**R-2 — authenticated display.** Two obligations, both executable now:
(a) authenticate the checkpoint CONTENTS — `Chain.checkpointAnchor()`
returns `{seq, root, parentRoot}` and the AdapterUI RECOMPUTES the
checkpoint root from the event body over the trusted parent root; a
substituted body behind a genuine root string is DISPUTED. (b) bound
displayed state to an authenticated history — `Chain.tipAnchor()`
brackets a stream's end; `AdapterUI.display(id)` answers either
`authenticated-tip` (every link verified AND the stream's end matches
the trusted tip: current truth) or `checkpoint-scoped` (the truth as of
the authenticated checkpoint, at its explicit height) — an arbitrary,
possibly fabricated suffix is NEVER promoted to current ownership;
a root-only anchor fails closed. Links prove self-consistency, not
consensus acceptance — that distinction is now in code, not prose.

## Banked counts (local run 2026-10-07; CI's own lines are the ratchet)

- refusing seams proven rollback-whole (fingerprint-stable): 0 -> 20
- adapter hostile history: 242 continuity-checked steps, 45 wrong-signer
  probes refused, **240 refused transactions rolled back whole**,
  unexplained sovereignty changes 0
- specimen hostile history: 19 violations, all named (F-1 family), 151
  refused transactions rolled back whole
- wrong-signer matrix: 26 (specimen) + 27 (adapter) rows refused, each
  now riding a `tx()` bundle with the fingerprint demand; F-1 A/B
  convictions 3
- truth lattice: 4 injections, 2 specimen-UI confident lies, 3 adapter
  disputes, adapter wrong answers 0 — now under content authentication
- torture suite + millennium leg: all green (459 actions across
  simulated centuries, fold mismatches 0)
- suites: WB002 battery 14/14 + hardening 10/10; WB001 + boundary
  16/16 (untouched, re-run to confirm)

## Honest note

One bug in MY new assertion harness (a `Sov`/`sov` casing typo) briefly
produced false rollback failures during this beat; it was caught by
instrumenting the assertion to a per-key diff (which TypeError'd on the
undefined field), fixed before any commit, and never touched main. The
matrix fingerprint demand also needed rows wrapped in `tx()` bundles —
rows mix successful setup with a refusing tail, and per-action
atomicity alone does not make the ROW atomic.

## Boundary not crossed

- This beat is MODEL evidence only: the compiled 2021 wasm still has no
  execution here; the WASM-vs-model comparison is the next beat, now
  against a model that preserves transaction atomicity and separates
  consensus evidence from self-consistent data (the ruling's closing
  condition).
- The formal twins remain staged NOT-RUN (result-class law): no
  TYPECHECK/CHECK/PROVE/EQUIVALENCE claim is made.
- No surfaces, no tests.yml (the CI glob picks the new suite up), no
  ZK coupling change, no live deployment, no founder action.

## NEXT OWNER

- CI green on this PR → this seat merges (no-stall law).
- WASM-vs-model equivalence beat (README §next 1): run the vendored
  2021 wasm on a modern Antelope stack against the HARDENED model's
  verdicts.
- Cryptol/SAW container beat (shared with WB001 §next 1).

HUMAN INTERACTION: NONE.
