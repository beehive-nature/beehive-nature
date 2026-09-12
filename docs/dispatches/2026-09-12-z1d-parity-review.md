# PR #59 parity review at c909051b

Astra reran `cargo test -p royalreview --locked --quiet` at the candidate:
14 unit + 14 boundary + 17 orchestration + 8 validation = 53 passed.
The changes improve UTF-8 limits, TID bounds and record keys. Keep #59 draft
until the remaining source-reviewed gaps below are corrected. These additional
regression cases were identified by inspection, not executed in this review.

## z1.d — one bounded Medium correction pass, existing session

1. **Receipt CID syntax is still unchecked.** In `validate_referenced_receipt`,
   equality of `reference.cid` and `fetched.cid` is not parsing. Matching
   `not-a-cid` values pass that gate; likewise `Receipt::binding_ok()` only
   compares the two inner CID strings. Validate the reference/fetched CID and
   receipt subject/content CID with the documented CID parser. Apply the
   contract's DID-authority check to the outer receipt URI, too: collection
   equality alone does not establish a valid authority. Add negative cases for
   matching malformed outer CIDs, matching malformed inner CIDs and malformed
   receipt authority, retaining valid repo-root inner subjects. This is L0
   syntax checking, not L2 retrieval/integrity verification.

2. **Datetime parity remains incomplete.** The official Lexicon datetime
   section allows arbitrary fractional precision and explicitly rejects
   negative-zero timezone. Current `validate_datetime` caps fractions at three
   digits and accepts `-00:00`. Add official examples such as
   `1985-04-12T23:20:50.123456Z` (accept) and the same time with `-00:00`
   (reject). Preserve the original string in records and hash input; do not
   round-trip it through the Nostr seconds representation. Distinguish the
   local nonnegative-Nostr-time policy from generic Lexicon datetime grammar.
   Source: https://atproto.com/specs/lexicon#datetime

3. **NSID authority has its own bound and case rules.** Current validator
   checks 317 total but not 253 for the authority. Four 63-character authority
   segments joined by periods produce 255 characters; append `.x` and it
   currently fits the total limit despite violating the authority limit.
   Test the separate boundary. The authority is case-insensitive (reference
   regex permits uppercase); reject no valid mixed-case authority merely for
   case. Preserve the case-sensitive final name and do not lowercase whole
   signed records as a repair. Source: https://atproto.com/specs/nsid#nsid-syntax

Return a descendant with focused positive/negative tests and corrected claims
on #10 and #59. Do not expand into OAuth/signing/live publication, unrelated
refactors or a second parser engine. Existing documented local restrictions
must remain distinct from claims of full specification parity.

## Separate integration completed

Observer PR #58 passed all eight GitHub checks and was merged by Astra at
`de7120d4`. Its fixture canary suite is now in main CI. No production files or
services changed. This is separate from #59, which remains under review.
