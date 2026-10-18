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

## Layer 3 (the second founder review of #444, answered)

All four named gaps closed, each convicted:

1. **Destination durability, everywhere** — `advance_blocks` is CHECKED:
   an inclusion/finality event that fails its durable write aborts the
   advance with nothing half-moved (memory follows proof). `replay` FAILS
   CLOSED: a corrupted or truncated acceptance log refuses to serve (the
   restart exits nonzero — l5); a MISSING log is a fresh destination,
   honestly empty.
2. **Recovery sourced from the journal** — the rebroadcast now SUBMITS
   the journal's own persisted bytes under the journal's own transaction
   id (`persisted_submission` is the source, not a cross-check); the
   supplied intent remains a refusal gate only.
3. **Proxy fail-closed** — the rules file is a WHITELIST: a label not
   listed is dropped (a client cannot rename itself past a rule); an
   unreadable or malformed rules file severs EVERY connection. The
   topology stays an application-layer proxy over loopback TCP — OS-level
   network isolation remains named, not claimed.
4. **Concurrent competing recovery** — l6: two replacement hosts,
   prepared before either runs, recover the SAME unresolved operation
   SIMULTANEOUSLY (both processes racing); their rebroadcasts are the
   journal's identical bytes; the destination holds ONE acceptance; no
   conflict; both observe final. Sequential handoff (l4) and the
   simultaneous race (l6) are now separate rows.

Also this pass: the branch was DIRTY against advanced main (same-named
dispatch from the sibling netpart lane) — merged, both dispatches
preserved (mine renamed `-harness`). #440's packet-drop evidence stays
separate; real Arbitrum/Hive finality stays the later qualification.
Eleven scenarios green locally.

## Layer 4 (the third founder review of #444, answered — every safety claim matched to an assertion)

1. **The recovery fallback is GONE** (the strongest finding): when
   `persisted_submission` returns None, `drive` now REFUSES
   (`recovery:no-persisted-submission — refusing to invent bytes`); the
   binary exits 1. Deliberate-bug row l7: an empty journal resolving
   with rebroadcast exits 1 with the refusal AND the destination shows
   ZERO transactions — the old code's invented submission is convicted
   absent.
2. **The proxy's unknown mode DROPS** (an explicit `pass` arm exists;
   `_` is denial). Whitelist-keyed-by-client-label remains the named
   stand-in limitation (no authenticated connection identity at this
   layer).
3. **Replay VALIDATES**: missing fields, unknown event types, duplicate
   accepts, and impossible transitions (included/final for unknown tx,
   final without included) all fail closed — l8 convicts each shape.
   **Batch prefix semantics documented AND tested** (l9, via a
   fail-after-N injection): a mid-batch durability failure aborts the
   advance leaving an honest durable PREFIX — exactly one transition
   survives restart, the other stays pending, nothing rolls back proof.
4. **l6 strengthened as specified**: each recovery host's execution
   window is recorded and the intervals must INTERSECT (overlap proved,
   not assumed); both exit codes are CHECKED (3 = UNKNOWN preserved at
   resolve time, finality not yet produced); finality is observed by
   TWO separate processes post-advance, each asserted on its own exit.

Fourteen scenarios green locally (5 loopback + 9 executable). The
fail-log injection is now fail-after-N (l1 keeps fail-immediately).
OS-level host isolation and blockchain settlement finality remain the
named, unclaimed qualifications.

## Layer 5 (the fourth founder review of #444, answered — the regression controls)

1. **l7lib — the DIRECT library row** (the review's principal gap): the
   CLI gate short-circuits before `Host::drive`, so the l7 CLI row could
   not convict a reintroduced library fallback. l7lib calls
   `Host::resolve()` itself on a fresh host with a live destination:
   refusal asserted ON THE OUTCOME (`recovery:…`), zero signatures, and
   the destination's dump shows zero transactions. If the old fallback
   returned, the outcome would be `acked` and this row goes RED.
2. **l8every — every invalid replay shape individually**: eight rows
   (missing txId, accept missing payload, unknown event, duplicate
   accept, included-for-unknown, final-for-unknown, included-twice,
   final-without-included), each its own directory and restart refusal.
3. **l10 — the proxy negative**: an unknown mode severs the connection
   (no answer ever arrives); an explicit `pass` forwards — both asserted.
4. **l6 — conclusive overlap + distinct identities**: the destination
   now serves one thread per connection and CARRIES ITS OWN CONCURRENCY
   GAUGE; a hold/release barrier parks both rebroadcasts in flight and
   the test asserts the DESTINATION'S OWN `maxConcurrentSubmits ≥ 2`
   (process-level fact witnessed by the endpoint, not window arithmetic;
   the window check remains as secondary evidence). Both final-state
   observations now run under each host's OWN label (`observe --label`),
   whitelisted separately.

Seventeen scenarios green locally (5 loopback + 12 executable).
