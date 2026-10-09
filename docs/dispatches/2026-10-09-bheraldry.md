# 2026-10-09 — zCode/bHERALDRY-001: sovereign symbols, cultural provenance, universal translation

Seat: zCode (GLM-5.3). Founder order: bHERALDRY-001, opened 2026-10-09 ("Open a
third lane: bHERALDRY — Sovereign Symbols, Cultural Provenance & Universal
Translation"). Worktree: `../wt-zcode-bheraldry`, branch
`zcode/bheraldry-001-2026-10-09`, cut from origin/main `87c744810` (the shared
checkout sits 162 commits behind and was not touched). Lane C per the order's
three-lane split; no files owned by the PQ/proof lane or the workerB bEncH lane
were modified (shared touches: `Cargo.toml` members append, `Cargo.lock`,
`surfaces/stack.html` via its own generator, `scripts/build-stack-inventory.mjs`
one row).

## What landed

`crates/bheraldry` — a Rust-first semantic core where a symbol is evidence, not
artwork. The architecture is the four truths, as types: **source authenticity,
historical interpretation, language equivalence, authority** — every claim
names which it carries, and the validators make confusing one for another a
named `LawViolation` instead of a silent merge.

Two specimens ship:

1. `bg/national-arms` — the coat of arms of the Republic of Bulgaria per
   Закон за герба на Република България (ДВ бр.62, 5 August 1997; adopted by
   the XXXVIII Народно събрание 31 July 1997 per the law's own § 1). The
   original inscription „Съединението прави силата“ is carried byte-exact from
   the law's Чл. 2 (1), with six translations, each binding the original's
   digest and carrying its own attestation tier. **A research and conformance
   specimen: not permission to reproduce, not BNR branding** (usage law
   recorded verbatim: elements reproduce only с акт на Министерския съвет).
2. `bnr/house-achievement` — the estate's own creative work per
   `docs/BLAZON.md`, its asset bound by live sha256, its family association
   carried by tradition that is **forcibly Unverified** (era≠support), and the
   four UNVERIFIED quarters retained as a standing dispute rather than
   smoothed over.

## Evidence

- Base: origin/main `87c744810` ("dispatch: zCode independent review of
  PQ00/PQ01 at 2e8d2097"). All work in `C:\Users\travi\wt-zcode-bheraldry`.
- Tests, local, Git-for-Windows, cargo 1.98.1:
  `cargo test -p bheraldry --locked` →
  **24 passed, 0 failed** (10 adversarial, 1 bsigner seam, 10 positive,
  3 frozen-vector).
- `cargo build --workspace --locked` (CI's first step, local parity) →
  `Finished dev profile … in 6m 00s`, exit 0.
- `cargo fmt --all --check` → clean after `cargo fmt --all`.
- `node scripts/build-stack-inventory.mjs --check` →
  `{"components":23,"workspaceCrates":67,...,"mode":"checked"}`.
- Receipt printer (`cargo run -p bheraldry --bin specimen`), verbatim:
  - record `bg/national-arms` rev 1: 43,586 canonical bytes; digest
    sha256(bheraldry/record/1‖bytes):
    `0bd62b1cbc01bf44f724ceb77cf89b1d15ba61d21f22a8d7ba7b9f04926d627c` <!-- PUBLIC-CONSTANT (frozen specimen digest, tests/specimen_vector.rs) -->
  - motto original (bg): `Съединението прави силата` — 48 bytes, survives
    canonical serialization byte-exact (positive test).
  - translations: 6 — en OfficialRendering "United we stand Strong"
    (speaker: the Council of Ministers' own English page, capital S verbatim);
    en ×2 DocumentedVariant ("Unity makes strength", "Strength through
    Unity", tertiary); lv "Vienotība rada spēku", zh-Hans "团结就是力量",
    ar "الوحدة تصنع القوة" — all three MACHINE drafts, UNATTESTED (⚙).
  - glossary: 8 entries, 0 collisions; sources: 8; usage conditions: 3;
    disputes retained: 3; asset: NONE (state insignia bytes deliberately not
    captured).
  - record `bnr/house-achievement` rev 1: 7,755 bytes; asset binding
    `assets/house/house-achievement.svg` =
    `51ab9a681c5768a15c4db20cb96cd0be87247c81913960292c111bc2e05889e0` <!-- PUBLIC-CONSTANT (sha256 of the in-tree house achievement, recomputed live by tests/positive.rs) -->
- bSiGner seam (`tests/bsigner_seam.rs`): a real ML-DSA-44 keyset (sealed at
  rest under a deterministic TEST bdidrec1 root — publicly worthless, never a
  secret on argv), `bheart.signature/1` envelope over
  `bheraldry/attest/v1‖NUL‖seal canon‖NUL‖record bytes`; verify of true bytes
  → rc 0; flipped payload byte → refused; same envelope for the house record
  → refused; envelope under a different key id → refused. The signer identity
  is a did:b: string validated by `bzdid::BzDid::parse`.

## The ten adversarial verdicts (order §8) — all DETECTED, by name

| # | attack | detector that fires |
|---|---|---|
| 1 | motto altered after translation | `TranslationTargetsDifferentOriginal` (every translation binds the original's digest) + sealed-digest drift |
| 2 | visually similar counterfeit image | `AssetRef::verify_bytes` — sha256 mismatch (true bytes verify; one flipped byte refuses) |
| 3 | emblem attributed to wrong family | `DocumentaryBasisNeedsExternalSource` / `OfficialEntityNeedsLegalAssociation` |
| 4 | source metadata swapped, image kept | digest drift + `DigestMismatch` on `SealedRecord::from_bytes` |
| 5 | valid signature reused under other identity/domain | bsigner verify refuses (content hash); `DigestMismatch` / `WrongSealDomain`; non-did:b: signer cannot construct |
| 6 | creative asset relabelled official | `OfficialClassNeedsLegalSource`, then `OfficialClassNeedsLegalUsage` even after grafting a fake legal source |
| 7 | living genealogical subject named | `LivingPersonNameForbidden` (pseudonym form passes) |
| 8 | stale revision presented as current | `StaleRevision` from `RevisionChain::assert_current`; predecessor stays verifiable as history |
| 9 | heraldic distinctions dropped in translation | `TermGlossary::collisions()` — rampant/passant collapsed to one target word is named |
| 10 | migration loses record/provenance | digest drift + `OfficialClassNeedsLegalUsage` (lossless migration is byte-identical) |

Criteria were named before the run: the tests above are the criteria; the
receipt printer prints observations only.

## Sources (all accessed 2026-10-09; graded in-record)

- **lex.bg** — Закон за герба, ДВ бр.62/5.08.1997 — PrimaryLegal, verbatim
  Чл. 1–3 + § 1. WebReader-mediated; one earlier partial read of the same
  page differed in two words („стоять“/„стоят“, „през които“/„през която“) —
  recorded in `access_note`, verify against the ДВ scan before legal
  quotation. The 2017 amendment (ДВ бр.100) exists; its text was NOT examined.
- **government.bg** (English edition) — PrimaryOfficial; the state's own
  English motto rendering "United we stand Strong" verbatim; names no law.
- **en.wikipedia** Coat of arms of Bulgaria + Lion (heraldry) — Tertiary;
  constitution Art. 164 quote, history chain, crown-historicity observation,
  attitude vocabulary; assistant-mediated, quote-level fidelity UNVERIFIED.
- **parliament.bg/bg/20** — PrimaryLegal grade but **UNEXTRACTED** (JS-rendered
  SPA; two tool attempts returned only the page title). Honest absence; no
  claim rests on it.

Disputes retained (never adjudicated): the three English motto renderings; the
crown's historicity (legal first-image vs art-historical observation); the
"adopted" date (31 July per the law's § 1 vs 4 August per Wikipedia).

## Corrections to the order (named, per discipline)

1. **bFUzZ is not creative production.** In-tree, bFUzZ is the independent
   review/security lane (dispatches 2026-09-13/20). The creative-asset
   provenance the order wanted lives in `docs/BLAZON.md` + `assets/house/` +
   `docs/LICENSING.md`; that is the seam this lane reused for § 6.
2. **The shared checkout is 162 commits behind origin/main** — bzdid, the
   btungsten crates and the Oct 07–09 dispatches are invisible there. Any
   follow-up seat must branch from `git fetch origin` state, not the shared
   tree.
3. lex.bg vs the order's "4 August 1997" adoption date: the law's own § 1
   says 31 July 1997 (XXXVIII НС); 5 August is promulgation. Retained as a
   dispute, not adjudicated.

## Implemented vs only proposed

**Implemented:** the semantic core, both specimens, canonical-bytes digest +
frozen vector, revision chains, signed-seal seam (bzDiD identity + bsigner
envelope integration test), glossary-collision detector, all ten adversarial
detectors, stack-inventory registration.

**Proposed only (named, not built):** a consuming surface (none renders these
records yet); RTL rendering (the direction field exists and round-trips; no
RTL surface exists in the estate — honest absence); bGeneology person-page
attachment (the association + living-privacy laws are in place; the actual
person-page wiring belongs to the genealogy lane); an original BNR creative
interpretation *of the Bulgarian specimen* (correctly declined — the house
achievement is the House's own arms, not a Bulgaria-inspired composition; a
new composition belongs to the creative workflow, not this lane).

**Deliberate absences:** no state-insignia image bytes committed (the law's
приложения 1–2 arrived only as blob URLs); no machine translation is attested;
no dispute is adjudicated; the crate decides no heraldic law.

## Boundaries not crossed

- This record authenticates nothing about history or rights: a signature
  authenticates a signer and bytes under the signer's own trust assumptions.
- Wording ceiling respected: the attestation reuse is sound by construction
  (tiers are types, not labels); no crypto claims beyond what the bsigner
  CLI's own verifier exercised above.
- Machine drafts (lv/zh/ar) are UNATTESTED and may not be quoted as
  authenticated renderings; they await a speaker or community attestation
  through the bLANGUAGEdock interface.
- No secrets were read, held, or printed. The bsigner test root is a
  deterministic public constant.

## Reproduction (the completion criterion)

From a checkout of this branch:

```
cargo test -p bheraldry --locked     # 24 tests incl. the ten verdicts
cargo run -p bheraldry --bin specimen  # the receipt, digest included
```

Another worker ingesting the same sources reconstructs the same record bytes
(deterministic construction — asserted by `canon_is_deterministic_across_runs`),
the same original inscription (byte-exact), the same translation provenance
(each tier and authority basis is in-record), and the same adversarial
verdicts (each detector fires by name). The frozen digest pins revision 1; a
specimen change is a new revision, never an edit.

## Next owners

- **Translation attestation:** lv/zh/ar drafts need a speaker/community
  attestation to leave ⚙ status — the bLANGUAGEdock lane's call, not this
  seat's.
- **Consuming surface:** when one is wanted, it reads the stable JSON canon
  and the receipt bin; the surfaces registration ritual applies to it, not to
  this crate.
- **The 2017 amendment (ДВ бр.100) and the ДВ бр.62 scan:** verify the
  webReader-mediated verbatim against the official scan — one fetch, then
  revise the record (a new revision, digest moving forward).
