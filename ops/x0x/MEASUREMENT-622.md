# x0x #622 — pinned public-mesh Leaf egress capture: STAGED execution packet

> **Review disposition: NOT ACCEPTED FOR EXECUTION.** Backend Astra's
> independent review of `58aa4fc9` reproduced targeting and evidence failures,
> identified an unscoped shutdown, and disproved the missing `message_kinds`
> claim. Do not execute the commands below. See
> [the review and correction requirements](../../docs/dispatches/2026-09-10-astra-x0x-622-packet-review.md).
> The original proposal remains below as the record reviewed; it is not a
> deployed runbook.

Prepared by the zCode seat 2026-09-10 under the founder's measurement orders
(`buzz-repair/2026-09-10/zcode-x0x-622-measurement-orders.md`). **NOT RUN.**
No approved isolated measurement host exists: the oracle box is the
production instance (founder-order 0.41.3, ineligible for §5 — see blocker),
the apartment laptop is public-mesh-forbidden (ops/x0x/LAPTOP-NETWORK.md),
and the estate owns no other host. Backend Astra owns the review of this
packet and all public follow-up on
[#622](https://github.com/saorsa-labs/x0x/issues/622). Nothing in this
packet authorizes a run by itself.

## 0. Provenance — the pin (verified 2026-09-10)

- **Source:** `saorsa-labs/x0x` main @ `6cc4085c72205df7e4feda006b7052bbca5ddaf6`
  (2026-09-10T21:50:07Z, unchanged at preparation). Local read-only checkout:
  `C:\Users\travi\x0x-622-src` (detached at the pin).
- **Binary:** upstream's own CI, run **34534309338** (`build.yml` at exactly
  this commit, conclusion success). Artifacts `x0x-linux-x64-gnu` and
  `x0x-linux-arm64-gnu`, staged at
  `C:\Users\travi\buzz-repair\2026-09-10\x0x-622-pinned-binaries\`.
- **Lockfile:** upstream does NOT commit `Cargo.lock` (gitignored; verified).
  The dependency resolution pinned by these binaries is the CI job's own
  resolution inside run 34534309338. There is no shipped lockfile to pin;
  this packet pins source + CI run + digests instead.
- **Signature FLAG:** main-branch CI artifacts are NOT GPG-signed; only
  release tarballs carry David's signature. If David answers our
  [#622 pin question](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5627339402)
  with a preferred build — or a release ≥ the next ships WITH the
  instrumentation — re-pin per §7 before running.
- **Local execution receipt:** both x64 binaries run under WSL and report
  `x0x 0.41.4` / `x0xd 0.41.4` (main is versioned past the released 0.41.3;
  the newest published release remains 0.41.3, verified 2026-09-10).
- **Instrumentation verified in source at this pin** (why the oracle 0.41.3
  cannot pass and these binaries can): `src/server/routes/network.rs`
  `gossip_diagnostics` emits `participation`, `subscribed_topics`,
  `outbound_by_topic_named`, `egress_budget`, `pubsub_stages`,
  `discovery_cache_entries`; `src/gossip/participation.rs` derives default
  Leaf with `reason: "default_leaf"` absent `--relay`/`gossip.relay`; route
  tests assert the fields (`participation_diagnostics_tests`).
- **Collector:** `scripts/capture-egress.py` @ `bd0d23ff` — the only commit
  ever to touch it; there are NO later collector fixes to apply. It
  implements §5.2 of `docs/design/504-leaf-egress-budget.md` verbatim.
  Collector traps (confirmed in code): `--out-dir` is created with
  `exist_ok=True` and files are overwritten — use a NEW EXCLUSIVE directory
  per attempt; the `dt >= 300` check runs only AFTER the window sleeps —
  validate the requested duration BEFORE starting.

sha256 of the pinned binaries (re-verify after any transfer):

```
6179968793d4c62f0b74d0657b57ca1294a72dd97d90ec76f20d097eadce8c73  x0x  linux-x64-gnu   PUBLIC-CONSTANT
1d20fbeb280bbb06dcf15ba118bf0d80b63916139e43b8279d2c47879beaad70  x0xd linux-x64-gnu   PUBLIC-CONSTANT
8c12b6c1496c69503f76eb8824ad6c1e628dabdcd55c7b2b9151d4fa69dd0904  x0x  linux-arm64-gnu PUBLIC-CONSTANT
7a9cf47a65b1ff0b0b248321a3f80bfa5df9bc567fe924cdb050c4f816899b49  x0xd linux-arm64-gnu PUBLIC-CONSTANT
```

Re-fetch (artifacts expire, GitHub default 90 days): re-running the completed
run rebuilds the same commit:

```bash
gh run rerun 34534309338 -R saorsa-labs/x0x
gh run download 34534309338 -R saorsa-labs/x0x -n x0x-linux-x64-gnu -D linux-x64-gnu
sha256sum linux-x64-gnu/x0x linux-x64-gnu/x0xd   # must match §0
```

## 1. Host — THE BLOCKER, and the declared bounds

**Blocker (evidence):** no already-approved isolated measurement host exists.
Oracle runs the production daemon (0.41.3, founder-order staged upgrades,
identity/ports/ACLs untouchable) and its `diagnostics/gossip` lacks
`participation`/`subscribed_topics`/named rows/`egress_budget` — it cannot
pass the §5.4 gate. The laptop must not carry public mesh traffic (standing
law, repeated in LAPTOP-NETWORK.md). A new temporary VPS is a founder
gesture (cloud policy), outside the build seat. This packet therefore waits
for backend Astra review + founder provisioning.

**Provisioning spec (founder gesture):** one disposable Linux VPS, Ubuntu
24.04, x86_64 (use `linux-x64-gnu`) or aarch64 (use `linux-arm64-gnu`),
1–2 vCPU, ≥4 GiB RAM, ≥20 GiB disk, unrestricted UDP egress (the daemon
dials embedded bootstraps on UDP 443 and 5483). Inbound ports are NOT
required for a Leaf; if the operator chooses to open ingress on OCI, the
#505 lesson applies: PQ ServerHello flights arrive fragmented and only an
any/any stateful rule passes them — but an egress-only Leaf meshes fine
without it. No VPN, no port forwarding.

**Declared finite bounds + scoped shutdown (ordered before any run):**

| Bound | Value | Enforcement |
|---|---|---|
| Wall-clock | ≤ 3 h total from instance boot | `systemd` poweroff timer installed at deploy (§2); hard `shutdown` at T+3h regardless of state |
| CPU | ≤ 200% of 2 vCPU | `CPUQuota=200%` on the unit |
| Memory | ≤ 768 MiB | `MemoryMax=768M` (headroom above the prod-shaped 512M so the cap can never poison the window) |
| Disk | ≤ 1 GiB used (binaries ~170 MB + evidence <100 MB + venv ~60 MB) | 20 GiB volume; nothing else written |
| Retries | ≤ 2 window restarts | inside the same 3h lease |

Identity: FRESH throwaway minted by first run (never reuse production
identity dirs). Suggested display name `x0x-622-measure`. The instance and
its keys are destroyed in §6.

## 2. Deploy + configure (one paste per block, root on the NEW host)

```bash
# user + layout (distinct from any prod naming; nothing shares /var/lib/x0x)
useradd --system --home /var/lib/x0x-measure --shell /usr/sbin/nologin x0xm
mkdir -p /opt/x0x-measure/bin /etc/x0x-measure /var/lib/x0x-measure/{data,identity}
# copy the two pinned binaries for the host arch into /opt/x0x-measure/bin/, then:
sha256sum /opt/x0x-measure/bin/x0x /opt/x0x-measure/bin/x0xd   # MUST match §0
chmod 755 /opt/x0x-measure/bin/x0x /opt/x0x-measure/bin/x0xd
```

`/etc/x0x-measure/x0xd.toml` — default Leaf per §5.1: **no** `--relay`,
`gossip.relay` unset (verified at pin: that yields
`participation.mode=leaf`, `reason=default_leaf`):

```toml
api_address = "127.0.0.1:12710"
bind_address = "0.0.0.0:5483"
log_level = "info"
log_format = "text"
data_dir = "/var/lib/x0x-measure/data"
identity_dir = "/var/lib/x0x-measure/identity"
zero_peer_restart_secs = 600

[update]
enabled = false
```

`/etc/systemd/system/x0x-measure.service` — prod-shaped caps (ops/x0x/
x0x.service), separate names/ports so it can never collide on a shared host:

```ini
[Unit]
Description=x0x #622 measurement Leaf (throwaway)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=x0xm
Group=x0xm
ExecStartPre=/opt/x0x-measure/bin/x0xd --config /etc/x0x-measure/x0xd.toml --check
ExecStart=/opt/x0x-measure/bin/x0xd --config /etc/x0x-measure/x0xd.toml
Restart=always
RestartSec=5
MemoryMax=768M
CPUQuota=200%
TasksMax=64
IPAccounting=yes
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
StateDirectory=x0x-measure
ReadWritePaths=/var/lib/x0x-measure

[Install]
WantedBy=multi-user.target
```

Scoped shutdown lease (fires no matter what the operator does):

```bash
cat >/etc/systemd/system/x0x-measure-lease.service <<'EOF'
[Unit]
Description=hard 3h lease for the #622 measurement instance
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'sleep 10800 && /sbin/poweroff'
EOF
systemctl enable --now x0x-measure-lease.service
systemctl daemon-reload && systemctl enable --now x0x-measure.service
```

Gate checks (all must pass BEFORE any capture; token stays in env, never
printed, never attached):

```bash
export X0X_API_TOKEN=$(sudo cat /var/lib/x0x-measure/data/api-token)
/opt/x0x-measure/bin/x0x --api 127.0.0.1:12710 health --json
#   expect: version 0.41.4, healthy, peers > 0 (grow over minutes)
/opt/x0x-measure/bin/x0x --api 127.0.0.1:12710 diagnostics gossip --json | head -c 2000
#   MUST contain participation.mode="leaf", reason="default_leaf",
#   passthrough_refresh_runs=0, egress_budget, outbound_by_topic_named
```

**Group workload (operator decision):** §5.1 wants "#504 if possible: one
`public_open` group". Default path = idle Leaf, NO group joined (valid
capture; record that choice). Optional path = join the existing public_open
group `hive-porch` — this needs a member-minted invite from an existing
production identity (e.g. box `hive-box` through the approved SSH API
tunnel). Minting from a production identity is an Astra/founder decision,
not assumed here. Either way: no file transfers, no extra subscriptions, no
publishes once the window starts.

## 3. The capture (upstream collector, unchanged)

Setup: python3 venv + blake3, collector straight from the pin (it ships in
the repo; also present in `C:\Users\travi\x0x-622-src\scripts\`):

```bash
python3 -m venv /opt/x0x-measure/.venv
/opt/x0x-measure/.venv/bin/python -m pip install blake3
COLLECTOR=/path/to/x0x-622-src/scripts/capture-egress.py
```

Attempt protocol (every attempt gets a NEW EXCLUSIVE dir — the collector
overwrites and validates late):

```bash
RUN="run-$(date -u +%Y%m%dT%H%M%SZ)-attempt1"
mkdir -p /opt/x0x-measure/evidence/$RUN && cd /opt/x0x-measure/evidence/$RUN
```

Stability gate (§5.1: window starts only after peers stable ~2 min; Winston's
reference was ~25 peers — record actuals):

```bash
for i in $(seq 12); do
  /opt/x0x-measure/bin/x0x --api 127.0.0.1:12710 health --json | tee -a pre-stability.jsonl
  sleep 10
done   # peers must be >0 and roughly flat across the tail of the series
```

Mid-window health series (the collector's endpoints alone cannot prove
continuous availability — §5.4 item 7):

```bash
( while true; do
    printf '{"ts":%s,' "$(date +%s)"
    /opt/x0x-measure/bin/x0x --api 127.0.0.1:12710 health --json | tail -c +6 | head -c 400
    sleep 60
  done ) &   echo $! > sampler.pid
journalctl -u x0x-measure -f --output=short > service.log & echo $! > journald.pid
```

The window (idle law: no publishes/subscriptions/transfers during it):

```bash
/opt/x0x-measure/.venv/bin/python "$COLLECTOR" \
  --window-secs 1200 --out-dir . \
  2>&1 | tee collector-console.txt
kill $(cat sampler.pid) $(cat journald.pid)
journalctl -u x0x-measure --since "$(stat -c %y collector-console.txt | cut -d. -f1)" --no-pager >> service.log
```

A `--window-secs 300` run is a SMOKE only and must be labeled as such in any
report; the target is 1200 s.

Reject/restart (collector raises on counter reset, disappearing topic rows,
restart-detected timing drift, non-Leaf drift): KEEP the failed dir (rename
`FAILED-$RUN`), create a fresh exclusive dir, restart the whole window, ≤2
retries inside the lease. A restart, mode change, isolation or cap-triggered
shutdown invalidates the interval — failed evidence is preserved and
explained, never patched.

§5.4 items the collector does NOT enforce — the operator checks and reports
them: (3) `Δrelay_bytes/Δt` ≤ 150 KiB/s consistency (expect ≪); (7) no
peer collapse across the health series; plus record `discovery_cache_entries`
(t0/t1), NAT type from the transport payload, peers at t0/t1, OS, the pin +
digests, and the bus-skip setting (at this pin `skip_legacy_dm_bus` exists
and defaults OFF — §5.1's "default off").

## 4. Reporting + sanitization

Raw evidence stays local (download off-host before §6). The GitHub-ready
summary (Astra owns posting) contains no tokens, no peer identifiers beyond
counts, no filesystem names:

- participation deltas: `epidemic_forward_bytes` (KiB/s AND MB/min),
  `epidemic_forward_msgs`, `relay_bytes`/`relay_msgs`,
  `unsubscribed_refused_frames`, `passthrough_refresh_runs` (=0);
- top-8 `outbound_by_topic` Δeager.bytes rows — named via the collector's
  map, `unknown-hex` allowed to stay unknown; the DM bus row
  (`x0x/dm/v1/bus`) stated separately from system announcements;
- peers t0/t1 + stability series summary, uptime vs dt, log continuity
  statement, OS + arch, NAT, config (leaf defaults, bus-skip off), source +
  CI-run + digests pin, group-workload choice;
- provenance disclaimer verbatim: **a Linux VPS observation is not a
  reproduction of the original Windows/residential host and not a controlled
  before/after comparison; no egress-reduction claim is made from it.**

## 5. Delivery control — SEPARATE, currently UNPERFORMED

David's per-peer control (published vs delivered message IDs, send→delivery
timestamps, receiver `message_kinds` beside sender `outbound_by_topic`,
no-induced-disconnect control arm) needs a SECOND instrumented peer on a
second approved host. Diagnostic gap found at this pin: **no inbound
`message_kinds` counter exists in the current diagnostics** (source-checked;
§5.3's stage tables are outbound-side). Counter deltas never substitute —
if a second peer is unavailable this part is reported unperformed, as
ordered. If two peers ARE approved: run it strictly outside the idle window,
with approved synthetic traffic only (publish N recorded (id, ts) synthetic
messages from peer A via the API, record delivered (id, ts) at peer B via
group readback — the app-layer readback path is proven in ops/x0x/README.md
— and do NOT induce any disconnect; the control arm is simply the same flow
without disturbance). The `message_kinds` gap is flagged to Astra for the
upstream conversation rather than worked around silently.

## 6. Cleanup

```bash
systemctl disable --now x0x-measure.service
tar czf /root/x0x-622-evidence-$RUN.tar.gz -C /opt/x0x-measure evidence
# download the tarball off-host (it is the only artifact kept), then:
poweroff   # destroy the instance (founder gesture); nothing persists
```

Production was never touched; confirm nothing changed on oracle (no commits,
no service edits) and record completion in the estate dispatch.

## 7. Re-pin trigger

If David answers the pin question on #622, or a release ships WITH the
instrumentation (check the tag's `gossip_diagnostics` fields before trusting
the version number), swap §0 (source/run/digests) and re-run §2–§4 unchanged.
If the 34534309338 artifacts have expired, `gh run rerun` rebuilds the exact
commit (§0). A source version string alone is never provenance — digests or
a David-signed tarball.
