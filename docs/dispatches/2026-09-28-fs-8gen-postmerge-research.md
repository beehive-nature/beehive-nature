# FS 8-gen post-merge research — rulings banked, image lane reconciled + access-probed, relationship audit v1 landed

**Founder dispositions (2026-09-28, after independently verifying merge
`140d5e802`):** harvest CLOSED AND FROZEN — no seventh scrape, no repeat
merge ceremony. Two distinctions stand: (1) **809 people represented in
the harvested tree does not establish 809 proven biological
relationships** — the evidence needs relationship-by-relationship
assessment; (2) **"8 PASS + 1 TRIAGED" preserves the battery's reported
result and is not an unrestricted privacy guarantee.** And the closing
"say the word" pattern is retired: this session reconciles checkpoints,
probes gates itself, and continues authorized research — access trouble
blocks only the work needing that access. ANT stays "later": spending
and wallet signing untouched.

## Image lane — checkpoint reconciled, gate probed, blocked by access only

- **Checkpoint on disk intact and untouched since 09-19 12:31**
  (`C:/Users/travi/family-lineage/images-harvest/`): 6 census images
  (~1.58MB), `images-manifest.json`, mapping-walker checkpoint
  `record-image-map-partial.json` (175/807 persons, 4,654 mappings),
  join + premapped-arks + plan-inventory. Resumable as-is.
- **Session probe (the walkers' own wire):**
  `GET /service/tree/tree-data/v8/person/L627-FH9/details` with
  credentials → **401 — the founder's FS session is not alive** (same
  verdict shape as the 09-19 probe). The image sweep and mapping-walker
  continuation wait on the founder signing in; nothing else waits.

## Relationship-by-relationship audit v1 — the founder's first distinction, quantified

New tool `tools/genealogy/relationship-audit.mjs` (+5-test suite,
synthetic fixtures only) grades every parent-child LINK of the 809-person
cohort **on held evidence only** (public corpus + sources index + deduped
records; no new FS access). Artifact:
`assets/profile-archive/lineage/sources/relationship-audit.json`
(`skaists.relationship-audit/1`).

**935 edges graded** (3 living-skipped, 6 missing endpoints, 6,986
out-of-scope non-cohort edges excluded):

| class | n | what it honestly is |
|---|---|---|
| link-record | 78 | one record names BOTH parties (census household co-occurrence, death cert naming parent, parent's entry for the child) — strongest held; still co-occurrence, not a named-as-parent verdict unless the record says so |
| both-sourced | 682 | both persons independently sourced; the LINK itself rests on tree assertion between them |
| child-sourced | 157 | child sourced, parent side not (113 of these at depth 9 = parents beyond the harvested cohort — the boundary effect, named not hidden) |
| parent-sourced | 8 | parent sourced, child side not |
| neither-sourced | 10 | walked assertion only — the honest floor, sitting exactly on the colonial/medieval frontier (De Sellarie, Rankin, Few, Evans lines, depths 8–9) |
| tradition | 0 among cohort-child edges | overlay/saga endpoints grade `tradition` by class (tested); the cohort's own link set contained none this run |

**Method (disclosed in the artifact):** attached-source lists primary;
person-support fallback = the corpus support axis, which FOLDS the
search-evidence layer (search evidence is NOT attached sources — Don Ray
and Marilyn carry 0 attached FS sources; their person-support rides the
search layer). Name matching = full normalized containment OR
(first-given + all surnames) token presence — conservative.

**Boundary not crossed:** this audit grades evidence held; it upgrades
no support axis, invents no geometry, and claims no biological
relationships. Under the founder's NPE baseline prior (1.5%/gen
documented-line, DNA overrides per-link), the concentration of
`neither-sourced`/`child-sourced` at depths 8–9 is where per-link
assessment and any DNA attention should start — inventory, not verdicts.

**Next named (no order awaited):** per-edge assessment view in
blood.html reading this artifact; optionally re-run against the private
raw tier (adds affectedConclusionTypes per source — which claims each
source actually supports).

## Receipts

- audit run at main-equivalent tree (rider branch `zcode/dispatch-8gen-order6`):
  935 edges, counts above; tests 5/5; genealogy suites re-run per-file green
  (CI's globbed form; the directory-form `node --test tools/genealogy/`
  failure is Node executing the directory — not a suite failure).
