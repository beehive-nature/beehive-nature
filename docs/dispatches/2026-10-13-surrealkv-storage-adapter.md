# 2026-10-13 — SurrealKV storage-adapter lane: charter banked, release-day facts verified, five gates named (SPECIFIED / NOT BUILT / NOT RUN)

Order (founder, verbatim opening): "this is a new lane and you are first.
good luck godspeed" — followed by the charter paste (SurrealKV 1.0
evaluation for BNR/bMESHasi). This dispatch is the lane's founding beat:
the charter is banked below, every externally checkable claim was checked
on release day, and the five test conditions are named as gates. **No
code was built, no dependency added, no benchmark run by this seat** —
per SPEC-BTUNGSTEN-1 §measurability, a property with no receipt is a
hypothesis, not a result.

## The charter (founder ruling, condensed; the paste is canon)

- BNR needs transactional data but will NOT build another database and
  will NOT run a centralized database service.
- SurrealKV solves LOCAL transactional storage, never decentralized
  global agreement. A successful disk commit on one node does not mean
  other nodes agree, can retrieve, or will preserve.
- Adopt a storage-engine-NEUTRAL architecture; SurrealKV is a candidate
  behind a replaceable local adapter, benchmarked, not mandated.
- It does NOT replace Autonomi (decentralized persistence), consensus,
  decentralized identity, or independently verifiable receipts.
- Layer fit: bMESHasi Rust kernel (state machines/policy) → SurrealKV
  (local durable transactional state) → Autonomi / Filecoin / Arweave /
  blockchain settlement / bMeter-bPay receipts / bQueenBee-RAiD as the
  charter's table assigns.
- Licensing: standalone engine (Apache 2.0) is the candidate; the BSL 1.1
  SurrealDB server is not part of the candidate.
- Architecture conclusion, verbatim: "BNR does not need to invent another
  RocksDB or SurrealKV. It needs to ensure that no single database
  implementation becomes indispensable." That is SPEC-BTUNGSTEN-1 axis 1
  and §toolchain's replaceability law applied to the storage layer, and
  L3's no-indispensable-component rule applied below the kernel.

## External facts — checked 2026-10-13 (release day) at primary sources

VERIFIED (blog https://surrealdb.com/blog/we-are-replacing-rocksdb-with-surrealkv-1-0
+ repo https://github.com/surrealdb/surrealkv, both read today):

1. **Release.** SurrealKV 1.0 announced 13 October 2026, during
   SurrealDB launch week (Oct 12–16); it becomes the default persistent
   engine in SurrealDB 4. It is a log-structured merge-tree with
   snapshot-isolated transactions, written in Rust.
2. **License of the engine.** surrealdb/surrealkv README/LICENSE:
   "Licensed under the Apache License, Version 2.0." VERIFIED.
3. **Standalone use.** README: "an independent, standalone key-value
   store suitable for high-throughput server workloads, embedded systems,
   and desktop applications" — no SurrealDB server required. VERIFIED as
   the vendor's own claim and consistent with the crate design.
4. **SurrealDB server license split.** surrealdb/surrealdb README:
   "Core database code for SurrealDB, located in this repository, is
   released under the Business Source License 1.1," while SDKs and
   component repos carry Apache-2.0/MIT. VERIFIED as stated; the BSL
   Change Date / grant text was NOT read from the LICENSE file this beat
   — UNREAD, next beat if the server ever matters (it is not the
   candidate).
5. **Durability default — the finding that changes test design.** The
   engine's README states commits default to Eventual durability;
   synchronous durability requires `set_durability(Durability::Immediate)`
   — an OPT-IN. Every headline benchmark and every BNR durability gate
   assumes Immediate. SPEC-BTUNGSTEN-1 L5 (configuration intent is never
   runtime evidence) therefore applies on its face: any BNR adapter must
   PIN Immediate and PROVE it at runtime per instance, never inherit it
   from intent. This is the one fact the charter's paste did not carry.

VENDOR-REPORTED — fenced, NOT BNR-VERIFIED (all figures the vendor's own
crud-bench harness, "Each figure is a single run", on ONE machine:
AMD Ryzen Threadripper 9970X 32c/64t, 128 GB RAM, 4 TB NVMe; 500,000
keys, 48 worker threads, 128 clients; harness ran value separation ON
and a larger-than-default memtable; the vendor invites reproduction):

| operation (synchronous durability) | SurrealKV | RocksDB | claim |
| --- | --- | --- | --- |
| point reads | 6,804,864 ops/s | 855,851 | 7.95× |
| creates | 229,376 | 8,568 | 26.8× (vendor declines to headline: "we have not explained why") |
| updates | 221,341 | 36,263 | 6.10× |
| deletes | 264,089 | 32,043 | 8.24× |
| scans | 905,132 | 852,661 | 1.06× |

Without sync durability the write story INVERTS: SurrealKV 1.88× slower
creates, 2.22× slower updates, 2.41× slower deletes than RocksDB (reads
still 8.26× faster). The performance case for SurrealKV is specifically
the Immediate-durability path BNR receipts require — convenient if true,
but it makes the durability pin (fact 5) load-bearing for the perf case
too. Fjall/ReDB/LMDB/libmdbx were excluded from the sync table ("too
slow to finish"). Vendor also claims 221 MiB memory at rest, "the lowest
of the engines tested."

VENDOR-DOCUMENTED features — NOT EXERCISED by this seat (crypto wording
caps apply; these are the vendor's claims about its own code, cited, not
verified): versioned queries (`get_at`, `history`, configurable
retention) — useful for bMeter receipts and agent state per the charter,
but version history is NOT tamper-evidence (no signature or Merkle
structure claimed; BNR receipts keep the estate's own canon — BEELOG,
RFC 6962/9162 exact, per the bzDiD lane law: never re-derive from
memory); encryption at rest AES-256-GCM or XChaCha20-Poly1305 via a
KeyManager — local encryption at rest is NOT end-to-end privacy (charter
distinction, banked); commit-ring grouped commits (a burst costs at most
one fsync); CRC32 checksums + scrub; deterministic simulation testing
(2.5M operations in CI). GitHub Releases page was EMPTY at read time —
"1.0" is the crates.io version line (`surrealkv = "1"`); any future
build pins the exact version.

## In-tree facts (receipts at origin/main tip e5945069d, 2026-10-13)

1. **Incumbent local engine = SQLite.** `git grep -ilE
   "rocksdb|sled|redb|lmdb|sqlite|surrealkv" -- "*.toml" "*.rs"` matches
   exactly two crates: `crates/bindexer` (read-only chain indexer,
   rusqlite 0.32 bundled) and `crates/bmesh-serve` (journal, sqlite
   default, postgres an explicit optional feature). No rocksdb, sled,
   redb, lmdb or surrealkv anywhere on main. Consequence: gate SKV-4's
   "second Rust engine" for export/reconstruction can be the ALREADY
   IN-TREE rusqlite — the portability gate needs no new dependency.
2. **Adapter convention exists; the storage seam does not.** `crates/`
   carries adapter-arweave, adapter-autonomi, adapter-carrier,
   adapter-lti, adapter-pixellab — the estate's own naming for
   replaceable edges. There is NO engine-neutral storage-trait crate
   today; that seam is the lane's first build beat.
3. **Kernel consumer.** PR #411 (BNROSE-RUST-001, the first BNRoSe Rust
   execution core) was OPEN and unmerged at read (2026-10-13). The
   adapter's consumer-of-record when that lands; nothing in this lane
   blocks on it and vice versa.
4. **Canon location.** SPEC-BTUNGSTEN-1.md (axes, L1–L5, §measurability,
   §toolchain replaceability, WB001–WB004 sequence) lives on branch
   `zcode/btungsten-watch-reconciliation-2026-10-10` (read from worktree
   C:/Users/travi/wt-zcode-btungsten) — NOT on main at read time. This
   lane cites it; merging that canon is the tungsten lane's business.

## The five gates (charter's conditions, named; SPECIFIED / NOT BUILT / NOT RUN)

- **SKV-1 Autonomous recovery** (axis 3). Kill a node during a write;
   recover its journal; reconcile independently verifiable state.
- **SKV-2 Network partition** (axis 3). Conflicting writes on
   disconnected nodes must NOT silently become authoritative on
   reconnect.
- **SKV-3 Sovereignty** (axes 1–2; WB002 killer-invariant spirit). All
   encrypted data, credentials and keys remain under the appropriate
   user's authority; KeyManager custody proven, not assumed.
- **SKV-4 Portability** (axis 6 replaceable adapters). Export and
   reconstruct state through a second Rust engine (in-tree rusqlite),
   with NO SurrealDB dependency anywhere in the path.
- **SKV-5 Scale and longevity** (axes 5+6, law L1). Bounded storage
   growth, pruning, migration, replay and recovery. A 500,000-key
   vendor run establishes nothing for 10B active sovereigns across
   1,000 years. Scale legs stay box-gated per the WB sequence's own
   routing; the oracle box is aarch64, the vendor ran x86 — cross-arch
   comparability is named, not assumed.

Standing distinctions fixed by the charter, restated as lane law: local
commit ≠ global agreement; encryption at rest ≠ end-to-end privacy;
version history ≠ verifiable receipts; and no single database
implementation may become indispensable.

## Boundary not crossed

No SurrealKV dependency was added to any manifest. No benchmark was run
on estate hardware (NOT RUN; a reproduction beat exists only after the
seam exists, so numbers attach to the adapter, not to curiosity). No
performance claim above is BNR-verified; every number is the vendor's
own single run, fenced as such. No test in this lane has executed;
SKV-1..5 are specified conditions awaiting a harness. Promotion of the
SKV family into the numbered WB series is the tungsten lane's and
founder's call, not this seat's.

## Routing (next beats, in order)

1. Engine-neutral storage-trait seam crate under `crates/`
   (adapter-naming convention), with the Immediate-durability
   pin-and-prove obligation as part of the trait contract (L5).
2. Red-first harness skeleton for SKV-1..5 — verdicts computed from
   observations only, pass/fail named before runs, machine-verifiable
   receipts (the tungsten harness law).
3. Benchmark reproduction on estate hardware only after (1), attached
   to the adapter; single-run numbers never cited as estate evidence.
4. Promotion decision — founder gesture, after green gates.

Dispatched from worktree C:/Users/travi/wt-zcode-surrealkv, branch
zcode/surrealkv-storage-lane-2026-10-13, base origin/main e5945069d.
