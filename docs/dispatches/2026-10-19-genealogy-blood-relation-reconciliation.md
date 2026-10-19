# 2026-10-19 — blood-relation reconciliation: the verified count of unique deceased blood relatives in the staged tree

Founder calibration (2026-10-19, verified by him in-repo): the 11,041
generated research pages ≠ a verified count of unique deceased blood
relatives — the public set includes relatives AND associated people; the
809-person cohort is not the entire genealogy; staged pages are not
published IQ.wiki articles. Standing instruction alongside it: substantial
autonomous execution, verified receipts as baselines, unfinished
deliverables separated from closed investigations. This lane closes the
named classification gap.

## The answer

Script-derived from the committed public roster
(`remington-bloodline.json` at `ecbc6e8a9`, schema `skaists.lineage/2`),
blood rule = transitive closure of parent-child edges from the root;
spouse links (`couples`) confer no blood; parent-slot placeholders never
enter the closure. Counts only; no private-tier identities in the artifact.

| classification | count |
|---|---|
| public staged persons | **11,041** |
| blood relatives (closure) | 10,878 |
| — living (root + 2 redacted stubs) | 3 |
| — **deceased blood relatives** | **10,875** |
| — unique FS persons among them | **10,875** (0 duplicate local ids) |
| spouse-of-blood staged (in-law) | 160 |
| attested-overlay traditional figures (`ovl-`) | 3 |
| residual unexplained | **0** |

Sum: 10,878 + 160 + 3 + 0 = 11,041 (asserted, not prose). Era mix of the
10,875: 50 recorded / 2,645 colonial / 1,344 unrecorded / 2,509 medieval /
4,327 saga — the evidence-quality axis, carried below as an OPEN gap.

## Checks (all resolved, none forced)

- **The blood line is fully public.** Of 1,612 parent refs on blood
  persons not in the roster, the number that are real walk persons is 0
  (8 are literal `UNKNOWN` slots; the rest are unfetched stub ids in
  neither graph). No blood ancestry sits in the private tier; the 8,310
  private-staged persons are the in-law deep ancestry + 2 living, exactly
  as `staging-inventory.json` receipts.
- **Cohort cross-check (809 receipt):** walk-v4 closure byDepth 2–8 =
  4/8/16/32/60/112/203 — EXACT. Depth 9: 373 computed vs 374 receipt;
  total 808 vs 809. Residual = 1 person at depth 9: the 09-18 harvest's
  guided-spine completion carried one parent beyond the repaired walk-v4
  edges; the id-level cohort list is not committed at tip (records.json
  is record-keyed; cohort-8gen.json is a stale 503 partial;
  familysearch-ancestry-full.json is the pre-spine 501 state); the roster
  closure stages 372 at depth 9, all within the walk's 373. Explained,
  not forced to fit; the frozen 809 remains the receipt.
- **Living-in-range:** 2 raw walk living-flags inside depths 2–9 = the
  paternal grandparents (Don Ray Remington 1931–, Marilyn Lowry 1932–),
  both founder-attested deceased 2026-09-16 (roster `corrected.attested`)
  — hence the manifest's `redactedLiving: 0`. Consistent.

## Baselines carried as canon (founder-verified 2026-10-19; not re-verified)

1. 11,041 generated research pages, regenerated/committed to main
   2026-10-03 (22,082 files = 11,041 `.html`+`.json` pairs).
2. 697,382 added lines in the 2026-10-10 genealogy integration —
   predominantly generated page markup, not authored application code.
3. 19,351 walked = 11,041 public staged + 8,310 private staged
   (`staging-inventory.json`, sumCheck true; private = 8,308 off-bloodline
   in-law ancestry + 2 living off root line).
4. 809 persons / 13,249 unique records = the frozen 8-generation
   source-evidence cohort — not the entire genealogy.
5. Staged pages are first-party research pages, NOT published IQ.wiki
   articles.

## Separation: closed vs open (the standing instruction made concrete)

CLOSED (baselines, preserved): staging inventory; page generation; the
809/13,249 cohort freeze (records.json byte-frozen, order #29 verified);
order #29 CI 12/12 founder-verified.

OPEN (named, unfinished):
- **Biography completeness** — pages exist for all 11,041, but
  "complete, verified wiki biography" is a stronger bar; 8,180 of the
  10,875 deceased blood relatives are pre-recorded-era (4,327 saga /
  2,509 medieval / 1,344 unrecorded). Era mix is the honest quality axis.
- **IQ.wiki publication** — not begun; publication is a founder gesture.
- **Evidence acquisition** — frozen under the refusal (order #29 ledger:
  314 images in hand, frontier stopped, ANT gated).
- **Rights decisions** — open (rights-qualification gates).
- **Identity ruling (new, small):** whether the 3 attested-overlay
  traditional figures count as blood relatives is a founder
  identity-ruling class question; this reconciliation counts by the edge
  graph and names the boundary.

## Receipts

- `node scripts/blood-relation-reconciliation.mjs --roster … --walk …
  --out assets/profile-archive/lineage/blood-relation-reconciliation.json`
  (committed; `node --check` clean). Artifact: schema
  `skaists.blood-relation-reconciliation/1`, counts + method + checks
  only.
- Roster read from this seat's worktree checked out at `ecbc6e8a9`
  (= origin/main tip this wake); walk read read-only from the private
  tier; zero private identities written anywhere public.
- Zero FamilySearch requests, zero private-tier writes, no wallet, no
  spend, no upload.

NEXT OWNER: the founder holds the era/overlay identity ruling and any
IQ.wiki publication gesture; evidence-acquisition and ANT gates stay with
their order-29 owners (refusal founder-kept; zBlood behind ANT gates).
