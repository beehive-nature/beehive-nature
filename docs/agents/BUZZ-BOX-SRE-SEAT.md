# BUZZ BOX SRE + SECURITY SEAT — charter, autonomy addendum, evidence handoff

Founder ruling 2026-09-16. This document is the durable, repository-side
record of the seat split and the operational-evidence handoff; the live
memory index carries the same for seat recall.

## Division of labor

- **Buzz Box agent (the zCode session that executed the CSPU lane) =
  operational truth / evidence.** Scope narrow: patching, hardening,
  regression verification, #505 field evidence, service health, network
  behavior, operational runbooks, security findings. Alive on HIGH while it
  holds accumulated context; **event-driven, no token burn**; ordinary
  periodic verification = LOW sessions.
- **Archaeology agent (new HIGH zCode session) = repository truth /
  architecture.** Repository-wide read access; does NOT administer Buzz Box.
- **Astra = synthesis + architecture review.** Later HIGH protocol-reuse
  seat (OpenA2A/AIM, AIP/AAP/ATX, OpenCompany, ADOPT/ADAPT/WRAP/WATCH/BUILD);
  LOW sessions = bounded workers from findings.
- **Synchronization point** between the operational evidence stream and the
  architecture investigation: commit `1c34573b`
  (`zcode/oci-cspu-runbook-2026-09-15`).

## BUZZ BOX AUTONOMY ADDENDUM (founder text, verbatim, standing)

Continue autonomously with reversible, in-scope investigation,
verification, evidence collection, documentation, tests, and
non-disruptive maintenance.

For production/server administration, distinguish:

GREEN — execute autonomously
- read-only inspection
- logs and metrics
- health checks
- non-invasive captures
- evidence collection
- documentation/runbooks
- tests that do not materially interrupt services
- repository commits within assigned branch/worktree

YELLOW — coordinate before execution when another agent/session may be affected
- package upgrades
- service restart
- Docker/container restart
- firewall/network changes
- systemd changes
- kernel/network tuning
- resource-intensive builds/tests

RED — require explicit human authorization
- reboot
- destructive filesystem/database operations
- credential/key rotation
- deleting persistent data
- disabling security controls
- externally consequential actions
- production migrations
- irreversible changes
- actions materially outside assigned scope

Never interpret "no founder gates" as authorization to cross RED boundaries.

Before disruptive YELLOW/RED operations, inspect for concurrent agents,
builds, captures, transactions, or long-running jobs and preserve their state.

## Operational observations → archaeology seat's evidence model

These are OPERATIONAL OBSERVATIONS, not architecture assumptions — preserve
the distinction. Receipts: `ops/x0x/CSPU-2026-09.md` (execution receipt),
`docs/dispatches/evidence/2026-09-16-x0x-cspu/`,
`docs/dispatches/2026-09-15-x0x-505-504-field-evidence.md`; raw bundles on
the box (`~/x0x-cspu-baseline-20260915/`, `~/x0x-cspu-post/`).

1. Kernel `6.17.0-1020-oracle` live post-CSPU; `6.17.0-1018-oracle` was the
   #505-verified environment (preserved in the pre/post dataset).
2. Successful post-reboot restoration: 14-container docker fleet, all
   systemd services, MTU 1500, iptables 5483 door survived the boot.
3. `bdispatch` watcher is managed through a lingering user systemd unit
   (`systemd --user`, Linger=yes) — self-restores at boot.
4. Fail-closed `/ant/*` behavior: 403 on unknown paths by design;
   `ant-door.html` 200; antd listens on 8094.
5. Post-CSPU #505 reproduces the prior ingress-drop behavior: reasm deltas
   Reqds +36 / OKs +0 / Fails +28 / Timeout +28 under the netdev-ingress
   drop — same law as kernel 1018.
6. x0xd 0.45.0 emits ZERO outbound oversized fragments (ant-quic 0.27.52
   sender-side fix); the observed oversized 4,096-byte flights arrive INBOUND
   from one legacy peer (217.142.20.211, Starlink) — residual ecosystem
   risk, pre-fix sender.
