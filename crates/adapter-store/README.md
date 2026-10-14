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
| SKV-1 autonomous recovery | `tests/skv1_crash_recovery.rs` — child hard-killed mid-write at 150/400/800 ms, × both engines | 6/6 PASS: recovered state EXACTLY equals the deterministic replay of the committed prefix; zero torn values; engine structural check ok on reopen |
| SKV-2 network denial | `tests/skv2_network_denial.rs` — bounded 2000-op run + recovery, child's sockets (ANY state, TCP+UDP) enumerated from OS tables | PASS both engines: workload completes, zero sockets ever, exact full replay. Denial leg runs under `unshare -rn` (rootless netns) on Linux; where unavailable the receipt names `denial=none-available` and carries the all-state observation leg only |
| SKV-3 authority-negative | `tests/skv3_authority_negative.rs` — the seam cannot acquire identity/signing/settlement authority | PASS: declared deps exactly {rusqlite, surrealkv, tokio}; zero network/key tokens in source. Transitive engine capability (tokio IO) named — runtime behavior covered by SKV-2; authority itself is architectural law: storage retains bytes, BNROSE governs authority |
| SKV-4 portability | `tests/skv4_portability.rs` — 1000 puts + 100 deletes, export/reconstruct, both directions | 2/2 PASS: 900 entries byte-identical, checksums equal both ways |
| NO-SERVER-DB run condition | `tests/noserverdb_sockets.rs` — listening sockets enumerated from the OS's own tables while the child works | PASS: 10/10 live samples, zero listening sockets |
| runtime lifecycle | `tests/skv_life_runtime.rs` — 4 concurrent writers × 1500 deterministic ops + 2 concurrent readers, 2 s idle, post-idle commit, orderly close, fresh reopen | PASS both engines: zero torn values under concurrency, post-idle commit lands (no starvation), close orderly, reopen clean, state EXACTLY equals the full per-thread replay |

The crash model was itself convicted red-first, on the first Linux CI
run: an unacked trailing batch (legal commit-before-ack) carries a
tombstone that deletes a key the acked-only replay expects live —
misread as "acknowledged commit lost". Every op puts its own key, so
the largest present-or-acked index reveals the committed prefix; the
expectation replays ops `0..=committed` and compares EXACTLY, which
subsumes torn-value, lost-commit and phantom-key detection.

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
- The socket observation asserts what it can see: sockets attributable to
  the working process across live samples (listening-only in the
  NO-SERVER-DB receipt; ALL states in the SKV-2 receipt). It cannot
  assert the absence of sockets opened and closed between samples; the
  Linux `unshare -rn` denial leg closes that gap where it runs — the
  receipt names its leg honestly on every platform.
- SurrealKV 1.0 exposes no durability getter; the pin is per-transaction
  in the only write path (L5: the behavioral crash evidence carries the
  claim, configuration intent alone never does).

## Not built, not run (later beats)

SKV-5 scale/longevity (bounded resource growth, pruning, version
migration, rollback, interruption during migration), the six
sovereign-service independence tests, aarch64 and post-Linux runtimes,
and power-loss durability (process-kill receipts are valid within the
process-death model; they do NOT establish persistence through power
interruption, filesystem corruption or device write-cache failure).
The versioned-query surface (`get_at`/`history`) is deliberately NOT in
the trait yet — receipts stay the estate's own canon (BEELOG), and
engine version history is not tamper-evidence. The exact-replay oracles
assume sequential, uniquely identifiable operations — true for this
harness; named so the assumption cannot silently broaden.

## Provenance

Lane dispatches: `docs/dispatches/2026-10-13-surrealkv-storage-adapter.md`,
`docs/dispatches/2026-10-13-surrealkv-no-server-db-ruling.md`, and the
milestone dispatch of this beat. Vendor benchmark claims (7.95× reads /
6.10× updates vs RocksDB, single runs, one Threadripper box) stay
VENDOR-REPORTED; no estate-hardware benchmark has run.
