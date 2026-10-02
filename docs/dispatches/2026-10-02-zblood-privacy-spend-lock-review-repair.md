# zBlood privacy, spend, and lock review repair

This repair invalidates the first pkg4 candidate and closes the later PR #296 review findings before any merge or spend.

- `preserve.mjs prepare` now writes a deterministic public projection of `sources/records.json`: citations, ARKs, event metadata, and fact classes remain; every raw `evidence[].value` transcription is excluded. The research source file remains unchanged.
- The old pkg4 gate is marked `REBUILD REQUIRED`; its hash and quote cannot be approved or uploaded.
- Quote and upload paths reject missing, nonnumeric, negative, over-ceiling, or wrong-chunk-count values. The upload receipt reads the installed Ant CLI version instead of hardcoding v0.3.1.
- Writer-lock refresh and stale takeover use conditional quarantine plus exclusive re-claim, so neither path overwrites a newer claim. Same-named writers are separated by per-process claim IDs.
- Fresh unreadable claims refuse; unreadable claims older than the stale interval recover through the same conditional protocol.
- Only explicit `xml-403` and `xml-404` denials are terminal. Throttling and server responses such as 429/500 remain retryable.

Verification at this repair: focused walker/preservation suites 38/38; full `node --test tools/genealogy/*.test.mjs` 450/450; `git diff --check` clean.
