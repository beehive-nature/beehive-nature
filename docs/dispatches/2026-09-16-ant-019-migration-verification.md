# ANT v0.19.0 file-based chunk-store migration — source-verified, headroom verdict (2026-09-16)

Founder mission (read-only, no node upgrade until headroom is evidenced).
Daily watch context: **root disk 90% ALERT** (4.6G free) — a finding in its
own right; the ANT store sits in its own fence.

## The release is real and brand new (FACT)

- `ant-node 0.19.0` published to crates.io **2026-09-16T00:29Z** (today);
  our box runs **0.18.1** (`ant-node --version` on box). No GitHub stable
  release bundles it yet (latest stable-2026.2.3.2 ships `antnode v0.4.17`
  — a different binary line; the crate versioning is the community's "v0.19").
- Source verified from the published crate archive itself (not community
  reports): `storage/migration.rs` (3,142 lines), `storage/chunk_store.rs`,
  `storage/file_store.rs`, `storage/migration_signal.rs`.

## What the migration actually does (source-cited)

- **Off LMDB onto files**: chunks move from the legacy LMDB environment
  (`chunks.mdb` — our box holds **5.0G** of it) to one-file-per-record
  (key-as-filename). LMDB's law drives the design: *"LMDB never returns a
  deleted page to the filesystem. Disk comes back exactly once, when
  `chunks.mdb` is removed whole."* No compaction escape (needs free space
  equal to live data — same condition).
- **Three-release choreography** (their table): first release withholds the
  close-group penalty; **0.19.0 is the "migrate" release** —
  `RELEASE_RETIRE_LEGACY = true` by default, with a documented canary
  override `ANT_MIGRATION_RETIRE_LEGACY=0`.
- **Peak temporary disk** — the community report is CONFIRMED: reads serve
  the **union** of both stores; the legacy env is pinned never-grows while
  the file store fills. Peak ≈ legacy size + live-chunk payload (~2× live
  data in the worst case) **until retirement deletes `chunks.mdb` whole**.
- **The safety valve that changes our verdict**: `copy_batch` *"stops as
  soon as free space would fall below slack above the configured reserve,
  so a migration never fills the disk it is trying to free"* — defaults:
  `copier_slack_mb = 2048`, `disk_reserve = 500 MiB`, throttle 32 MiB/s.
  On `stopped_for_space` the node **sheds** chunks it may give up (by
  close-group rank, furthest-first; only the 6th/7th-closest ranks are
  eligible; requires peers proving possession + a reduced commitment the
  close group has received + `shed_hold` 72 h default, retire delay ≥ 4 h).
- **Verify/delete sequence**: namespace flush (durability) BEFORE reading;
  full per-key verification of every legacy key against the file copy with
  the health generation stamped before the pass; retirement blockers
  (still-answerable keys veto); a final live-routing re-check re-copies
  must-keep keys immediately before deletion; then `chunks.mdb` removed
  whole (`freed_bytes` logged; "migration complete" event).
- **Rollback/failure**: state persisted in `migration-state.json` (schema
  1) but re-derived from the filesystem at every start; marker/file-count
  mismatch → restart from the copying stage; the pinned legacy env accepts
  rollback copies only from pages it already has; interrupted at any point
  the node keeps serving (union) with the legacy env intact. No data-loss
  path found in the gating logic (the module's own two-loss-modes analysis
  matches the code paths read).
- **Final storage difference**: after retirement, disk = file store only.
  Neo's "can end below the old layout" is directionally consistent with
  the source (LMDB page slack + mapsize returned at once); magnitude is
  per-node. Kept as INFERENCE, not measured here.

## Buzz Box comparison (FACT) — headroom verdict

| resource | value |
|---|---|
| fence volume (/mnt/ant-store, loop) | 5.9G total · **418M free (93%)** |
| legacy `chunks.mdb` | **5.0G** |
| copier needs free (slack 2048MB + reserve 500MiB) | **~2.5G before it copies earnestly** |
| full in-place copy target | ≈ live chunk payload (order 4–5G) |
| root disk (where the loop file lives) | 90% ALERT, 4.6G free |

**Verdict: upgrade NOT evidenced — do not upgrade the node.** With 418M
free inside the fence, `copy_batch` stops for space immediately; the
migration would proceed only by **shedding most of the node's chunks**
(a multi-day, close-group-gated shed at 72h holds) or stall with both
stores held. Safe paths, in preference order: (1) enlarge the fence
volume — but root has only 4.6G free and is itself at 90% (the disk
finding blocks this too); (2) if an upgrade is ever forced earlier, run
with `ANT_MIGRATION_RETIRE_LEGACY=0` (documented canary switch) so the
node holds both stores without deleting, until headroom exists; (3)
accept a shed-heavy migration deliberately — a founder decision, not an
SRE default, because it materially shrinks what our node holds.

## Standing posture

- Node stays on 0.18.1. The daily watch gains the fence check
  (`/mnt/ant-store` ≥93% alert) and a crates.io/regression eye on
  ant-node > 0.19.0 (the "third release" that restores the close-group
  penalty — a reason not to linger forever at hold-both).
- The **root-disk 90%** finding remains open from today's watch — class
  YELLOW (cleanup candidates exist: 5.1G/5.9G is the fence's loop FILE on
  root; llama builds, journals). Named for coordination, not acted on.
