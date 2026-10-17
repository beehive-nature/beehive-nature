# 2026-10-13 — SKV milestone delivered: the embedded-storage trait, two interchangeable implementations, first executable comparison receipts

Third beat of the SurrealKV storage-adapter lane. Founder directives
accepted verbatim (including the workflow correction: promotion of
SurrealKV does NOT route to a founder gesture — it depends on
independently reproducible bTunGsTeN evidence and the repository's
authorized qualification process; my earlier routing was wrong and is
withdrawn). This beat delivers the named milestone: **the trait, two
interchangeable embedded implementations, and their first executable
comparison receipts.**

## Built (crates/adapter-store, new workspace member)

- **The trait** (`EmbeddedStore`): engine-neutral, path-only
  constructors — no DSN/host/port exists in the seam, so a
  server-database backend cannot be expressed through it (NO-SERVER-DB
  at the type level). `write_batch` is atomic and durable-on-return;
  `scan_prefix` is the export basis. Neither engine receives authority
  over identity, consensus, receipts or peer discovery.
- **SQLite reference implementation** (rusqlite 0.32 bundled, in-process
  only): WAL + `synchronous=FULL`, both read back at open (L5).
- **SurrealKV 1.0 candidate** (crates.io `surrealkv = "1"`, Apache-2.0,
  behind the DEFAULT `surrealkv` feature so CI always tests both — an
  untested candidate is prose). `Durability::Immediate` pinned on every
  transaction; SurrealKV's Eventual default is unreachable through the
  seam. The engine's commit is async and its sync-signatured `build()`
  spawns tasks internally, so the adapter owns a private current-thread
  runtime entered per call — recorded as an integration fact the vendor
  README does not carry.
- `skv-child` binary: the crash-test workload (durable batch + fsync'd
  ack line, forever until killed).

## Receipts — observed outcomes, printed by the runs themselves

`cargo test -p adapter-store -- --nocapture` (this box, Windows
x86_64, cargo 1.98.1), final post-format run:

- **SKV-1 autonomous recovery (6/6 PASS)** — child hard-killed mid-write
  at 150/400/800 ms, both engines, then reopened:
  `torn=0 missing=0 integrity=ok` on every receipt. Sample rows:
  `engine=surrealkv delay_ms=800 acked=616 present=547 expected=547`,
  `engine=sqlite delay_ms=800 acked=623 present=554 expected=553
  extras_unacked=1` (an unacked-but-committed batch — legal under the
  TAM, counted honestly). Tombstones ride the same path (every 8th
  batch deletes a key written 64 steps earlier).
- **SKV-4 portability (2/2 PASS)** — 1,000 puts + 100 deletes, export
  via scan, reconstruct in the OTHER engine, both directions:
  `entries=900 byte_equal=true`, one identical ordered checksum
  (fnv1a64:3c925e1904e342b3) across BOTH engines and BOTH directions —
  the two implementations are interchangeable on the same corpus, by
  bytes, not by claim.
- **NO-SERVER-DB run condition (PASS)** — while the workload child is
  alive, its LISTENING sockets are enumerated from the OS's own tables
  (netstat -ano on Windows; /proc/net/tcp{,6} ∩ /proc/<pid>/fd on
  Linux): `samples=[0×10] max_listening=0`. Observed, not assumed (L5).

Red-first facts this beat convicted before green (all repaired in-tree):
`"50_000"` does not parse as an integer; a dead-instant child produced
a VACUOUS socket-test pass — now a <3-live-samples run FAILS by name;
SurrealKV 1.0 panics outside a Tokio context despite sync signatures.

## TAM boundaries, named

Crash receipts exercise PROCESS DEATH (hard terminate): they prove
recovery consistency and atomicity — every acknowledged commit survives,
no torn values — not fsync physics. Power-loss durability is a different
slice, NOT RUN. On a healthy machine unfsynced writes also survive
process death; distinguishing Eventual from Immediate under power loss
needs fault injection this beat does not have. The socket observation
asserts no listeners attributable to the working process across 10
samples; it cannot see sub-sample churn. SurrealKV 1.0 exposes no
durability getter — the per-transaction pin is in the seam's only write
path, and the behavioral crash evidence carries the claim (L5).

## Status vs the founder's table

- Embedded storage contract: **BUILT** (this beat; previously "Not built").
- SKV-1..5 qualification: **SKV-1 first receipts GREEN (process-death
  slice); SKV-4 first receipts GREEN; SKV-2, SKV-3, SKV-5 NOT RUN.**
- PostgreSQL retirement: **ROUTED** to the bmesh owner as issue #420
  (remove the optional feature or isolate outside sovereign runtime
  paths; acceptance criteria in the issue).
- SurrealKV promotion: **no founder gesture** — independently
  reproducible bTunGsTeN evidence + the repository's authorized
  qualification process (workflow correction banked).
- Service independence (six services, centralized-dependency removal):
  recorded as the standard's decisive question; NOT RUN this beat.
  aarch64 alone does not establish post-Linux portability.

## Routing (next beats)

1. SKV-2 partition semantics at the seam (conflicting writes must not
   silently become authoritative) and SKV-3 key custody (KeyManager
   sovereignty) — red-first, observed outcomes.
2. SKV-5 bounded-growth/pruning/replay; aarch64 run on the oracle box;
   estate-hardware benchmark reproduction attached to the adapter
   (vendor numbers stay fenced).
3. bmesh owner: issue #420.
4. Kernel consumer: PR #411 (BNROSE) when it lands — the seam is ready
   to sit under it; nothing in this lane blocks it.

Dispatched from worktree C:/Users/travi/wt-zcode-surrealkv, branch
zcode/surrealkv-storage-lane-2026-10-13.
