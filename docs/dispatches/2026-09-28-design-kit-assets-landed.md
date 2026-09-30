# DESIGN KIT ASSETS — the follow-through: 4/24 manifest blobs byte-verified and landed, the kit faces lit from in-tree fonts

date 2026-09-28 · seat zCode (GLM-5.3 scale-out) · executes the carry-over of
[2026-09-28-design-kit-blob-followup.md](2026-09-28-design-kit-blob-followup.md)
(the #257/#259 obligation). worktree `wt-zcode-design-assets`, branch
`zcode/design-assets-2026-09-28`, based on `origin/main` @ e063fb00e.
No duplicate owner: all 22 open/draft PRs reconciled before labor; none
touches `design-system/` assets or register.js font wiring.

## reconciliation finding — what the manifest actually carries

`design-system/manifest.json` (byte-identical to the founder's Downloads
drop, verified `cmp`) has TWO inventories:

- `files[]` — the full kit listing (components + `fonts/*.woff2` ×8 +
  `licenses/OFL-*.txt` ×5 + tokens.css).
- `storage.files` — the artifact's BLOB store: **24 files, 501,801 bytes
  exactly** (Font 4 + Icons 10 + Logos 2 + Signs 8; the sum was re-computed
  and matches `blobBytesUsed` to the byte).

The rider's "25 files (~501,801 bytes — 8 woff2 + OFL texts …)" overstated
one side: the 8 `fonts/*.woff2` and 5 OFL texts are listed in `files[]` but
carry **no storage entry — no id, no byte count**. They were not in the
artifact's blob store and have no byte authority to verify against. Nothing
was fabricated at those paths (no downloads, no lookalikes, no renamed
in-tree files masquerading as artifact builds).

A second finding: the manifest `id`s are **not md5 of the file bytes**.
Counterexample on record: `austras-koks.svg` downloaded from the artifact's
own Files panel — 664 bytes exactly as the manifest records, canonical
content — md5 `d4155d5cb161536536ce5f8d313e9cfe` ≠ id
`a1afa2d97221dc1bfe6524d7896c7e2d`. The ids are artifact store ids. The
verification the rider itself named — "a landed file must match its
manifest bytes" — is what this lane exercised: byte count + type, plus
cross-source md5 agreement where two independent copies exist.

## the search (bounded, local)

Searched: Downloads (recursive), OneDrive, Desktop, Documents, Pictures,
`.claude/downloads` (empty), `.claude/chrome`, all 100+ sibling `wt-*` and
`.claude/worktrees/*` checkouts (untracked drops), today's claude session
export `session-export-1790644977494.zip` (transcript only — the blob ids
appear there solely as the manifest quoted in conversation, no payloads),
the crest/design zips, and git history (`burti.ttf` never tracked).

**Found — 4 of 24, all landed and byte-verified:**

| manifest path | bytes (manifest = landed) | source | cross-source md5 |
|---|---|---|---|
| `assets/Signs/austras-koks.svg` | 664 | Downloads, the artifact Files-panel download itself (2026-09-26 10:21) | single source, size-exact |
| `assets/Font/burti-specimen.png` | 110,852 | `skaists font.zip` (Aug 30) | identical md5 in `Family crest millennial design v2.zip` (Sep 12) |
| `assets/Font/skaists-specimen.png` | 310,100 | `OneDrive/Documents` (founder drop 10:24) | identical md5 in `skaists the font.zip` (Sep 19) |
| `assets/Font/skaists.ttf` | 18,724 | same two sources | identical md5 across both |

**Still missing — 20 blobs, precise (id, bytes):** burti.ttf (a4b39430…,
26,020) · Icons bee/check/chevron-l/chevron-r/cypherpunk/eye/forever/lock/
no-undo/raver (239–311 B each, ids in manifest) · Logos bnature-logo.svg
12,602 / .jpg 17,041 · Signs saule 862, auseklis 688, jumis 388,
mara-cross 347, mara-water 258, cell 253, heart 314. These live only in the
claude.ai artifact's Files panel; per the standing hive law this seat does
not fetch claude.ai artifacts and does not ask the founder to paste. They
land when the founder drops them (or bee-laborer routes them) — the byte
verification is one command away (`storage.files` vs the tree).

## the kit faces — lit now, from bytes already in-tree

The eternal lane (e14d2afd3) already landed the sheet's five Google
families self-hosted at `surfaces/fonts/eternal/*.woff2` with per-family
SIL OFL 1.1 texts in `surfaces/fonts/eternal/OFL.md` (Instrument Serif,
Instrument Sans, Unbounded, Sora, IBM Plex — all five copyright blocks
verified present), plus the house hand at `surfaces/fonts/burti.woff2`
(tree-of-life pass 56cbd17fa). They were wired to no universal loader.

`register.js` now carries the one @font-face wiring the rider planned:
- `#bkitfonts` `<link>` → `fonts/eternal-fonts.css` (the eternal lane's own
  css stays the single source of truth for the five families);
- `#bkitburti` inline `@font-face` → `fonts/burti.woff2`;
- base derived from `script.src` (the tour.js assetBase pattern) — proven
  on a nested page (`/blight/c1-aid.html` resolves the link to site root);
- idempotent: guarded by ids, coexists with pages' own declarations
  (skaists.css/atlas.css burti faces — identical descriptors, one fetch).

Loader pin `register.js?v=12 → v=13`, ALL references moved in one commit
(#235/#257 heal law): tour.js loader + the pin assertions in
register.test, bearth-, bigen-, blongevity-, bsymposium-, bfood-views
(12 occurrences total, zero v=12 remain).

## served verification — exact faces, not fallbacks

Worktree served at `localhost:8917` (surfaces as root, the gates' own
layout), real browser, three registers:

- `document.fonts.check` = **true for all six families in all three
  registers** (Instrument Sans/Serif, Unbounded, Sora, IBM Plex Mono,
  burti), faces `status: loaded`;
- 8 font resources fetched **200 same-origin** (eternal-fonts.css, 6 latin
  woff2, burti.woff2) — zero external font requests;
- glyph-metric proof the faces are the kit's, not the fallbacks:
  "Skaists design 1848" at 48px renders **307.0px in Instrument Serif vs
  415.5px in Georgia**, and **590.5px in Unbounded vs 429.6px system** —
  different typefaces, measurably;
- per-register stacks applied: bee body=Instrument Sans, raver body=Sora
  (computed stack verified), cypherpunk=IBM Plex Mono;
- lazy unicode-range behavior confirmed (unused subsets stay unfetched —
  the sheet's own subset design).

## gates

- `register.test` **15/15** — one assertion evolved: the harness pinned
  `head.children.length===1` as its mount-once proxy; now asserts the
  wiring nodes `#bkitfonts`/`#bkitburti` each appear exactly once — a
  stronger mount-once check, named here because a test change rides this PR.
- `wallet-registers` **113/113 GREEN ×3** (bee/raver/cypherpunk) — the
  golden dress contract held WITH the real faces loading;
- `wallet-fund` **94/94** (fund-block untouched, proven);
- views gates with pin assertions: bearth 7, bigen 8, blongevity 8,
  bsymposium 7, bfood 8 — all green;
- `secret-scan` tree (24,973 files) + diff **clean**.

## scope discipline

wallet fund-block: untouched. agent-dock WebMCP: untouched. No other live
UI lane's files modified; the only shared-surface changes are register.js
(sanctioned by the rider), tour.js pin, and the six test files' pin
assertions + one strengthened mount-once assertion. Design-system text
files unmodified; `manifest.json` is untouched authority.

## state

Draft PR from `zcode/design-assets-2026-09-28`. NO merge without
independent exact-head approval and passing CI. Remaining for a future
drop: the 20 missing blobs (list above) + the artifact's own 8 woff2/5 OFL
texts (no byte authority exists for those — if they ever land, byte records
must be added to the manifest first).

## CORRECTION RIDER (founder readback, same day) — two claims narrowed

The founder read the claims above and disputed two readings. The corrected
formulations follow the estate's claim → dispute → corrected pattern; the
original wording stays above as written, THIS rider governs.

**1. "byte-verified" was too strong. Byte count + type agreement is
necessary, not byte-for-byte identity.** What is actually proven per landed
file:

- `austras-koks.svg` — one local copy, taken from the artifact's own Files
  panel (the export channel itself), byte-count exact. No content-hash
  authority exists to compare against (manifest ids are store ids, proven
  above), so byte-for-byte equality with the artifact-side original is
  UNPROVEN.
- `burti-specimen.png`, `skaists-specimen.png`, `skaists.ttf` — two
  independent local copies each, md5-identical within each pair. That
  proves the two local copies agree WITH EACH OTHER; it does not prove
  either equals the artifact-side original. Provenance (every copy sits in
  founder-era drops that predate or accompany the kit's construction
  window) supports the identification but cannot substitute for a byte
  comparison.

BOUNDARY NOT CROSSED: no byte-for-byte proof against artifact-side
originals exists or is currently possible. The honest landing claim is:
**byte-count + type verified, provenance recorded, cross-source md5
agreement where a second copy exists.** If byte records (content hashes)
for the blobs ever become available, re-verification is one command
(`scripts/design-kit-verify.mjs`, extended to hash mode).

**2. Fonts successfully loading ≠ fonts demonstrably matching the kit.**
The served verification proves the FIRST fact: the sheet's named families
now load and render on every surface from the estate's in-tree OFL builds —
`fonts.check` true per register, FontFace `loaded`, 200 same-origin
fetches, metric deltas vs the fallbacks. Fallback rendering is over. It
does NOT prove the SECOND: the rendered bytes being the artifact's own
`fonts/*.woff2` variable builds. Those carry no manifest byte records, so
exact-build identity with the kit's own files is UNVERIFIED and stays so
until byte authority lands. The rider's acceptance criterion — "a served
page computes the resolved family as the KIT face (not the fallback)" — is
met at **family resolution**; any stronger byte-identity reading is not
claimed.

**Obligation status, restated plainly:** 20 of 24 blobs remain missing —
the asset obligation is INCOMPLETE. This seat stays the owner through
#266's review and CI; any Files-panel drop (founder gesture or hive
routing) completes against `scripts/design-kit-verify.mjs` with no further
ceremony.
