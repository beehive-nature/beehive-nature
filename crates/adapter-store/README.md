# adapter-store — the engine-neutral embedded-storage seam

NO-SERVER-DB (founder ruling 2026-10-13, SKV lane): BNR sovereign nodes
run storage as **in-process libraries**. No database daemon, no
centralized database endpoint, no privileged database operator. The
seam's constructors take a filesystem path and nothing else — no DSN,
host or port exists anywhere in the trait, so a server-database backend
cannot be expressed through it.

- **SQLite** (`rusqlite`, bundled, WAL + `synchronous=FULL` read back at
  open) — the REFERENCE implementation.
- **SurrealKV 1.0** (`surrealkv = "1"`, crates.io, Apache-2.0) — the
  CANDIDATE, behind the default `surrealkv` feature. SurrealKV's own
  durability default is Eventual; this adapter pins
  `Durability::Immediate` on every transaction, making the Eventual
  default unreachable through the seam. The adapter drives the engine's
  async commit on a private current-thread runtime (entered per call —
  the engine's sync-signatured `build()` spawns tasks internally).

Neither engine receives authority over identity, consensus, receipts or
peer discovery. The seam stores bytes and returns bytes; semantics live
above it, in the kernel. Both engines are replaceable leaves — the
portability test keeps that claim executable instead of rhetorical.

## First executable receipts (2026-10-13, this box, Windows x86_64)

`cargo test -p adapter-store -- --nocapture`

| gate | receipt | result |
| --- | --- | --- |
| SKV-1 autonomous recovery | `tests/skv1_crash_recovery.rs` — child hard-killed mid-write at 150/400/800 ms, × both engines | 6/6 PASS: zero torn values, zero lost acknowledged commits, engine structural check ok on reopen |
| SKV-4 portability | `tests/skv4_portability.rs` — 1000 puts + 100 deletes, export/reconstruct, both directions | 2/2 PASS: 900 entries byte-identical, checksums equal both ways |
| NO-SERVER-DB run condition | `tests/noserverdb_sockets.rs` — child's listening sockets enumerated from the OS's own tables while it works | PASS: 10/10 live samples, zero listening sockets (netstat on Windows, /proc on Linux) |

Receipts are verdicts from observations only: the crash test reads what
actually survived the kill, the portability test compares actual scan
bytes, the socket test samples the OS tables. A vacuous pass fails the
suite (the child must be observed alive; an unreadable observation is a
failure, never a skip).

## TAM boundaries, named

- Crash tests exercise **process death** (hard terminate). Power-loss
  durability is a different slice — NOT RUN, not claimed. On a healthy
  machine an unfsynced write also survives process death, so these
  receipts prove recovery consistency and atomicity, not fsync physics.
- The socket observation asserts what it can see: no LISTENING sockets
  attributable to the working process. It cannot assert the absence of
  sockets opened and closed between samples.
- SurrealKV 1.0 exposes no durability getter; the pin is per-transaction
  in the only write path (L5: the behavioral crash evidence carries the
  claim, configuration intent alone never does).

## Not built, not run (later beats)

SKV-2 network partition, SKV-3 sovereignty (key custody), SKV-5
scale/longevity (bounded growth, pruning, migration, replay; aarch64 and
post-Linux runtimes). The versioned-query surface (`get_at`/`history`)
is deliberately NOT in the trait yet — receipts stay the estate's own
canon (BEELOG), and engine version history is not tamper-evidence.

## Provenance

Lane dispatches: `docs/dispatches/2026-10-13-surrealkv-storage-adapter.md`,
`docs/dispatches/2026-10-13-surrealkv-no-server-db-ruling.md`, and the
milestone dispatch of this beat. Vendor benchmark claims (7.95× reads /
6.10× updates vs RocksDB, single runs, one Threadripper box) stay
VENDOR-REPORTED; no estate-hardware benchmark has run.
