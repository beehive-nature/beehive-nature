# 2026-10-15 · BNROSE-NETPART-001 — the two-host partition harness with an independent destination

Order: founder, 2026-10-15 (successor to the ruled milestone; start from
current main — base `8b2cfe606`). Delivered from
`wt-zcode-bnrose-rust-001`, branch `zcode/bnrose-netpart-001`.

**The initial result, as ordered: local safety, destination execution,
and finality are DISTINGUISHED — three separately attributed facts, in
data, in every scenario's assertions.**

## The harness (three roles, real processes)

- `crates/bnrose-netpart/src/bin/bnrose-dest.rs` — the independent
  destination: its own process, its own durable acceptance log
  (append+fsync, restart-replay), idempotent acceptance per transaction
  id, and the state ladder `pending → included → final` advanced only by
  its own `advance` admin command (block production). Inclusion,
  execution, and finality are ITS facts.
- The fault injector (destination-side, per client label): `drop` =
  handled durably then the acknowledgement is LOST (the sender times out
  on a fact); `delay(ms)` = the answer arrives past the client's window;
  `blackhole` = the request never arrives. Partitions are reproducible,
  not simulated.
- The host driver (`Host`): claim + replicated journal + the merged
  core's admission/transitions, with the destination as the effect
  boundary. The persistence law holds — identity, the exact signed
  bytes, and the transaction id are journaled on both replicas BEFORE
  submission. The local ledger is deliberately NOT at this seam: its row
  would blur the destination's facts; observations are journaled as
  records instead.

## The five scenarios (all green; real TCP on loopback)

| # | scenario | what it proves |
|---|---|---|
| s1 | delayed requests | a 1.5s answer against a 400ms window is UNKNOWN — one signed attempt, never re-signed; resolution is by pure observation after healing |
| s2 | lost acknowledgements | the destination ACCEPTED durably but the ack was dropped → UNKNOWN; healing rebroadcasts the IDENTICAL signed bytes → `duplicate` (an observation, never a promotion) → finality OBSERVED |
| s3 | duplicate delivery | three re-deliveries answer duplicate while the transaction is still pending — zero promotions to success |
| s4 | competing recovery | host A dies UNKNOWN; host B (a different sovereign directory, the durable state copied, its own claim) rebroadcasts the identical bytes — destination idempotency protected the effect (exactly one acceptance), local exclusion protected each process |
| s5 | reconciliation | a full both-hosts partition; after healing, independent observations CONVERGE on final; a fresh destination process honestly knows nothing (absence stays absence, never silently downgraded) |

Every scenario asserts the three-fact distinction:
`localSafety.oneSignedAttempt == true` (the claim + journal's doing),
`destinationExecution.included` (only the destination's `included`),
`finality.final` (only the destination's `final` — and the summary
labels it "the destination's own state, observed").

## The laws this harness enforces, from the rulings

- Worker death / timeout without a conclusive outcome is UNKNOWN — never
  never-executed (the milestone law, now at a real network seam).
- A duplicate response is a reconciliation observation; it never
  promotes UNKNOWN to success (s3 convicts this directly).
- Governing rule, executable: local exclusion protects a process;
  destination idempotency protects an effect; consensus and finality
  are established independently (s4 is that sentence as a test).

## Boundaries stated

- The destination is a stand-in settlement endpoint — its ladder models
  inclusion/execution/finality with REAL state separateness and REAL
  process/network boundaries, but it is not a chain: no cryptographic
  consensus, no adversarial producers. The adapters' order (Arbitrum/
  Hive with destination-side enforcement named) replaces this stand-in;
  the harness's scenarios carry over.
- Non-spending fixtures throughout; loopback TCP with OS-assigned ports
  (CI-safe); no production assets, no founder approval loop.
- Full regression: 20 suites green (netpart + the merged exec crates);
  the destination's restart-replay is exercised implicitly by s5's
  fresh-process check.

HUMAN INTERACTION: NONE · NEXT OWNER: authorized merger.

## Layer 2 (the founder's source review of #444, answered same lane)

The review's verdict stood: layer 1 is a loopback fault-injection
integration test — hosts lived inside the test process. Layer 2 is now
FOUR independent executables per scenario: `bnrose-host` (a sovereign
host as its own binary — claim, journal, merged core, destination
client), `bnrose-proxy` (the THIRD process: a network middlebox whose
rules file drops, delays, or severs — `drop-ack` delivers the request
and loses only the acknowledgement), and `bnrose-dest`. Every demanded
correction is convicted:

| row | the correction | the conviction |
|---|---|---|
| l1 | CHECKED durable writes | a forced log append failure answers `storage-error`; the acceptance is neither recorded nor acknowledged; one signed attempt stands |
| l2 | CONFLICTING REPLAY refused | same tx id + different bytes = `conflict`, never `duplicate`; the same exact bytes still reconcile as `duplicate` |
| l3 | SAME-LOG RESTART | the destination is killed and restarted on the SAME durable log: states replay (final stays final), idempotency replays (duplicate) |
| l4 | INDEPENDENT HOSTS + REAL ISOLATION + PERSISTED-BYTES RECOVERY | two host EXECUTABLES through the proxy; a `drop-ack` partition lands the acceptance while the sender times out; host B (its own directory, the journal copied, its own claim) rebroadcasts the JOURNAL's bytes → `duplicate`; a mismatching intent file is REFUSED (the journal's submission is authoritative); one acceptance across everything |

Also fixed en route, named: the host binary ended via `process::exit`,
which skips `Drop` — claims leaked and the next invocation on the same
directory panicked; the binary now returns through `run()` so claims
release. `Host::open` loads an existing root instead of refusing to
re-initialize. Nine scenarios green (5 + 4); the model-finality label
stands (`advance` is block-production theatre, honestly named).
