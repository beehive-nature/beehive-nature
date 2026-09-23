# G2-B — bounded read-only receipt reading and explicit cursors (2026-09-07)

Issue [#23](https://github.com/beehive-nature/beehive-nature/issues/23).
Brief: Astra's G2-B backend docket (local draft in `wt-astra-g2b`,
baseline = integrated main `53ed8611`). Builder: zCode, fresh session,
worktree `wt-zcode-g2b`, branch `lane/g2b-reader` from `b1527486`.
**Pinned candidate for independent review — no merge until acceptance, no
production deployment, the accepted G2-A writer and JSONL envelope are
byte-unchanged.**

## 0. Pre-implementation gate

The concrete API/status schema and budget-coverage rationale were recorded
in the [claim comment](https://github.com/beehive-nature/beehive-nature/issues/23#issuecomment-5574235575)
BEFORE implementation, per the brief. What landed matches it.

## 1. The acknowledgment boundary — the lane's founding law

The brief demonstrates (two passing probes) that the persisted format
carries no acknowledgment watermark: identical bytes follow an
acknowledged write and a sync-refused one — including a clean-looking
`session_end`. Consequences encoded everywhere:

- the result is named a **parsed/observed prefix**, never acknowledged;
- `writer_acknowledgment` is a fixed `"unknown"` field in every session
  report — including a fully-consistent `clean_valid` one;
- receipts that left no bytes are not countable from JSONL.

Regression `readable_bytes_never_become_acknowledgment` runs both probe
shapes against the reader: records are delivered, the clean-looking end
yields `declared:"clean_declared"` + `clean_valid:true`, and the
acknowledgment field still says `unknown`.

## 2. Reader (`crates/banchor/src/replay_reader.rs`)

- **Finite observation**: `ByteSource` (`FileSource` read-only + regular
  file check; `MemSource` for fixtures); extent H captured at call start;
  later appends wait for the next call (real-file growth test); mid-call
  shortening below H → typed `TruncatedDuringRead`; `len < prior_len` →
  typed `TruncatedBelowCursor` with no candidate. No discovery, polling,
  rotation, repair, or append.
- **Byte framing**: LF-delimited UTF-8 JSON objects; offsets count
  original bytes including delimiters; `t` (string) / `t_ms` (u64) / `ev`
  (string) envelope enforced with MISSING vs WRONG-TYPE distinguished;
  blank lines, duplicate top-level keys (hand-rolled bounded top-object
  scanner — serde cannot see duplicates), nesting > 32, oversized
  records, and non-object roots are REFUSED at their offset. Unknown
  event kinds stay opaque payload data.
- **No false tail**: `IncompleteTail{starts_at}` for EOF-mid-record (even
  when the bytes parse — tested with a complete-JSON-no-LF line);
  `LimitReached` for budget stops — never presented as EOF or torn.
- **Contiguous progress**: a fault stops at its starting offset; the
  following valid record is provably not delivered; the candidate cursor
  ends BEFORE the offending/tail bytes.
- **Budgets before parsing** (all `checked`): 4 MiB/record (the writer's
  own bound), 8 MiB/batch bytes, 256 records/batch, 64 MiB prefix
  validation, 4 KiB cursor, 256 B source key — caller-lowerable via
  `Budget`; first-record-over-budget → explicit `BudgetTooSmall`
  (tested); over-budget prefix validation → typed refusal (scalable
  indexing explicitly not claimed); line scans read in 64 KiB chunks into
  buffers capped by the record bound — never `read_until`/`lines()` over
  the source.
- **Honest status**: stop reason, session evidence, and acknowledgment
  are separate fields. `declared` ∈ {no_end_marker, unknown_legacy,
  unknown_partial_flags, clean_declared, gappy_declared, contradictory};
  `clean_valid` additionally requires start-seen, exactly ONE terminal
  end with complete explicit flags, no latched gap, no post-end records,
  and a fully-accounted extent (stop = EOF AND next = H). Anomalies
  (repeated_end, post_end_records, contradictory_flags,
  end_without_start) are reported, never repaired; gaps latch permanently
  across batches and resumes (semantic state is RECOMPUTED from prefix
  bytes on every resume — the cursor JSON deliberately caches nothing).
- **Lag & duplicates**: H, next, and H−next as observed byte backlog
  (tail included); identical JSON at different offsets are two
  observations; same-cursor re-reads repeat, accepted-cursor resumes
  never repeat consumed offsets; no dedup or exactly-once claims.

## 3. Cursor + persistence

- Versioned `{v,src,next,len,digest{alg,b64u}}`: logical source key
  (bounded), next byte offset, consumed-prefix digest (sha3-256 over
  bytes [0,next), base64url via the crate's existing `b64` — no bare hex,
  no new dependencies), prior observed length. NO semantic fields cached.
- Resume validates: version, exact field set/types/bounds, key match
  (both at load AND in `read_batch`), offset range, newline boundary
  (byte before `next` is LF), length monotonicity, and the recomputed
  digest over the whole prefix under the validation budget — checked
  BEFORE any prefix read. No auto-fallback to offset zero anywhere.
  Same-length prefix mutations are caught (tested).
- `save_cursor_new`: exclusive `create_new` (never overwrites; collision
  is a typed failure leaving the old checkpoint byte-identical —
  tested), bounded encoding, checked write + `sync_all`, Unix
  parent-directory fsync (the G2-A Windows creation-durability limitation
  applies unchanged), parent must exist. A failed save leaves the
  caller's previously selected checkpoint in place: replaying from it may
  REPEAT an accepted batch — the explicit recovery rule (tested as
  repeat-only, never skip, in the fresh-process test).
- Reading returns a CANDIDATE cursor only; nothing auto-saves.

## 4. Integrity limits (stated plainly)

Checkpoint-relative integrity, NOT authentication or freshness: under the
supported append-only/stable-prefix model it detects changed consumed
bytes and observed shortening; a byte-identical replacement under the
same logical key is indistinguishable and may be accepted; changes before
the first checkpoint, changes to unconsumed bytes, and hostile concurrent
in-place writers are not fully detectable. Checkpoint saves prove process
independence, not power-loss durability.

## 5. Regression matrix → tests (13/13 rows + controls)

| Brief row | Test |
|---|---|
| healthy multi-batch, contiguous, clean only at end | `healthy_source_multi_batch_contiguous_and_clean_only_at_end` |
| duplicates + repeat semantics | `duplicates_are_two_observations_and_repeat_is_repeat` |
| partial line, later completion | `partial_line_waits_cursor_holds_line_start` |
| complete JSON without LF | `complete_json_without_lf_is_never_admitted` |
| malformed/UTF-8/envelope/dup/deep/oversized, no scan-ahead | `malformed_records_stop_contiguously_no_scan_ahead`, `deep_nesting_is_refused_and_oversized_records_stop` |
| budget stop + exact backlog | `budget_stop_is_limit_reached_not_eof_and_backlog_exact` |
| wrong key / mutated prefix / mid-line / bad-version / oversized cursor, no auto-reset | `cursor_refusals_without_auto_reset` |
| truncation below cursor | `cursor_refusals_without_auto_reset` (last block) + `real_file_roundtrip_growth_and_immutability` |
| gap evidence across batches/resume; legacy unknown; end anomalies | `gap_state_survives_batch_boundaries_and_resume` |
| sync-refused event + clean-looking end (readable ≠ acked) | `readable_bytes_never_become_acknowledgment` |
| cursor save collision/parent/partial + round trip | `cursor_save_collision_parent_partial_and_roundtrip` |
| fresh process loads checkpoint; old checkpoint repeats only | `tests/replay_reader_process.rs::fresh_process_resume_repeat_only_and_payload_exclusion` |
| offline CLI with click/approve/model data, payload exclusion, immutability | same integration test (default output excludes payloads; `--raw` labels them untrusted; source bytes compared before/after; wrong-key cursor exits nonzero) |

Positive controls beside fault cases: the healthy multi-batch/whole-read
equivalence, budget-success control, clean-collision round trip, and the
CLI's raw success run. Real temporary-file round trips cover FileSource;
late failures (post-growth truncation, save-after-load collisions) are
exercised, not only first-operation failures.

## 6. Commands and gates

```
cargo test -p banchor --locked     # 89 + 1 integration = 90 passed, 0 failed
cargo fmt -p banchor -- --check    # clean
```

All 77 G2-A tests retained and passing. Platform notes: the Unix
parent-dir fsync path compiles `#[cfg(unix)]` and runs in CI's Linux
runners; this Windows seat exercised the Windows path (no directory
fsync — the documented G2-A limitation). No shared-workflow changes. The
CLI's `replay-inspect` is offline-only: no daemon start, no network, no
model, no source writes — asserted by the integration test.

## 7. Remaining limits

- Reader admission bounds intentionally limit resume over very large
  prefixes (64 MiB validation ceiling) — scalable indexing not claimed.
- `unknown_partial_flags` is a new classification for ends carrying only
  some of ok/halted/gaps: honest unknown, never clean-eligible.
- No new ledger, event bus, archive format, payment replay, or agent
  recovery that retries actions — historical receipts are observed, never
  executed (nothing in this module can invoke a callback with execution
  authority).
