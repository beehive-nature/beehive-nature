# 2026-10-12 · BT-MESH-DEPENDABILITY-001 — bTunGsTeN mesh transport dependability

Order: founder, 2026-10-12 — `BT-MESH-DEPENDABILITY-001`, effort Extra
High. First deliverable: **a reproducible Rust-driven battery and a
measured low-overhead transport profile that preserves useful delivery and
recovery.** This dispatch opens the lane; the §Receipts section is written
by the run, not by intention. The standing daily watch and its schedule
are untouched; no new scheduled watchers ride this lane.

**Leg served (SPEC-BNROSE-0 §0.1): L2 — eternal runtime**, at the transport
seam: a mesh that a sovereign's devices can keep affordable, useful and
recoverable across replacement is a precondition for any runtime that
"can always be rebuilt."

## Ownership

ZCode seat, worktree `wt-zcode-btmd-001`, branch `zcode/btmd-001`, cut from
`origin/main` at `19ded5a3a` (2026-10-12). This lane owns exactly one new
crate — `crates/btungsten-meshdep` — plus its budgets artifact and this
dispatch's evidence directory. Nothing else in the tree is mine to touch.

## Coordination with BNROSE-RUST-001 (recorded, as ordered)

The Rust execution lane is open in parallel
(`wt-zcode-bnrose-rust-001`, branch `zcode/bnrose-rust-001`, cut from
`5c607cd6e`; dispatch `2026-10-12-bnrose-rust-001.md`). Per the order, this
lane **reuses, does not compete**:

- **Operation identities** — the canonical operation envelope is the
  WB001 `Intent` from `crates/btungsten-wb001-core` (SAW-proven codec,
  unchanged, depended on read-only). Every workload operation the battery
  injects is a canonical Intent; the delivery ledger keys on the envelope
  bytes and nonce, never on an ad-hoc payload shape.
- **Authorization boundaries** — the WB004 handoff's persistence law
  (`docs/handoffs/2026-10-13-wb004-jungle-live-settle-rust.md`, carried on
  branch `zcode/wb004-correction-2026-10-13` — cited, not depended on, that
  branch is unmerged) is adopted verbatim for transport recovery:
  missing observation = **UNKNOWN**, never permission to rebuild or
  re-send as a new operation; reconciliation may re-deliver **identical
  bytes only**; automatic replacement under uncertainty is refused; clean
  refusal (provably never landed) is distinguished from unresolved
  outcome. Transport recovery must not manufacture new authorization or
  repeat an external operation.
- **Receipt conventions** — CLAIM → EVIDENCE → BOUNDARY NOT CROSSED;
  JSONL raw receipts, immutable attempt directories, sanitized in-tree
  summaries; no hex-run violations (64-hex peer identities never appear in
  committed plaintext; raws ride gzipped, per the 2026-09-15 precedent).

No new kernel, wallet, identity system, or transport stack is created: the
battery drives the pinned upstream `x0xd` binaries as the system under
test and measures; it ships no replacement transport.

## Evidence baseline (pinned, not re-derived)

- **Upstream issue:** saorsa-labs/x0x#504 (open; P2 triage 2026-10-05 does
  not set BNR's acceptance bar). The reporter's 52 MB/min is **combined
  down+up (32 down / 20 up) ≈ 75 GB/day per idle linked device** — W@tch
  therefore ships with the x0x agent switched OFF. That is the adoption and
  dependability problem this lane works.
- **Our datasets, preserved separately, never combined:**
  - 2026-09-15, v0.45.0 release binary, public-mesh default Leaf, 300 s
    idle window, 26 peers: epidemic_forward 86.33 MB/min
    (`docs/dispatches/evidence/2026-09-15-x0x-505-504/`).
  - 2026-09-26, source build of main @`474ef34` (saorsa-gossip =0.5.84)
    with `[gossip] byte_policy = "shed_normal"`, same host/method, 32
    peers: 59.36 MB/min (−31%, class-selective; Critical-class caps
    responses and DM bus unshed and growing with the mesh). Different
    dependency versions, dates, peer populations — corroboration of
    direction and class-selectivity, **not** a controlled replication.
- **Independent embedder (W@tch):** OS-level systemd `IPAccounting` wire
  bytes, idle Leaf on public mainnet, 30×60 s samples per leg: 0.41.3
  ~561–778 MB/min; 0.45.0 322; 0.46.0 default 142; 0.46.0 + shed_normal
  **52 MB/min**. They now pin 0.46.6 (no egress-path change observed).
- **Upstream's requested first slice** (the triage's "Track E first"):
  per-kind counters (#1170, OPEN — not landed as of v0.47.1) plus a
  **same-workload delivered/published capture**. This battery delivers the
  delivered/published evidence from the driver side, against pinned
  binaries, without waiting for upstream instrumentation — and without
  posting anything upstream (no unsolicited posts; the daily watch
  carries outward communication).
- **Upstream design records, located by repository + title + revision**
  (ADR numbering was reorganized at v0.47.1: 102 numbered ADRs archived,
  current slots A01–A15 plus `docs/adr/transient/` — numbers alone are not
  addresses): `docs/design/504-leaf-egress-budget.md` at tag v0.47.1
  (slices S1–S5; criticality classes Critical / Normal / Bulk; §4.1 Leaf
  budgets), plus the ADRs that the shed-by-default and envelope-collapse
  decisions track to (located by title in the v0.47.1 tree when cited in
  the closeout).
- **Pinned executables** (fetched 2026-10-12, sha256 verified against each
  release's own `.sha256`; per-version directories under WSL
  `~/btmd/pins/`; digests recorded in the closeout receipts):
  v0.45.0, v0.46.0, v0.46.6, v0.47.1 — `x0x-linux-x64-gnu.tar.gz`. No
  result measured on one version is attributed to another without that
  version being run.

## The rig (local, controlled, offline)

WSL2 (8 cores, 31 GiB) as root: per-node **user+network namespaces**,
veth pairs onto an isolated bridge with **no route to any physical
network**; `mdns_enabled = false`, `port_mapping_enabled = false`,
`bootstrap_peers` explicit (the rig's own seed), a unique `network_id`
gossip plane per rig instance as a second isolation axis. Accounting is
**OS-level first**: per-node veth interface counters
(`/sys/class/net/*/statistics/{rx,tx}_{bytes,packets}`), `/proc/<pid>/stat`
CPU jiffies, `/proc/<pid>/status` VmHWM — the daemon's own diagnostics are
recorded alongside, labeled application-level, and are **never the verdict
source** (misleading-telemetry immunity by construction). What this rig
cannot measure — the public-mesh absolute idle bill — stays with the
staged #622 capture packet (not this lane's to run).

## Honesty commitments (written before the battery runs)

1. **Budgets before tuning.** Device-role budgets are committed
   (`crates/btungsten-meshdep/budgets/btmd-budgets-1.json`) and
   hash-bound into every receipt before the first trial; verdicts compute
   against exactly those bytes. A budget changed after a run is a NEW
   budget with a NEW hash and a re-run, never a re-labeled result.
   Proposed engineering targets and measured results are separate fields.
2. **Delivery before cost.** A cost reduction claim rides a same-workload
   delivered/published matrix: intended recipients and message identities
   are tracked so delivered, acknowledged, lost, duplicated, delayed and
   replayed operations are distinguishable. A peer remaining "ready" is
   not delivery evidence.
3. **No savings by weakening.** Revocation and authority events ride every
   candidate profile and must reach every online intended recipient;
   authentication and post-quantum protection are never disabled; no
   burden is moved to an unmeasured mandatory relay — total work across
   roles (seed, relay, leaves) is accounted in every cost table.
4. **UNKNOWN is preserved** across recovery drills; recovery never
   manufactures authorization and never re-applies an external effect.
5. **Failures are published** with their evidence and a precise next
   implementation task; nothing is relabeled as integration readiness.

## Status

IN FLIGHT — crate, battery, receipts, and the integration PR land on this
branch.
