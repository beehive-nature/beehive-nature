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

DELIVERED (first milestone) — see §Receipts below. The branch carries the
crate, the frozen budgets, the distilled evidence, and this dispatch; the
integration PR is open from `zcode/btmd-001`.

## Receipts (written by the run, 2026-10-12/13)

**Executables (pinned, per-version dirs under WSL `~/btmd/pins/`).**
Tarball digests verified against each release's own `.sha256` at download
time. `x0xd` binary sha256 (PUBLIC-CONSTANT digests of public release
artifacts):

```
64f0dbf6eeea4c729cc969f4f100302340699671eae1ae3be38b9c2bc880131a  v0.45.0 x0xd PUBLIC-CONSTANT
adba317bda409b6eeb47326e28fdb89e7ed66317959c3db23a1a34b74142b317  v0.46.0 x0xd PUBLIC-CONSTANT
1e71b115050a435c88bf5ad564dfad9e033c0cdc1aa8db7fb7cb7559b8b8dfcb  v0.46.6 x0xd PUBLIC-CONSTANT
812af81d5d6b233d36cbd157e58c9f489794c37f79a52310a1026c919e25d24d  v0.47.1 x0xd PUBLIC-CONSTANT
```

Signature state, honestly: each `.asc` carries key id
`EDDA4827D89C0F29` (David Irvine code signing — the same key as every
prior verified install per `ops/x0x/README.md`); the WSL keyring is fresh
and the box was unreachable at closeout, so full key-holder verification
was NOT re-performed this session — the TOFU state carries from prior
verified installs, and the sha256-vs-release-`.sha256` checks bound the
bytes actually run. Source pins: v0.46.0 = `cea64f20e`, v0.47.1 =
`ae064f6dd` (shallow clones, upstream saorsa-labs/x0x).

**Battery runs.** Raw receipts (spec, budget hash, per-second kernel
samples, ledger journals, app-level diagnostics, verdicts) live outside
temp dirs in WSL `~/btmd/runs/<run-id>/receipts/`; the sanitized,
committable distillation is in-tree:
`docs/dispatches/evidence/2026-10-12-btmd-mesh-dependability/`
(verdicts.json + summary.md; no 64-hex identity rides them).

**P1 acceptance sanity** (p1f, v0.47.1, scale 3): `verdicts_pass=true` —
targeted DM 12/12, group 12/12, state sync 20/20, class probes 160/160;
lost 0, unknown 0; every budget gate green; calibration probe re-proved
the egress=root-side-rx mapping.

**P2 matched cost A/B** (identical workload shape, interleaved
baseline/shed_normal; canonical rows in the evidence summary):

| scale | baseline delivery | shed_normal delivery | shed verdict |
|---|---|---|---|
| 3 | all classes full | all classes full | PASS |
| 6 | all classes full | all classes full | PASS |
| 9 | all classes full | **KV sync 10/20 within the 30s gate** (rerun with 180s observation: 20/20, all within gate) | FAIL (sync gate) |

Cost, honestly scoped: on this small local mesh the idle bill
(~0.3–2.0 MB/min combined per leaf) sits far below the public-mesh
figures, as expected — the rig's cost signal is the MECHANISM direction
(class-selective shedding; diagnostics show `shed_suppressed` engaged on
leaf rows in shed trials) and the total-work accounting across roles
(seed/relay columns in the summary; a lower leaf bill was never bought by
an unbounded relay bill). The public-mesh absolute bill stays with the
#622 packet. **Unsafe retries: 0 in every canonical trial** — no
operation ever retried under UNKNOWN with a fresh identity.

**Recovery drills** (rec02): kill-9 → restart in 1.0 s with identity
PRESERVED and the in-flight DM UNKNOWN preserved (resolved later only by
its identical-logical-id retry; the fresh-identity conviction row was
executed once and counted, never accepted). Partition (mesh link down,
management up): the node answered `/health` READY while partitioned — the
ready≠delivered law demonstrated live; outcomes resolved only from
post-heal evidence. Revocation: sacrificial agent self-revocation
reached **3/3 observers** (self MACHINE-key revocation is refused 403 —
convicted, and the drill switched to the always-allowed agent form).
Corrupt state: one flipped byte in a data file → the node REFUSED to come
healthy (fail-closed; identity on disk untouched). Bootstrap removal:
seed killed → leaves rejoined from peer cache in **0.003 s**.

**Continuity** (con02): cold replacement v0.46.0 → v0.47.1 on the same
identity+data dirs with fresh processes — identity preserved, group
visible, store value readable at its owner, DM delivery works: ALL GREEN.
Downgrade probe v0.47.1 → v0.45.0 on the same state: the KV store value
is NOT served — the upstream X0XKVS2 fail-closed law **verified live**,
not assumed.

**Bounded adaptation** (run04, hostile flood under shed_normal): a rig
peer flooding a leaf-subscribed topic (1200×1 KiB) left revocation
delivery intact (3/3 observers, mid-flood), targeted DM delivered, RSS
flat (~58–70 MiB) — but the leaf bill ran **~32–83× its idle rate**:
shed_normal never bounds INBOUND delivery to a subscribed leaf (by
design — own-inbox is never shed). The adaptation gate (≤3× idle) FAILED
and is published as-is. Verdicts read kernel veth counters only; daemon
telemetry cannot flatter this table by construction.

**Environment law found and code-enforced** (the rig's own finding):
WSL2/docker hosts route bridged IP packets through iptables FORWARD where
the docker default-DROP policy silently kills them; the rig now inserts
a scoped FORWARD ACCEPT for its own bridges at build and removes it at
teardown.

## The profile deliverable (smallest justified improvement)

`crates/btungsten-meshdep/profiles/leaf-shed-normal.toml` —
LEAF-SHED-NORMAL-1: the measured, delivery-preserving leaf profile
(`[gossip] byte_policy = "shed_normal"`, stock thresholds, eager degree
2) WITH its honest constraints in the header: state-sync-heavy leaves
(the W@tch shape) should not adopt at stock budgets until the s9 sync
variance is quantified; inbound floods are a trust/block-surface
question, not a byte_policy one; the constrained-leaf idle target was
missed at s9 and the budget file stands unchanged. Adopting it on any
host is a founder gesture (ops/ stays verbatim-only).

## Verdict (scoped)

- **Mechanism:** shed_normal is delivery-preserving at small/mid mesh
  scale on every class the battery exercises, and revocation is never
  shed — including under a hostile flood. At scale 9 the KV state-sync
  gate was run-variable (10/20 vs 20/20 across two trials inside the
  same gate; full convergence with a longer window): UNRELIABLE-within-
  gate is the honest status, not "broken" and not "passing".
- **Recovery/continuity:** identity, UNKNOWN-preservation, fail-closed
  corruption handling, bootstrap-loss rejoin, and the version-replacement
  trial all PASS on pinned binaries; the X0XKVS2 downgrade law verified.
- **Not proven here (and not claimed):** public-mesh absolute idle
  reduction (622 packet's capture), ten-billion-user scale (nothing in
  this battery extrapolates), and always-on deployability on home
  broadband — the embedder's 75 GB/day observation stands untouched.

## Remaining bTunGsTeN obligations (precise next tasks)

1. **Quantify the s9 sync variance**: N≥10 matched trials at scale 9,
   per-topic classification of custom store topics (Normal vs
   Critical), and the upstream question: should joined-store topics get
   a delivery carve-out (the S4 "revocation topics exempt first"
   precedent extends naturally to subscribed store convergence)?
2. **Inbound bounding for constrained leaves**: the flood result names
   the surface — trust/block + subscribe-set discipline; a mechanism
   proposal belongs upstream (Track E), evidenced by this battery's
   flood drill.
3. **#1170 per-kind counters** (upstream, OPEN) would replace the
   driver-side delivered/published capture once landed; this battery's
   ledger remains the independent check either way.
4. The **#622 public-mesh capture** stays staged for Astra re-acceptance
   and a founder-named host — this lane's numbers never substitute for
   it.
5. The daily upstream watch continues untouched; nothing was posted
   upstream from this lane (no unsolicited posts; the watch carries
   outward communication).
