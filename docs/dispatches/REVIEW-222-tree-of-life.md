# FORMAL REVIEW — PR #222 (austras koks: Tree of Life navigator, spouse lines, one privacy law in production)

**Reviewer:** zCode seat (bGenealogy) · **Date:** 2026-09-25/26 · **Mode:** read-only semantic review, ordered by founder ruling ("no merge until GREEN")
**State note:** the founder's own click squash-merged #222 as `2fb2052b3` onto main (02:43 UTC Sep 26) before this review returned — so this is a **post-merge review**: GREEN confirms what landed; a RED would have meant a repair PR. Reviewed content = `b517ddecb..2fb2052b3` (identical to the PR diff).
**Mechanical baseline (other seat's merge-preview):** 0 conflicts · 326/326 genealogy tests incl. #224's contract suite · estate-check PASS · deterministic rebuild (build-date-only diff).

## VERDICT: **GREEN** — with two named follow-ups (non-blocking) and one portability note.

## 1. Spouse-line semantics — GREEN
`lines.mjs`: the join is **additive-only** (never overwrites persons/edges/couples — the founder line stays byte-stable); `model.root` is immutable ("the founder stays the founder"); walk disagreements are **counted, not applied** (a FamilySearch sync signal, never a silent merge); a living line-root enters only as an anonymous stub labeled honestly (`support: "attested"`, `basis: "founder-attested private line root"`); the private mapping lives on estate-local disk and validate(public) **refuses to ship `roots`**. Public labels are **derived** from keys ("Spouse line I/II/…") — "no spouse can be named by a label until this law changes" — privacy by construction, not by redaction pass.
`privatize()` now drops a couple of two living stubs **on different lines** ("spouse lines are separate rooted trees, never silently joined in public") — an anti-re-identification rule beyond the old law. Correct.

## 2. Display-vs-evidentiary boundary (the named founder check) — GREEN, with a banked follow-up
- **Nothing asserts DEMONSTRATED anywhere.** The default evidence label is the honest `unsourced-entry`; the person card renders `standing: {support} · id`; culture claims render only when sourced, framed "language and culture, as the sources say," each with its own source line; the panel carries the evidence-layer machinery. The tree "renders only what the corpus holds: never names a living person, never invents a claim."
- **Spouse edges are not drawn at all** in the navigator — lines are separate rooted tabs; only parent edges climb. No spouse edge can silently read as blood descent.
- **Named follow-up (Laya boundary):** evidence state is disclosed **by click** (card/panel) and **by receipt** (the page's validate(public) receipt discloses privacy-problem count, cycle components = DISPUTED, and the unfetched frontier = INCOMPLETE), but the **edge geometry itself carries no evidence class** — a saga-era branch and a recorded-era branch render identically. Nothing false is implied (the absence of a claim is not a claim), but when DEMONSTRATED becomes a first-class evidentiary state, the navigator should class nodes/edges visually. The data path already transports it (`node.support` exists; `has-claims` marks claim-bearing nodes) — this is a render-side addition, and the Laya librarian should consume the corpus's own fields, never the tree's geometry.

## 3. Privacy law — GREEN
**One law, three enforcement points:** `model.privatize()` is the only privacy implementation ("the inline copy that lived here until 2026-09-22 is deleted"); `validate(model, {public:true})` enforces (living = anonymous root-line stubs only, FSID-shaped living keys = leak, living stubs may not carry cultureClaims); and **the browser page re-validates its own assembled tree at public:true and refuses to draw on any privacy hit** ("this tree failed its privacy check, so nothing is drawn"). `fs-signin.mjs`: token memory-only, never written; app key estate-local; a living person's FamilySearch id was removed from console output (commit 8d2c13542) — the walk summary prints counts and a save path, not identities.

## 4. Contract interplay (post-#224) — GREEN
The model keeps **era ⊥ support** (never derived from each other), binds every culture claim to ONE person and, when dated, to an interval inside that person's life ("never a modern flattening"), and **refuses self-declared derivations as sources** (`DERIVED_SOURCE` — "a source that names itself a derivation is refused as no source at all") — the claim-evidence-boundary law, encoded. Publication taxonomy is honest: unresolved = INCOMPLETE (parent named, not fetched) vs cycle-component/witness = DISPUTED (with witnesses, "never as merely incomplete"); every other problem stays fatal; **public privacy problems are fatal without exception**.

## 5. Corpus regeneration — GREEN (verified two ways)
The merge-preview's deterministic-rebuild test (FS data → only the build date changes) plus a sampled diff: the person-file changes are genuine harvests, not cosmetic churn — e.g., Don Ray Remington upgraded `unsourced-entry` → `sourced` with a full source object (obituary, publisher, URL, read date, delivered-by founder, itemized `supports` list) and cultureClaims (religion, region) each carrying the same source. The date-repair replay recomputed 20 era labels; "1,462 of the panel's 1,543 'impossible chronology' chips were that reader, not the tree" is receipted in `lifespan.mjs`, which also carries the BC-boundary caveat intact after the move out of model.mjs.

## Notes (non-blocking)
1. **Portability:** `pipeline.mjs` hardcodes `C:/Users/travi/family-lineage/lines-private.json` (guarded by `existsSync`; consistent with the corpus meta's sibling path). A config-level path would travel better across seats.
2. **Attestation debt:** all new lang-corpus rows are ⚙ machine drafts per the corpus law — visible fallback, no attestation claimed. Correct, but the keyed-×29 pass remains open as with every lane.
3. **The tree's receipt** honestly says "spouse lines: none published yet, each waits on its private record" — the surfaces are ready before the data is; no pressure to fill them.

## Gate state
MERGE PREVIEW ✓ (mechanical) → FORMAL REVIEW **GREEN** (this document) → **MERGE already executed by the founder's click** (`2fb2052b3`) → next per the pipeline: **#225's independent audit runs against main**, then source-contract wiring.
