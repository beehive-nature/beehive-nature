# 2026-10-20 — issue #477 repair: the state binds the index — metadata is authenticated

Issue #477 (founder-filed): the reader's `publication-index.json` was not
independently authenticated — a substituted index keeping the binding
claim and page digests intact could forge names, FamilySearch refs,
record ARKs and relationships beside a VERIFIED badge. `gp resolve` had
the same exposure (index-sourced metadata). This lane closes it with an
acyclic trusted chain, identical acceptance rules in Rust and browser,
and the required negative controls. No content was reopened; no page
rewritten; #475 and order #29 stay closed.

## The chain (acyclic, per the issue's requirement)

`pin (sha256 of state, out-of-band) → state bytes → state.indexSha256 →
index bytes → per-person page digests → page bytes`. The index's old
`stateSha256` self-claim is REMOVED (schema /2 both artifacts) — it was a
claim anyone could copy. The state is built AFTER the index and seals its
digest; nothing hashes itself. Metadata displayed beside VERIFIED is now
authenticated transitively by the same pinned root; CONSISTENCY ONLY
stays a separate, visibly-untrusted mode.

## What refuses now (named, both implementations)

- `index-not-state-bound` — sha256(index bytes) ≠ state.indexSha256.
  This is the issue's minimal adversarial case: forged name/fsRefs/arks
  with intact page digests and intact state hashes differently and
  refuses BEFORE any index field is read.
- `person-id-rejected` — ids are `[A-Za-z0-9._-]`, never a path; the id
  reaches a path join in Rust and a fetch path in the browser, so its
  shape is checked first (issue: traversal tested separately).
- `locator-escape` — a person's entry must point at its OWN
  `persons/<id>.html|json`; anything else refuses, so resolution targets
  cannot escape the rail base even from a self-consistent malicious
  state+index pair (possible only unpinned — the pin remains the real
  boundary; the guard is defense in depth, tested separately).

## Evidence

- Rust `cargo test -p genealogy-publication`: **12/12** — the prior
  eight plus `resolve_forged_index_metadata_fails_closed` (the issue's
  exact substitution), `resolve_wrong_index_digest_binding_fails_closed`,
  `resolve_locator_escape_refuses_even_when_state_bound` (malicious index
  re-bound into the state), `resolve_rejects_path_shaped_person_ids`.
- Real corpus: rebound under /2 (state binds `ec73ca14…`; index carries
  no self-claim; binding recomputed true); `gp check` green; the issue's
  substitution executed at real scale — forging `p3d44ccaffd`'s name and
  refs refused with `index not bound by the state: the state binds
  ec73ca14…, this index hashes 6f9c040d…`; restored; green. Determinism
  preserved (rebind byte-identical). **New seal pin: `d7492716…`** (the
  /2 rebind; supersedes `d8666b9c…` for the /1 artifacts).
- Browser e2e `e2e/blood-seal.test.mjs`: now **9 gates** — the prior six
  plus G (forged-metadata index → FAILED CLOSED `index-not-state-bound`,
  nothing rendered, card hidden), H (locator-escape pair → named refusal,
  with a server-side request tracker PROVING no request ever escaped the
  corpus paths), I (path-shaped person id → `person-id-rejected`).
- Unchanged-and-green: `register.test` 16/16; footer-audit ratchet
  0 worse / 0 better; all three generated-artifact checks; fmt clean.

## Honest boundaries

The pin remains the trust boundary; untrusted mode stays visibly
untrusted. Rails stay declarations (github-pages the one qualified).
No `.b` registration, no ANT spend, no IQ.wiki; the studio's content and
the frozen acquisition lanes untouched. The e2e's fixture corpus is
schema /2; the committed artifacts regenerated in this same commit.

Closes #477.
