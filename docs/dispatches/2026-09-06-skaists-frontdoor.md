# skaists front door — three readings, one estate

Seat: Codex (Astra), lead. Lane: `codex/skaists-frontdoor-2026-09-06` in the
seat's separate `wt-astra-frontdoor` worktree. Founder brief: redesign
skaists.dev for scaling, with New bee, Raver and Cypherpunk on the same surface.
The founder's matriarch is the primary design reference: a lifelong graphic
artist who expects the clarity and familiarity she finds in Apple products.
This priority is carried into `docs/DESIGN-CONSTRAINTS.md` as rule 13, using
the founder's words and keeping it a design priority rather than an added
approval or credential gate.

## What changes for a visitor

New bee starts with three ordinary links: explore art, make music, meet the
hive. A light canvas, larger type and controls, and short instructions make
these the primary choices. The complete directory is inside a native
“Explore everything” disclosure. Language is next to the site name; the
three reading buttons remain visible at the top. The older estate navigation
moves into an optional section at the bottom of this page instead of occupying
a permanent strip over the content.

Raver gives the actual FUNGi, FROGGi and PEPi artwork a large visual place and
uses more expressive language and spacing. Cypherpunk opens each row's exact
registry identity, repository path, home, page state and named limit, plus
the registry/generator/kernel/continuity links. These are presentations of
the same rows, never separate capability tiers.

The New bee design is a candidate for the matriarch's review, not a claim that
an automated check proves her experience. Her first useful acceptance task:
find an artwork she likes, enter the music studio, return home, and change
the view without help or fear of losing her place. Downstream tools retain
their existing interfaces in this lane; arriving at a simpler home does not
make their usability solved.

## Sources and boundaries

- `estate.json` remains the source of membership, counts, organisations,
  families and page states. `scripts/build-atlas.mjs` creates
  `surfaces/index.html`; `scripts/estate-check.mjs` derives the numbers from
  the tree. This candidate has 102 listed rows, 101 presented destinations,
  93 counted surfaces, eight families and three organisations. The unpresented
  frozen-renderer study remains excluded under its existing rule.
- Restored complete descriptions and existing language keys from the older
  `surfaces/estate.json` and `surfaces/lang-corpus.json`. Named caveats are
  rendered on the destination itself as well as in its evidence disclosure.
  `LIVE` is labelled “Published page,” explicitly describing publication,
  not a declaration that every tool is production-ready. Unspecified limits
  say that the registry does not specify them.
- The founder's band markup and CSS are still lifted byte for byte from
  `surfaces/doors/index.html`. The preservation assertion is executable.
- `surfaces/atlas-art/provenance.json` records Base chain 8453, block 50979954,
  the three collection contracts, selector paths and source/served hashes.
  These are artwork snapshots, not balances, appraisals or live chain reads.
  Their render path comes from the existing `surfaces/blight/gallery.html`.
  FROGGi's served SVG adds a reduced-motion rule and a non-rendering
  PUBLIC-CONSTANT provenance comment; its source and served hashes distinguish
  those edits. The secret scanner correctly refused its initially unmarked,
  contract-rendered hex content; the public-data marker resolves that refusal
  without bypassing the scanner. The files contain no scripts, event handlers,
  embedded foreign HTML or remote resource references.
- `surfaces/register.js`, `lang.js` and `tour.js` accept optional host elements
  on this page. Pages without those hosts keep their existing mounting path.
  The existing local reading/language preferences continue across pages and
  tabs. Script/corpus query versions are advanced. No account is needed to
  browse the directory, filter it or change its presentation.
- The former four promotional claims on the hub are removed from this
  presentation; the new introduction does not promise permanence, universal
  login, deletion guarantees or automatic tax behaviour. The underlying
  evidence and existing destination pages remain reachable.
- No OCI service, Caddy configuration, wallet, chain transaction, laptop node
  or production secret was changed by this lane. The observed publishing
  route is the existing GitHub Pages `main:/` source with CNAME `skaists.dev`.
  No additional hosting provider, runtime or application dependency is added.

## Verification and review handoff

`node scripts/build-atlas.mjs`, `node scripts/estate-check.mjs`, JavaScript
syntax checks and `node --test e2e/atlas.test.mjs` pass locally. The 11 new
tests cover literal multiword and multilingual search, family isolation,
complete static destinations, visible caveats, the canonical registry,
founder-art preservation, native disclosure, the three invitations, and
SVG provenance/content. The new suite runs in the existing static CI job.
The normal corpus and browser CI remain required; their result belongs to
the exact candidate commit, not to this prose.

No screenshots, browser interaction, viewport measurement or manual visual
QA were performed in this lane: the applied Sites building skill restricts
those to an explicit browser-testing request. This is a named verification
limit, not evidence that the design passes those checks. The local preview
is served only on loopback at `http://127.0.0.1:4176/surfaces/index.html`.

One bounded Astra language worker ran in a fresh text-only subagent session,
with inherited model and effort, and returned 32 keys across English plus
the 28 docked languages. All 928 strings are machine drafts awaiting human
attestation. Review especially Gaelic, Cyrillic Tatar, modern Sanskrit
terminology, the hive/estate/family metaphors, and count-dependent grammar.
No native-speaker approval is implied by complete coverage.

zCode handoff: use a fresh founder-controlled GLM 5.3 MAX review session at
maximum effort. Review the pinned PR candidate independently, concentrating
on preference changes, returning home, keyboard focus, RTL, 200% text zoom,
small screens, reduced motion and the difference between publication and
readiness. Report defects with file/line and an actual reproduction. This is
an assignment through the repository, not a claim that the external session
has started or completed. Keep production recovery work in its own lane.
