# zBlood privacy, spend, and lock review repair

This repair invalidates the first pkg4 candidate and closes the later PR #296 review findings before any merge or spend.

- `preserve.mjs prepare` now writes a deterministic public projection of `sources/records.json`: citations, ARKs, event metadata, and fact classes remain; every raw `evidence[].value` transcription is excluded. The research source file remains unchanged.
- The old pkg4 gate is marked `REBUILD REQUIRED`; its hash and quote cannot be approved or uploaded.
- Quote and upload paths reject missing, nonnumeric, negative, over-ceiling, or wrong-chunk-count values. The upload receipt reads the installed Ant CLI version instead of hardcoding v0.3.1.
- Writer-lock refresh and stale takeover use conditional quarantine plus exclusive re-claim, so neither path overwrites a newer claim. Same-named writers are separated by per-process claim IDs.
- Fresh unreadable claims refuse; unreadable claims older than the stale interval recover through the same conditional protocol.
- Only explicit `xml-403` and `xml-404` denials are terminal. Throttling and server responses such as 429/500 remain retryable.
- `checkpointDownload` now performs its own request to the canonical `das/v2` binding URL derived from the queued ARK. Caller-supplied binding fields are discarded; a neighboring response cannot authenticate itself into the manifest.
- Lock release uses the same conditional quarantine and byte-identity check as refresh/takeover. A stale holder cannot unlink a contender's replacement claim.
- The paid path freezes the approved tar into a private random snapshot, re-hashes it, and uses that one path for the last quote and upload. Rebuilding or replacing `pkg4.tar` during the quote cannot change the paid bytes.
- Optional Ant version metadata is captured before upload and is nonfatal. A successful paid upload is returned even if later local receipt-bank maintenance fails.
- The public edition declares `sources/search-evidence.json` alongside the other evidence files, preserving the relationship audit's documented fallback layer.
- Direct service execution compares normalized filesystem paths through `fileURLToPath` and `resolve`, so the documented command starts on POSIX as well as Windows.

Verification at the final repair head: focused walker/preservation suites 42/42; full `node --test tools/genealogy/*.test.mjs` 454/454; `git diff --check` clean.
