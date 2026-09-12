# z1.d — parity corrections: receipt CID parsing, datetime grammar, NSID authority bounds

2026-09-12 · z1.d bounded correction pass · fixes all three findings from Astra's PR #59 parity
review at `c909051b` ([#10 comment 5648079333](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5648079333)).
Medium, fixture-only; no OAuth/signing/live publication, no unrelated refactors, no second
parser engine. PR #59 stays DRAFT.

| | |
|---|---|
| Parent | `c909051b` |
| Owned paths | `crates/royalreview/**`, lexicon JSON `createdAt` description (description-only) |

## Finding 1 — receipt CID syntax unchecked (equality is not parsing)

`validate_referenced_receipt` compared `reference.cid`/`fetched.cid` as STRINGS, and
`Receipt::binding_ok()` only string-compares the inner `subject.cid`/`contentCid` — two
matching garbage values passed both gates. Fixed:

- both OUTER cids are PARSED (`Cid::parse_str`, the documented parser) independently, then
  compared;
- both INNER cids (`receipt.subject.cid`, `receipt.content_cid`) are parsed after the
  binding-law check, so a matched pair of non-CIDs can no longer ride §5;
- the receipt record's own at-uri now carries the contract's DID-AUTHORITY check —
  collection equality alone no longer establishes the authority.

Regressions (each the exact shape Astra named): matching malformed OUTER cids
(`not-a-cid == not-a-cid`) refused; matching malformed INNER cids
(`garbage-but-equal` satisfying the binding law) refused; malformed receipt authority
(`at://handle.example/com.beehivenature.receipt/…`) refused; valid repo-root INNER subjects
retained (existing positive test unchanged). All L0 syntax — no L2 retrieval claim made.

## Finding 2 — datetime grammar divergences (Lexicon spec, datetime section)

- **Arbitrary fractional precision** is legal (official example
  `1985-04-12T23:20:50.123456Z`); the 3-digit cap was a local invention — removed. The
  fraction is TRUNCATED (never rounded) from the returned whole-second instant.
- **`-00:00` is explicitly rejected** by the Lexicon syntax (negative zero = unknown local
  offset); `+00:00` stays valid, `-00:01` stays valid.
- **Grammar vs policy split**: the pre-1970 refusal was the NOSTR-TWIN policy (created_at is
  u64 seconds) wrongly baked into the generic grammar. `validate_datetime` now returns
  negative instants happily (`1969-12-31T23:59:59Z` → `-1`), and the non-negative rule moved
  to `twin::build_twin`, where it belongs, with a named error.
- **No round-trip**: the ORIGINAL createdAt string travels verbatim into the twin content
  and therefore the event id's hash input (asserted by test: `.123456` present byte-for-byte
  in content; `event.created_at` is the separately derived whole-second field).

The lexicon JSON `createdAt` description was corrected to state the real grammar (it
previously claimed "at most 3 fractional digits" — description-only change).

## Finding 3 — NSID authority bound and case rules (NSID spec, syntax section)

- The DOMAIN AUTHORITY has its own **≤253 chars** bound (including periods), independent of
  the 317 total: four 63-char segments (255) previously passed once `.name` was appended —
  now refused; 253 accepted; 254 refused at the seam (all three tested).
- Authority segments are **case-insensitive input** (`[a-zA-Z0-9-]`, no lead/trail hyphen,
  TLD not digit-first): mixed-case authorities like `Com.Example.name` are no longer refused
  merely for case, and we never lowercase anything as a repair — validation only. The NAME
  segment stays case-sensitive (`royalReview`, like upstream `strongRef`).

## Claims hygiene (per the review's closing note)

The previously documented LOCAL restrictions stay labeled as restrictions, not parity:
CID base32-CIDv1-only, verdict knownValues strictness, DID-authority-only uris. This pass
brings the GRAMMAR checks to spec; it does not claim full specification parity for the
contract overall.

## Tests

`cargo test -p royalreview --locked` — **59/59 green** (16 unit + 18 boundary + 17
orchestration + 8 validation), zero network; `cargo fmt --all --check` clean;
`cargo build --locked` green. Net new: 3 receipt CID/authority regressions, 1 NSID
authority-bound suite (253/254/255 + mixed case), 2 twin datetime tests (pre-1970 split,
verbatim fraction preservation); the datetime suites were rewritten to the corrected
grammar (arbitrary precision accepts, `-00:00` rejects, pre-1970 asserts `-1`).
