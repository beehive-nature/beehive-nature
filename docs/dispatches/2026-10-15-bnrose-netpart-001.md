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
