# DEPENDENCIES — B9 evidence lane (2026-10-29)

## Dependency-removal matrix

This lane adds, removes and upgrades zero project dependencies. The
evidence set is data plus one stdlib-only Python checker.

| Item | Change | Evidence |
|---|---|---|
| `Cargo.toml` / `Cargo.lock` (any crate) | none touched | `git status` shows only `docs/dispatches/` paths |
| Harness Rust modules (`b9.rs`, `switch.rs`, `identity.rs`, …) | none touched | owned subtree is fixtures + evidence docs + dispatch |
| Shared instructions / repo config | none touched | same |
| New runtime dependencies | none | `check_manifest.py` / `make_manifest.py` use stdlib `hashlib`, `json`, `sys`, `pathlib` only |
| Telemetry / network clients in evidence path | none | hash + count are local; no sockets, no paid calls |
| Server database | none created | B9 verification takes frozen bytes + receipt + public material |

Removal test: delete every file this lane added and the tree is the
plain `059e16f27` candidate — nothing else references them.

## ANT version / provenance table

Toolchain observed in this worktree while freezing the fixture
(`--version` outputs, this session):

| Tool | Version | Provenance |
|---|---|---|
| `cargo` | 1.98.1 (797e8a9bc 2026-08-05) | installed toolchain; matches H01 pinned 1.98.1 |
| `rustc` | 1.98.1 (48a229cea 2026-09-01) | same toolchain as cargo |
| `python` | 3.12.10 | fixture generator + independent checker interpreter |
| `git` | 2.55.0.windows.2 | worktree, hashing (`hash-object`), base records |
| `bsigner` artifact | not re-recorded here | owned by H01 / Wonder harness seats; see H01 dispatch |

No ANT (Autonomi) node, API key, or paid provider was used or needed:
fixture freezing is fully offline. Live-run receipts (provider, payer,
usage) attach only after an actual run per `CAPTURE-PROCEDURE.md` §7.
