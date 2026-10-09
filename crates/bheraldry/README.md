# bheraldry — a symbol is evidence, not artwork

Order bHERALDRY-001 (zCode seat, 2026-10-09). Sovereign symbols, cultural
provenance, universal translation — as a Rust-first semantic core.

## The idea

A culturally meaningful symbol carries a historical meaning, a visual
grammar, source provenance, cultural context, authorized uses, and
translations. This crate holds those as **separate typed claims** (the four
truths: source authenticity / historical interpretation / language
equivalence / authority) so no one of them can silently stand in for
another. A thousand-year record can stay byte-perfect while its translation
misleads, or historically accurate while its legal permission changes — a
record that cannot keep those apart will eventually assert one using the
evidence of another.

## What is in here

- `src/lib.rs` — the model, the laws (as named `LawViolation` errors), the
  canonical-bytes digest, sealed records, revision chains, the signed-seal
  seam.
- `src/specimen.rs` — two records:
  - `bg/national-arms` — the coat of arms of the Republic of Bulgaria per
    Закон за герба (ДВ бр.62, 5 Aug 1997). Research/conformance specimen;
    **not permission to reproduce; not BNR branding.**
  - `bnr/house-achievement` — the estate's own creative work per
    `docs/BLAZON.md`, carried by family tradition that is forcibly
    `Unverified`.
- `src/bin/specimen.rs` — the receipt printer (`cargo run -p bheraldry --bin specimen`).
- `tests/specimen_vector.rs` — the frozen digest (a canon change is a new
  revision, never an edit).
- `tests/positive.rs` — the guarantees (byte-exact Cyrillic, NFC≠NFD,
  malformed-encoding refusal, attestation presence, RTL logical order,
  live asset binding, revision succession).
- `tests/adversarial.rs` — the ten attacks of order §8, each shown
  DETECTED by name.
- `tests/bsigner_seam.rs` — a real ML-DSA envelope over the specimen
  through the frozen bsigner CLI contract; tampered payloads and record
  swaps refused by the organ's own verifier.

## Seams this crate reuses (never reinvents)

| seam | where | what is reused |
|---|---|---|
| bLANGUAGEdock | `crates/language-authority` | `TranslationAttestation` tiers — machine drafts are visibly machine and can never render as official |
| bzDiD | `crates/bzdid` | `BzDid::parse` validates every attestor identity |
| bSiGner | `crates/bsigner` (frozen CONTRACT.md) | the CLI signs the domain-separated payload; verify refuses tampering |
| bGeneology | `tools/genealogy` laws, restated | living = pseudonym; era≠support (tradition is forcibly Unverified) |
| BLAZON.md | `docs/BLAZON.md` | the VERIFIED/UNVERIFIED grading vocabulary; the house record cites it |

## Deliberate absences

- No state-insignia image bytes are committed (the law's приложения 1–2 are
  integral to the law but were offered only as blob URLs, and this lane does
  not reproduce state insignia).
- No surface consumes the crate yet; JS surfaces may become consumers later.
- No adjudication: disputes are retained with ≥2 sourced positions, and
  there is no operation that picks a winner.
