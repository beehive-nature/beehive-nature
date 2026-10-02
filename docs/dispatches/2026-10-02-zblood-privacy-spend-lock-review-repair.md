# zBlood privacy, spend, and lock review repair

This repair invalidates the first pkg4 candidate and closes the later PR #296 review findings before any merge or spend.

- `preserve.mjs prepare` now writes a deterministic public projection of `sources/records.json`: citations, ARKs, event metadata, and fact classes remain; every raw `evidence[].value` transcription is excluded. The research source file remains unchanged.
- The old pkg4 gate is marked `REBUILD REQUIRED`; its hash and quote cannot be approved or uploaded.
- Quote and upload paths reject missing, nonnumeric, negative, over-ceiling, or wrong-chunk-count values. The upload receipt reads the installed Ant CLI version instead of hardcoding v0.3.1.
- Writer-lock refresh, stale takeover, and release use an O_EXCL mutation sidecar. The canonical ownership file remains present throughout heartbeat refresh, contenders fail closed while a mutation is active, and same-named writers remain separated by per-process claim IDs.
- Fresh unreadable claims refuse; unreadable claims older than the stale interval recover through the same conditional protocol.
- Only explicit `xml-403` and `xml-404` denials are terminal. Throttling and server responses such as 429/500 remain retryable.
- `checkpointDownload` now performs its own request to the canonical `das/v2` binding URL derived from the queued ARK. Caller-supplied binding fields are discarded; a neighboring response cannot authenticate itself into the manifest.
- Lock release runs under the same mutation claim and rechecks byte identity before unlink. A stale holder cannot unlink a contender's replacement claim.
- The paid path freezes the approved tar into a private random snapshot, re-hashes it, and uses that one path for the last quote and upload. Rebuilding or replacing `pkg4.tar` during the quote cannot change the paid bytes.
- Optional Ant version metadata is captured before upload and is nonfatal. A successful paid upload is returned even if later local receipt-bank maintenance fails.
- The public edition declares `sources/search-evidence.json` alongside the other evidence files, preserving the relationship audit's documented fallback layer.
- Direct service execution compares normalized filesystem paths through `fileURLToPath` and `resolve`, so the documented command starts on POSIX as well as Windows.
- Negative XML outcomes now require a guard-fetched ARK-to-APID binding, just like downloads. A stale or neighboring APID cannot permanently resolve a queued ARK.
- Queue membership and writer ownership are checked before the guard performs any binding request, preserving the no-stray-fetch boundary.
- `prepare` validates the private record schema, requires a nonempty record map, and reconciles every record ID and count against both the source index and manifest before projecting public bytes.
- The service re-reads the edition gate immediately before the paid command and refuses any revocation or change to the approved hash, ceilings, or chunk count. Upload banking appends a durable progression row when an older receipt has none, and snapshot cleanup is best-effort after a paid result.
- The public image summary marks the earlier one-off byte-audit claim `UNVERIFIED`; no banked source file/function exists for that audit, so the archive no longer overstates its proof boundary.

Verification after the second review repair: focused walker/preservation suites 46/46; `git diff --check` clean. The merged-main full-suite receipt is recorded in the follow-up merge commit.

Live read-only wire proof on this seat: Node fetched the exact guard-derived URL for already resolved queue ARK `33S7-9R48-CFZ`; FamilySearch returned HTTP 200 with the bare-APID response shape, and the normalized response exactly matched the APID already banked in the byte-audited manifest. No manifest write and no credential were involved.
