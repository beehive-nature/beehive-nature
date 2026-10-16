# 2026-10-13 — NO-SERVER-DB ruling banked: embedded engines only, six sovereign services named, every SKV gate runs daemon-free

Founder ruling 2026-10-13 (second beat of the SurrealKV storage-adapter
lane; first beat = `2026-10-13-surrealkv-storage-adapter.md` @0f9b51381).

## The ruling (canon, condensed; the paste governs)

- **BNR is not serverless — it is free of centralized server control.**
  The sovereign "servers" are the autonomous service peers themselves:
  x0x (execution/coordination/routing), ZK-validators (independent
  cryptographic verification), b-index (distributed discovery, indexing,
  reconstruction), b-domain (sovereign naming/resolution without
  mandatory centralized DNS), b-meter (verifiable resource accounting
  and receipts), rustEOSvmSMARTwallet (self-custodial identity,
  authorization, transaction execution).
- **Revised charter tags: `NO-CENTRAL-CONTROL`, `NO-SERVER-DB`,
  `AUTONOMOUS-P2P-SERVICES`.**
- **No server databases in BNR.** Excluded: SurrealDB Server,
  PostgreSQL, remotely hosted SQLite, centralized database clusters,
  database-as-a-service. Permitted architecture: BNROSE Rust kernel
  (sovereign state/policy) → embedded local storage (SurrealKV or
  SQLite as replaceable in-process libraries, never a database service)
  → Autonomi (decentralized encrypted persistence/recovery) →
  decentralized consensus where required → bMeter cryptographically
  verifiable receipts.
- SQLite through rusqlite is acceptable ONLY as an embedded library.
  SurrealKV is evaluated ONLY as an embedded Rust engine, never through
  SurrealDB Server.
- **SKV constraint `NO-SERVER-DB`:** every SKV-1..SKV-5 test must run
  without a database daemon, centralized database endpoint, or
  privileged database operator.
- Post-Linux/post-cloud/post-server/post-DNS means none of those may be
  REQUIRED for continuity: Linux machines and cloud hosts may
  participate as interchangeable execution environments; they cannot be
  indispensable authorities (SPEC-BTUNGSTEN-1 axis 1).
- The decisive bTunGsTeN question, verbatim: "Can all six services
  continue, recover and independently verify their state after every
  centralized dependency has been removed?" — the standard for the
  10B-user, 1,000-year objective.

The founder's own honesty boundary, banked: this is the architectural
REQUIREMENT, not yet proof that every deployed service satisfies it;
full decentralization must be DEMONSTRATED (any operator, host, DNS
provider or privileged coordinator can disappear without taking the
network down), and independence from Linux itself requires VERIFIED
ALTERNATE RUNTIMES — axis 6 runtime extinction, NOT RUN anywhere in the
estate today.

## In-tree sweep receipt (new evidence this beat, tree at 0f9b51381)

Server-database dependency sweep of the whole tree
(`git grep -iE "postgres|mysql|mongodb|redis|sqlx|diesel|dynamodb|…"`
over all `*.toml`; same class over `package.json`):

- **Exactly one hit: `crates/bmesh-serve/Cargo.toml` — optional
  `tokio-postgres` behind `--features postgres`** (its own comment:
  "deliberate scale choice, armed only by --features postgres"; default
  is embedded sqlite). Under today's ruling the armed configuration is
  the excluded class. NOT touched from this seat (other lanes' WIP;
  worktree law). Named disposition for the bmesh lane's next beat:
  remove the feature, or explicitly dock the crate as non-BNR tooling —
  founder/lane call, recorded here so it cannot be silently inherited.
- JS/package.json sweep: clean (no pg/mysql/mongodb/redis/orm clients).
- `crates/bindexer` rusqlite = embedded, bundled, in-process —
  compliant with the ruling as written (read-only indexer, keyless by
  construction).
- False positives named for the record: bcomb / bpq-device-xcheck /
  capability matched the word "oracle" in prose, not database drivers.

## Six services → in-tree homes (status honest at read 2026-10-13)

| service | in-tree home | status at read |
| --- | --- | --- |
| x0x | `ops/x0x/` (systemd node on the oracle box, capped) | LIVE on the box, v0.45.0-era |
| ZK-validators | `contracts/zkreceipts/` | live v4 confirmation GREEN (Jungle4), follower four-receipt gate |
| b-index | `crates/bindexer/` | read-only chain indexer, embedded sqlite |
| b-domain | `contracts/bdomain2/` | on-chain contract (naming/resolution with no mandatory DNS) |
| b-meter | `crates/bmesh-meter/` + vending meter tooling | crates in-tree |
| rustEOSvmSMARTwallet | EOSVM-WALLET-001 (CLOSED comparison-candidate) → successor BNROSE-RUST-001 | PR #411 OPEN at read |

This table is a map, not a claim: per the founder's boundary above,
deployment independence is unproven until each service's
remove-everything test runs.

## SKV gate amendment (binding on the harness, not just the engine)

All five gates (SKV-1 autonomous recovery, SKV-2 partition, SKV-3
sovereignty, SKV-4 portability, SKV-5 scale/longevity) now carry
`NO-SERVER-DB` as a run condition: no database daemon, no centralized
database endpoint, no privileged database operator — in-process
embedded engines only. Per L5 (configuration intent is never runtime
evidence), the harness must OBSERVE this, not assume it: no listening
DB sockets attributable to the test, no external DB endpoints in the
effective config, engine linked into the node process. The
Immediate-durability pin-and-prove obligation (first beat, fact 5)
rides unchanged.

## Boundary not crossed / routing

No code changed; no dependency removed (the bmesh-serve tension is
named and routed, not unilaterally edited). The canon edit — writing
the six-services question and NO-SERVER-DB into SPEC-BTUNGSTEN-1 —
belongs to the tungsten lane's branch (`zcode/btungsten-watch-
reconciliation-2026-10-10`), recorded here verbatim for that beat.
Lane routing stands: engine-neutral trait seam (contract now includes
in-process-only, no client-server DB drivers in the adapter family) →
red-first SKV harness with daemon-free run receipts → estate-hardware
reproduction → founder-gesture promotion.

Dispatched from worktree C:/Users/travi/wt-zcode-surrealkv, branch
zcode/surrealkv-storage-lane-2026-10-13.
