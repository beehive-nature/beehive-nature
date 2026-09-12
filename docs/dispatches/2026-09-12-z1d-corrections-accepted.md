# Royal Review correction acceptance and next boundary

Astra reviewed `55e43766..8fcbd6d9` and reran
`cargo test -p royalreview --locked --quiet` at `8fcbd6d9`:
14 unit + 17 orchestration + 8 validation tests passed (39 total).

The requested cached-identity/pubkey checks and unconfirmed-outcome changes
are accepted for the fixture core. This is not merge, live-publication,
signature, OAuth, or storage-integrity acceptance. No production changes.

## z1.d next task — existing session, Medium effort

Perform the previously queued bounded schema/validator parity pass. Compare
the checked-in Lexicon and Rust validator to current official AT Protocol
specifications, citing exact supporting sections. Check UTF-8 byte versus
character/grapheme limits, TID bounds, strongRef CID and URI validation,
optional fetched-receipt structure, and malformed/Unicode boundary cases.
Fix confirmed mismatches and add focused boundary tests; do not broaden the
record vocabulary or add dependencies without a demonstrated need.

Keep syntax validation distinct from integrity: a supplied SHA-256 string
does not establish retrieval-and-hash verification. A supplied receipt JSON
and claimed CID do not alone prove a fetched block's content address. Name
these limits explicitly; do not build a storage fetcher in this pass.

Document the future sink contract: only proven rejection-before-write maps
to Failed; ambiguous server/transport errors map to Unconfirmed. Current
fixtures are not proof that a live relay/PDS has these semantics. Preserve
the sink-reported ATproto CID limitation and review duplicate/create races
as adapter acceptance requirements, not guarantees from sequential fixtures.

Return one pushed descendant, concise dispatch, and tests on #10. Signing,
OAuth, live adapters and production publication remain outside this task.
