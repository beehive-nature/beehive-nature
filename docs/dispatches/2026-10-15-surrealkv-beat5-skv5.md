# 2026-10-15 — SKV beat 5: upstream repaired and reconciled, SKV-5 delivered — bounded growth, pruning, migration with interruption, and the founder-ordered measurements

Founder order (beat 5): repair SKV-1 upstream, reconcile #422 with
main for an exact-head CI verdict, then advance SKV-5 as the
highest-value next qualification. All three executed this beat.

## 1. SKV-1 upstream repair — adopted from #438, verified, extended

The defect (founder-named, confirmed in #435's CI run 38728617952):
`max(present ∪ acked).unwrap_or(0)` collapsed an EMPTY history into
"operation 0," so a kill landing before the first commit read as a lost
commit (`acked=0 present=0 expected=1`) on a slower runner.

Sibling seat PR #438 (corrective into #422) carried the repair: the
oracle's committed prefix is `Option<u64>` — `None` expects an empty
store, `Some(0)` replays op 0; one pure `judge` shared by crash runs
and regressions; kill modes made deterministic (pre-first-commit hold
with a `ready` handshake; timed 150/400/800 ms; kill only after 96
acked ops — never vacuous); empty-startup receipts labelled
"NOT evidence that committed data survived"; a child that exits on its
own fails the test. I reviewed the load-bearing code, fast-forwarded
the lane branch to it (c43beac0f, which also reconciles main 8e7a16f9d
per directive 2), and verified locally: 10/10 SKV-1 legs PASS with
honest labels, including `committed_prefix=none` legs for both engines.
Legitimate committed-but-unacked transactions stay legal — the
committed-prefix reveal (every op puts its own key) is unchanged.

Rider on top (mine, from #438's routed finding): the SKV-2 observation
window widened 2000→20000 ops with 60 ms first sample — on their box
sqlite finished before the first sample (vacuous, correctly failing);
~230 live samples per engine here, 65 s both engines, vacuous guard
intact. The /proc-EACCES mode they saw on a restricted host stays a
named UNOBSERVABLE failure by law (CI runners read /proc fine).

## 2. SKV-5 delivered (tests/skv5_scale_longevity.rs + the migrate child mode)

Trait gains `compact()` — honest per engine: SQLite =
wal_checkpoint(TRUNCATE)+VACUUM (real reclaim); SurrealKV 1.0 =
flush_wal(true) only — **no manual leveled-compaction trigger exists in
1.0** (verified against the crate source; CompactionStrategy is
background policy). The skv-child binary gains a `migrate` mode
(scan→atomic batches of 50→fsync'd per-batch acks), killable mid-flight.

Receipts, this box (Windows x86_64):

- **sqlite**: writes=6000 live=600 logical=1,188,000 B;
  disk_peak=5,467,688 B **apparent WA 4.56×**; after 90% prune +
  VACUUM: 1,499,528 B — **strict reclaim proven**; p50 692 µs /
  p95 1.2 ms / p99 2.2 ms / max 30.8 ms; prune_exact, reopen_exact.
- **surrealkv**: same corpus; disk_peak=1,347,832 B **apparent WA
  1.13×**; p50 697 µs / p95 1.2 ms / p99 1.8 ms; prune_exact,
  reopen_exact. **Counterexample measured and kept**: after the 5,400
  tombstones, on-disk size GREW to 1,542,274 B (+14% PAST the
  pre-delete peak) — tombstone materialization; with no manual
  compaction, physical reclaim is background policy that has not run
  at this 1.5 MB scale. SurrealKV's bounded-growth assertion is
  therefore the write-phase WA ceiling (≤10×) + logical prune + reopen
  exactness; SQLite keeps the strict shrink assertion. This is an
  engine-behavior boundary recorded for qualification, not hidden.
- **migration with interruption** (both directions, sqlite↔surrealkv):
  killed after 3–7 acked batches; partial destination holds WHOLE
  batches only, every entry exact and drawn from the source (rollback
  protection — no torn batch, no foreign key, integrity ok); rerun to
  completion over the partial destination reconstructs the source
  EXACTLY (idempotent resume). A kill that lands too late retries once
  rather than accepting a completed run as interruption evidence.

Measurement boundary named: apparent WA is dir-size delta ÷ logical
bytes (includes WAL/metadata/page overhead), not a device-level count.

## 3. Distinction (founder, restated as lane law)

Process-crash recovery ≠ power-loss durability ≠ sovereign recovery
across independent peers. It stays printed in every qualification
receipt family; power-loss/write-cache durability awaits its own
fault-injection experiment and is never inferred from SIGKILL.

## Status and routing

- SKV-1 through SKV-5, NO-SERVER-DB, lifecycle: executable and green
  locally (10/10 suite binaries); CI verdict for the reconciled head
  pending at push time (watched; exact-head verdict before merge per
  the order).
- aarch64 (oracle box) + six-service independence tests: routed next,
  after the exact-head verdict — aarch64 alone does not establish
  post-Linux portability.
- #435/#436 propagation: their seats requalify each successive head;
  the reconciled base lands under them through #422's merge.
- Architectural ruling held: SQLite and SurrealKV interchangeable
  beneath `EmbeddedStore`; neither receives identity, authorization,
  consensus or recovery-policy authority; no server database.

Dispatched from worktree C:/Users/travi/wt-zcode-surrealkv, branch
zcode/surrealkv-storage-lane-2026-10-13.
