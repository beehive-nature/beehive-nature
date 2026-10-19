# 2026-10-14 — BNROSE cross-node, the process depth: concurrent sovereigns, an enforcing destination surface, crash-between-effect-and-receipt, replay enforcement

The review disposition after #425 named the next cross-node depths:
independently running processes, concurrent duplicate dispatch,
crash/restart between effect and receipt, and destination-side replay
enforcement. This beat delivers those (branch
`zcode/bnrose-crossnode-procs-2026-10-14`, cut from main
`5c24bb044`): a destination CLI surface (`dest-init` / `dest-apply`)
and a multi-process harness (`scripts/bnrose-rust-001/crossnode-demo.sh`),
wired into the lane workflow beside the recovery demo.

## The destination surface (crates/bnrose-exec-host/src/cli.rs)

`dest-init` writes a never-replaced destination root;
`dest-apply --state --receipt --pk [--wall]` VERIFIES the receipt
under the named public key before anything else (unverified evidence
exits 1 with no row written), then applies the effect through
EffectLedger's op-keyed idempotency, printing applied/already + rows.
Its doc comment holds the review's boundary verbatim: exactly one row
here does not establish globally exactly-once execution across
arbitrary destinations — that requires destination-specific atomicity,
durable deduplication, and finality assumptions. The harness
destination is a single-owner ledger, not an adversarial or consensus
model.

## The harness, five phases (real processes)

1. **Concurrent duplicate dispatch** — two sovereign supervisor
   processes run-op the SAME intent concurrently (backgrounded, waited
   separately); both exit 0. Dual acceptance is real; the dedup
   journals are local.
2. **Destination replay** — A's receipt applied; B's receipt for the
   same op already; A's receipt replayed again still already: one row
   after three VERIFIED submissions (same deterministic op id across
   sovereigns).
3. **Unverified evidence** — B's receipt under A's public key: exit 1,
   no row, no effect.
4. **Crash between effect and receipt** — node C with
   `--lose-response` (exit 3), `recover` (exit 0), then the RECOVERED
   receipt applies once and the duplicate replay is refused — recovery
   does not defeat destination enforcement.
5. **Teeth** — a naive destination (no dedup) records two entries for
   the one op: the enforcement is load-bearing.

## Receipts

- Local, real release binaries: rc=0, all phases
  (scripts/tmp/bnrose-crossnode-demo-local.txt).
- Dash portability, FIRST TRY by construction (the lane's sh-law held
  in the authoring): WSL dash + CLI-contract stub v2, rc=0, clean
  stderr (scripts/tmp/bnrose-crossnode-dash-harness/).
- Battery after the CLI change: 17 suites / 56 passed / 0 failed.
- cargo fmt clean before push (the banked law); workflow YAML parses.
- CI: the demo rides the lane workflow after the recovery demo
  (missing evidence is an error, not a skip — same contract).

## Boundaries not crossed

- No global exactly-once claim, no consensus claim, no adversarial
  destination model.
- "Actual network partitions" in the wire sense remain named-not-
  claimed: this beat's partitions are arrival-order and crash legs in
  a shared-host process topology; a multi-host harness with real wire
  cuts is the next depth (the box/OCI tenancy is a candidate).
- Arbitrum/Hive adapters: destination-specific execution and finality
  semantics remain their own qualification; a locally generated op id
  alone guarantees nothing externally.
