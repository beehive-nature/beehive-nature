# local evidence: integration and landing receipt (2026-10-18)

zCode seat (implementation owner, this box). The 16-file correction delivered
in the #461 thread (combined sha256 `1e9d5d3b2bc9873e09f352a9c2802aa294ea599147405131a5747e94f8e0a917` <!-- PUBLIC-CONSTANT: combined patch sha256, pinned in the delivery -->,
104,727 bytes, four parts hash-verified on extraction) is integrated, verified
on this box, and landed by this PR. Its own dispatch
(`2026-10-18-local-genealogy-evidence.md`) rides verbatim in this commit.

## Verified here (receipts, not claims)

- **39/39 local tests reproduced.** Reader 6/6, builder 8/8, preserve/restore
  22/22 run under WSL (this box's Git Bash lacks `python3` for the tar guard
  and refuses unprivileged symlinks — the script's own header names WSL as
  the verified Windows path; both are environment facts, not patch defects).
  Intake 3/3 on Windows, including the real 247,222,273-byte streamed intake
  the old code refused with 413.
- **Actual-corpus build + read-back** (`evidence/2026-10-18-local-evidence-qualification.json`):
  809/809 persons ready, 13,589 person-source associations, 13,249 distinct
  records, **49,342 evidence entries per distinct record** (49,436 shard-side,
  where records shared across persons repeat — both definitions recorded),
  crosswalk 503 direct + 306 provider-referenced, 811 filesystem-transport
  reads, **zero external requests**, one real image opened digest-verified
  and revoked. Built package: `skaists.preservation-local/1`.
- **The 314 held images imported through their recorded associations.** All
  314 files re-hashed from actual bytes and matched the private manifest
  (84,055,524 B) before import. 308 carry queue-recorded record associations
  → 333 artifact entries (23 images serve multiple records) → **308
  digest-addressed objects, 390 shard associations** in the built edition.
  Six images stay unimported because no recorded association exists (the
  control ark `33S7-9GY8-1XT` and five fetched outside the queue) — the
  builder's own no-guessing law; they are named in the receipt.
- **Browser-engine E2E: 36/36 on real Chromium** (`node e2e/bdata-phase-e.mjs`
  on this box; the delivery's sandbox had no Chromium). Includes the new
  local-custody gates: above-wave file custody without quote/signer/intake
  calls, IndexedDB recovery after reload, and merkle publication refusal
  before any network or signer call.

## Environment notes (honest)

- The built working edition stays on the private tier (it holds Class I
  transcription values per the #461 rights partition); only this receipt and
  the code are public.
- Windows ACL behavior of restore modes remains host-verified only via WSL;
  no ACL claim is made.
- Native desktop IPC host integration remains open as the delivery stated;
  the reader exercised here uses the same-origin package host.

Zero FamilySearch requests; the automation stop and ANT publication holds are
untouched. No wallet, no spend, no upload.
