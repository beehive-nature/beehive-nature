# SPEC-X0X-622-CAPTURE-1 — tested public-mesh Leaf egress capture (correction round)

> **Re-review: NOT ACCEPTED for execution at `9b5df485`.** The fast suite
> passes, but runner-level fault probes still return success after evidence
> and cleanup failures. See the [independent re-review](../dispatches/2026-09-10-astra-x0x-622-runner-rereview.md).

Status: STAGED for backend Astra re-review, 2026-09-10. Supersedes the
executables of the returned proposal `ops/x0x/MEASUREMENT-622.md`
(`58aa4fc9`; review `b7076f86`, NOT ACCEPTED — its binary provenance stands,
its commands do not). The binary pin below is UNCHANGED and already accepted.
David Irvine's request on
[#622](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5615274866)
remains the goal: one timed public-mesh Leaf capture with the UNCHANGED
upstream collector, plus the separate delivery control when feasible.
**Nothing here is executed on any host until Astra re-accepts and the founder
names the host.**

## 0. Provenance (accepted at review b7076f86; carried verbatim)

- Source: `saorsa-labs/x0x` main @ `6cc4085c72205df7e4feda006b7052bbca5ddaf6`
  (reports `0.41.4`; the newest published release is still `v0.41.3`).
- Binaries: GitHub Actions run **34534309338** (`build.yml` at exactly that
  commit, success). **Existing artifact IDs** (R6): `10175109014`
  (`x0x-linux-x64-gnu`) and `10175170184` (`x0x-linux-arm64-gnu`). Verified
  local copies staged at `buzz-repair/2026-09-10/x0x-622-pinned-binaries/`.
- sha256 (PUBLIC-CONSTANT digests of public release artifacts):

```
6179968793d4c62f0b74d0657b57ca1294a72dd97d90ec76f20d097eadce8c73  x0x  x64   PUBLIC-CONSTANT
1d20fbeb280bbb06dcf15ba118bf0d80b63916139e43b8279d2c47879beaad70  x0xd x64   PUBLIC-CONSTANT
8c12b6c1496c69503f76eb8824ad6c1e628dabdcd55c7b2b9151d4fa69dd0904  x0x  arm64 PUBLIC-CONSTANT
7a9cf47a65b1ff0b0b248321a3f80bfa5df9bc567fe924cdb050c4f816899b49  x0xd arm64 PUBLIC-CONSTANT
```

- Lockfile: upstream does not commit `Cargo.lock` (gitignored). The pinned
  bytes carry the CI job's own dependency resolution; there is no shipped
  lockfile and none is claimed (R6).
- Signature: main-branch CI artifacts are NOT GPG-signed; only release
  tarballs carry David's key. Recorded, with the re-pin policy in §6.
- Refetch policy (R6, replacing the rejected `gh run rerun` advice): fetch
  the EXISTING artifacts by run+artifact ID and verify digests. Rebuilding
  the same source is a NEW candidate (no committed lockfile, no `--locked`)
  and needs a fresh provenance review — never "the same bytes". On expiry
  (GitHub default 90 days) use the preserved verified local copy, or
  produce a new candidate and review it.

## 1. Corrections against review b7076f86

| Finding | Correction, as built and regression-proven |
|---|---|
| R1 collector can target the wrong daemon | `run-capture.sh` writes a private PATH shim (`exec <pinned-x0x> --api <test-api> "$@"`), asserts `command -v x0x` resolves to it, and runs the unchanged collector with that PATH. T1/T1b prove with the REAL collector: decoy on default port 12700 gets 0 calls through the shim and ≥3 without it; T10 repeats against the pinned REAL daemon offline. |
| R2 malformed health evidence; masked failures | `sampler.py` writes full timestamped JSON records (one per line, fsync'd) with bounded per-request timeout and total lifetime; errors are records, 3 consecutive failures exit 21, write failures exit 22. Collector console goes straight to a file (no `tee` pipeline); the runner runs under `set -euo pipefail` and passes a distinctive collector exit through verbatim (T2: forced exit 7 returns 7). Log capture starts from a saved `window-start.epoch`. |
| R3 host-wide poweroff; blocking oneshot; boot persistence | The lease is a deadline scoped to THIS runner's owned helpers and the test node: a `setsid` watchdog TERMs the runner only; `finish()` kills only tracked pids/groups (watchdog group included, inner sleep too) and stops only the node it started. No `poweroff`, no shutdown, no boot-enabled units anywhere. T7/T8: a sentinel outside the runner survives both expiry and cancellation. |
| R4 bounds in prose only | Duration/digest/shape gates run BEFORE the node starts (T9/T9b/T9c: refused with node never started / stopped-owned). Evidence dirs are created with plain `mkdir` — collision refuses the run untouched (T5). Retry budget enforced (T6: exactly N attempts, each retained with `FAILED` + `ATTEMPT.json`). A cap-triggered interval (unit leaves active/success/0) or peer collapse in the series marks the attempt failed; evidence retained and labeled. |
| R5 false "message_kinds missing" claim | RETRACTED. The pinned daemon emits `pubsub_stages.message_kinds` (eager/ihave/iwant/graft/prune/anti_entropy/other/decode_failed), serialized from the dependency's `PubSubStageStatsSnapshot` via `augment_pubsub_stage_diagnostics`; my source-grep only covered x0x's own crates. T10 is the seat's own offline receipt with the pinned binary. These remain AGGREGATE stage counters — they do not substitute for David's per-peer published/delivered IDs and timestamps; the delivery control stays separate and, without a second approved peer, UNPERFORMED. |
| R6 rebuild presented as refetch | Existing artifact IDs + digests pinned (§0); `gh run rerun` removed; expiry policy = preserved verified copy or a newly reviewed candidate. |

## 2. The tested wrapper (committed, unchanged collector)

- `scripts/x0x-622/run-capture.sh` — the runner. Env contract and exit codes
  documented in its header: 0 accepted; 1 attempts exhausted; 2 gate
  refusal; 5 collision; 124 lease-interrupted; 130 cancelled; else the
  collector's own exit. Node control defaults to the systemd TRANSIENT unit
  `x0x-measure` (started/stopped, never enabled; `systemd-run` shape in §3).
- `scripts/x0x-622/sampler.py` — bounded honest health sampler (§R2).
- `scripts/x0x-622/test_runner.py` — the regression suite:
  `--fast` (11 checks, ~1 min), `--slow` (T7/T11/T11b, ~21 min: scoped lease
  expiry, the 300 s real-collector accept path through the runner, and the
  peer-collapse rejection path — a smoke, NOT the public measurement),
  `--offline` (T10: pinned real daemon + real collector inside an empty
  user+net namespace — loopback only, no route, bootstrap/peer-cache
  disabled, fresh temp state; never a mesh capture).
- Runner receipt convention: every attempt directory keeps the collector's
  own raw JSON, `collector-console.txt`, `health-series.jsonl`,
  `service.log`, node checks, window epochs, and `ATTEMPT.json`
  (status/collector_exit/lease state). Failed attempts are immutable and
  marked `FAILED`; nothing is ever overwritten (fresh exclusive dir per
  attempt).

## 3. Host plan — scoped Oracle first, temporary VPS as fallback

Read-only assessment on the oracle box (2026-09-10, SSH live from the
laptop at assessment time; no mutation, production untouched):

- 4 cores; ~16 GiB RAM available; 9.4 GiB free on the root filesystem
  (production active; its unit capped MemoryMax=512M/CPUQuota=100%).
- Production binds UDP 5483 + loopback TCP 12700. **UDP 5493 and loopback
  12710 are FREE** — distinct-port colocation needs no production change.
- systemd 255, cgroup v2 (transient units + per-unit resource caps),
  `/dev/loop-control` present (a loop-image disk ceiling is possible).
- No network namespaces configured; `ip netns` setup would be a host
  networking change, so the live-run isolation rides on distinct ports,
  a dedicated user, and a bounded disk image instead.

Concrete shape (for Astra review; NOT executed here):

1. Dedicated user `x0xm` (nologin) + `/opt/x0x-measure/bin` carrying the
   pinned binaries (digest-verified per §0). NEVER the production user,
   dirs, identity or ports.
2. Disk ceiling (enforced, not prose): a 2 GiB sparse ext4 image mounted at
   `/var/lib/x0x-measure` — ALL test state, evidence and logs live inside
   it; a full disk surfaces as write failures, which the runner records.
3. Fresh throwaway identity minted at first run under that mount
   (`x0xd.toml`: api `127.0.0.1:12710`, bind `0.0.0.0:5493`,
   `zero_peer_restart_secs=600`, `[update] enabled=false`; default Leaf per
   §5.1 — no `--relay`, `gossip.relay` unset).
4. The node runs as a TRANSIENT systemd unit — `systemd-run --unit=x0x-measure
   --property=MemoryMax=768M --property=CPUQuota=100% --property=TasksMax=64
   ...` — never enabled at boot; the runner starts/stops it; stop removes
   it. Combined with production's caps the test node can never exceed 1 of
   4 cores and 768 MiB of ~16 GiB free.
5. Lease/bounds as in the runner defaults (3 h wall-clock over helpers+node
   only, ≤2 retries, exclusive evidence dirs). Cleanup = runner finish +
   `umount` + `losetup -d` + image removal + user removal — scoped, no
   production contact.
6. Recorded trade-off: the test Leaf shares the box's public IP with the
   production node (two identities behind one address — an ordinary NAT
   shape, but if Astra rules it contaminating, §3b applies). No cloud
   firewall change is needed for an egress-participating Leaf; inbound is
   not required.

If the box cannot carry it (Astra's call, with evidence), the fallback is
the temporary-VPS shape from the returned proposal §1 — bounds and runner
identical, plus instance destruction at cleanup.

## 4. The live capture (operator runbook, after re-acceptance)

Eligibility (fail closed): `health` = 0.41.4 + peers>0;
`diagnostics gossip` shape-gated by the runner (leaf/default_leaf/
passthrough 0/egress_budget/message_kinds/outbound_by_topic). Stability:
peers roughly flat ~2 min before the window. Then, with the token in the
environment only:

```bash
X0X_BIN_DIR=/opt/x0x-measure/bin \
X0X_EVIDENCE_ROOT=/var/lib/x0x-measure/evidence \
X0X_COLLECTOR=/opt/x0x-measure/capture-egress.py \
X0X_EXPECT_SHA256_X0XD=<x0xd digest from §0> \
X0X_EXPECT_SHA256_X0X=<x0x digest from §0> \
X0X_WINDOW_SECS=1200 X0X_ATTEMPTS_MAX=3 X0X_LEASE_SECS=10800 \
X0X_API_TOKEN="$(cat /var/lib/x0x-measure/state/api-token)" \
bash scripts/x0x-622/run-capture.sh
```

(x64 digests shown; arm64 values from §0 on an arm host. The collector
itself is fetched from the pinned source tree byte-identically; the runner
never modifies it. `X0X_PYTHON` must be an interpreter that can import
`blake3` — upstream's §5.2 venv recipe on a normal host, or the suite's
PYTHONPATH'd wheel dir where no pip exists.) Manual §5.4 items beside the
runner's checks: verify
Δrelay_bytes/Δt ≤ 150 KiB/s (expect ≪), record peers t0/t1, NAT, OS/arch,
bus-skip setting (default OFF at this pin), group-workload choice (idle Leaf
by default; joining the existing `public_open` group requires a
member-minted invite from a production identity — an explicit Astra/founder
decision, not assumed), and no file transfers/extra subscriptions/publishes
during the window. A 300 s run is a SMOKE and is labeled as such; the
target window is 1200 s.

Sanitized summary (Astra owns posting; no tokens, no peer identifiers
beyond counts, no filesystem names): participation deltas in KiB/s AND
MB/min; top-8 named Δeager.bytes rows (unknown-hex stays unknown); the DM
bus row separate from system announcements; the provenance disclaimer
verbatim — a Linux/VPS observation is not the original Windows/residential
reproduction and claims no reduction.

## 5. Delivery control — SEPARATE, UNPERFORMED

Unchanged from the review's terms: needs a second approved instrumented
peer; per-pair published vs delivered message IDs with send→delivery
timestamps; a no-induced-disconnect control; receiver-side
`message_kinds` beside sender `outbound_by_topic` — the receiver counter
EXISTS at this pin (T10 receipt), the ID/timestamp comparison rides the
application layer with approved synthetic traffic only. Counter deltas
never substitute. If no second peer is approved: reported unperformed.

## 6. Re-pin policy

If David answers the pin question on #622, or a release ships with the
instrumentation (verify the tag's `gossip_diagnostics` fields before
trusting a version string): new source + artifact IDs + digests + a fresh
provenance receipt; §2–§4 run unchanged. A source version string alone is
never provenance.
