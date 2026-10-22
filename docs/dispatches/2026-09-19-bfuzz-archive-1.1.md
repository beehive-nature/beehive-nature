# 2026-09-19 · bFUzZ — Archive 1.1 (F1/F2/F3): relationshipPath hop arrays, onBloodline, duplicate-ref guard

Lane: GUX-01 zGeneArchive. Base: `lane/zcode-lineage-import` @ 97f18945 (verified
still the origin tip after fetch this session). Branch: `bfuzz/gux01-archive-graph`
from my worktree `REPOS/wt-bfuzz-gux01-archive`. This commit carries slice 1
(archive.mjs + archive.test.mjs, previously patch-pinned, uncommitted) plus the
1.1 fixes the fresh-eyes review adjudicated. Authorship per ruling 03174e6c,
applied as ordered by the helmsman (ZcODe5.3max, event 7f038591): executing seat
as author, provenance in trailers, no founder impersonation, no machine
Signed-off-by. Identity is the in-tree one from 50d56d60 (bGoose@agents.skaists.dev)
— named here so the founder can veto with one word.

## What changed (three cuts, one module, zero corpus writes)

### F1 — BLOCKING rendering bug: blood hop arrays malformed for collateral/downward paths

`relationshipPath(a,b).path` duplicated the common ancestor and DROPPED endpoint
b whenever apex != b (upward paths were already correct). Cause: the descent side
was built as `upChain(bId, apex).slice().reverse()` — upChain ENDS at apex, so
reversing re-emitted the apex and b itself was never appended. Fix in `bloodPath`:
descent side drops upChain's final entry and appends b explicitly, fully skipped
when b IS the apex. Verified shapes: sibling [a,apex,b]; cousin
[a,parent,apex,parent,b]; downward [a,child...,b]; upward [a,...,apex] unchanged.

### F2 — dead field + per-call recompute

`personPanel().onBloodline` was always null (comment promised a fill that never
existed). Now filled from a MEMOIZED `bloodlineSet()` (one compute per archive;
`inventory().counts.bloodlineParentward` and the exported `bloodlineSet()` share
the same memo). Corpus: APR and founder report true; the panel agrees with
`bloodlineSet().has(id)` for all 10,259 persons.

### F3 — duplicate provider refs resolved silently (last-wins)

Fallback refs-index build (no `model.refsIndex` in the model) overwrote
collisions: a ref on two persons resolved to whichever loaded last, and the
privacy gate stayed green. Now collisions are detected at load and the load FAILS
naming the offending refs (capped at 10). The same ref repeated on the SAME
person stays one identity (no throw). Not live on this corpus (10,253 refs ->
10,253 distinct ids) — guard is for future corpora.

## Evidence (run at the pin, this worktree)

- `node --test tools/genealogy/*.test.mjs` — **75/75 pass** (50 incumbent + 20
  slice-1 + 5 new 1.1 tests: F1 endpoint/no-dup/apex-once/via-monotonicity across
  up/down/sibling/cousin in BOTH directions + corpus Hadlock pair + fwd/rev
  mirror; F2 corpus full-population agreement + synthetic blood-vs-in-law; F3
  throw + same-person repeat). Duration 125s (the F2 full-population corpus walk
  is the cost; named, not hidden).
- Invariants harness `.scratch/gux01_invariants.mjs` (LoVis bee-laborer seat) —
  **12/12 synthetic PASS; fuzz 246 pairs x both directions x 6 buckets, 0
  violations; determinism holds; F2 probes now true/true; F3 probe now
  throws+named.**

## Two seam defects found IN THE HARNESS (fixed in-place, disclosed)

The harness initially failed everything on `I5.mirrorVia`. Both failures are
provably unsatisfiable-by-any-implementation defects in the CHECK, not the code:

1. Bookends: the old loop compared `path[0].via` (null by I3.rootVia) against
   `flip(path[len-1].via)` (labeled by I3.via) — `null === "parent"` is demanded
   and impossible. The mirror of "no incoming hop" is "no outgoing hop", which
   incoming-via labels never encode. Fixed: interior hops only.
2. Node-alignment: the old comparison indexed the reversed path at `len-1-i`,
   which at a shared apex compares the labels of two DIFFERENT edges (both
   climbs) and contradicts the harness's own I4.climb (apex must be via "parent"
   from both sides). Fixed: edge-aligned `len-i` — the same edge traversed
   opposite, label flipped. Siblings/cousins/diamond all pass after; I5 still
   bites (any asymmetry between fwd and rev edge sets fires it).

Both fixes carry in-file comments naming the seam, the author, and the date. The
harness remains the bee seat's attack tool; the corrections tighten it to what
it can actually verify.

## Boundaries held

- No engine (`blood-atlas.mjs`), person-panel, `blood.html`, `blood-nav.mjs`, or
  corpus bytes touched — zGeneUI/zGeneAtlas fences intact.
- No corpus writes; module stays read-only; no new schema.
- Review findings F4 (stagedUnparsable count), F5 notes (name index lowercase
  cache), F6 (freeze returned objects), F7 (relevance ranking) remain open
  hardening candidates — NOT in 1.1 scope, next owner: this seat unless
  reassigned.

## Next owners

- zGeneUI (ZcODe5.3max): `upPath` adapter whole-replacement against the landed
  `relationshipPath` (one-adapter law) — unblocked by this commit.
- bFUzZ (this seat): read-only adversarial pass on the helmsman's camera fix
  (createCore initial-transform freeze) the moment it is pushed — the night's
  co-creation seam.
