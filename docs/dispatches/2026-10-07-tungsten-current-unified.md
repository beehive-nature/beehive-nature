# Tungsten current baseline and integration receipts — October 7, 2026

PR [#338](https://github.com/beehive-nature/beehive-nature/pull/338) brings the
private-chain experiment forward to main `7a23164b5`, retaining all 335
intervening commits in a merge descendant. Work is in the owned
`C:\Users\travi\wt-codex-solana-tungsten` worktree. The historical October 3
evidence remains unchanged. Run directory timestamps use UTC October 8;
this dispatch uses the founder's America/Denver October 7 date.

## One component map, explicit contracts

[`CURRENT.md`](../../tools/solana-tungsten/CURRENT.md) connects the Rust worker,
x0x delivery, Groth16/Solana and PLONK/Spring lab to the WB001/WB002 workbenches,
the offline `settle-solana` crate, bSAFE firmware emulator and existing
INVOICE-1/RECON-1 functions. The related READMEs link back to that map.

WB001's TLV commitment is not this lab's Rust JSON commitment. The offline
Solana crate accepts native transfer plus memo, not this lab's verifier plus
transfer. Neither is silently substituted. Wiring those contracts together
requires explicit message/circuit changes and fresh acceptance. No production
custody, shared cross-rail authority or public-chain deployment is claimed.

## A failed rerun changed the implementation

The initial refresh with x0x v0.46.0 delivered all 111 messages, then failed:

```
AssertionError: restart retry duplicated receiver history
```

Read-only SQLite inspection found the same sender, logical ID and payload in
rows 2 and 113, with different history message IDs. The public counterexample
is [`2026-10-07-v0460-restart-failure.json`](../../tools/solana-tungsten/evidence/2026-10-07-v0460-restart-failure.json).
The old passing sample therefore cannot establish universal history deduplication.

`lab/inbox.py:Inbox.receive` now uses an atomic SQLite transaction with FULL
synchronization to reserve `(sender, logical_id)` and bind exact payload bytes.
Reopening the database refuses a second enqueue; changed bytes under an existing
ID are refused; two competing connections reserve only one row. This protects
the fixture queue. Settlement still requires its own proof, authorization and
durable replay protection. Changing logical IDs does not grant spending authority.

`x0x_delivery.py:run` preserves raw history duplication in its receipt and
separately checks all 111 queue entries across reopen. `reconcile.mjs` requires
those inbox gates. CI now runs the two focused inbox tests.

The lab upgrades to [x0x v0.46.5](https://github.com/saorsa-labs/x0x/releases/tag/v0.46.5),
source `427c411c035474ab4fb06102f19815ba4490e6ac`, with the release archive checksum
pinned in `lab/provision.py`. This security release addresses authenticated
discovery evidence. No claim is made that it fixes the observed history duplicate.
Its isolated-runtime source is byte-identical to the previous pinned helper.
Only this private lab's binary changed; no public x0x node was upgraded.

The first v0.46.5 run passed delivery and Solana, then failed during Spring boot
contract deployment. Its producer logged `Failed to connect: Connection timed out`
and `Failed to read response: Connection timed out`; the chain remained at head 1.
The installed nodeos help reports a default 5 ms wallet signing RPC budget.
`vaulta.py:main` now uses 100 ms for this local lab and `wait_feature` polls actual
protocol activation instead of assuming 1.5 seconds is sufficient. It also
reports the failing cleos exit code. The retained diagnostic is
[`2026-10-07-spring-startup-failure.json`](../../tools/solana-tungsten/evidence/2026-10-07-spring-startup-failure.json).

The next run reached settlement, irreversibility and restart replay refusal,
but its final table read failed with `Error 3015010: ABI serialization time has
exceeded the deadline; serialization time limit 15000us exceeded`. The private
node now uses a 150 ms ABI serialization budget, with all exact balance, proof
and authorization assertions unchanged. The failed run is retained as
[`2026-10-07-spring-readback-failure.json`](../../tools/solana-tungsten/evidence/2026-10-07-spring-readback-failure.json).

## Current full acceptance

`./tools/solana-tungsten/lab/run-local.ps1` exited **0**, with complete public
evidence in [`2026-10-07-local.json`](../../tools/solana-tungsten/evidence/2026-10-07-local.json).
The private run is `/home/travi/bnr-tungsten-lab/run-20261008-023727-bc7b80ae`.

- x0x v0.46.5: all 111 receiver payloads verified, zero extra history rows in
  this restart sample, 111 durable inbox entries, replay and changed-byte reuse
  refused. The final sequential 100-message batch measured 5.837/s and p95
  368.03 ms, 474,290 payload bytes, 9,479,003 loopback TX bytes, 8.19 CPU seconds,
  and peer RSS 74,158,080 / 78,991,360 bytes. Loopback TX includes API polling
  and is not public-network egress. These timings include inbox persistence.
- Solana: seven faucet lamports finalized at slot 11, 92,229 compute units and
  5,000 lamports network fee. The forged proof failed on chain; its transfer
  rolled back. Signed-outbox recovery in a new worker process did not pay twice.
  The boundary is exercised by `lab/solana.mjs` and `lab/solana_recover.mjs`.
- Vaulta/Spring: matching PLONK verification and seven conserved fixture units,
  irreversible at block 8, 56,057 us CPU and 110 NET words. Forgery, recipient
  mismatch, amount overrun and replay after node restart were refused.
  `lab/tungsten.cpp:tungsten::settle` checks the grant before calling the copied
  `plonk_verify`, then atomically debits escrow, credits the recipient and marks
  the grant spent. `lab/vaulta.py:main` checks chain finality and exact balances.
- Existing INVOICE-1/RECON-1: both routes report **PARTIALLY-SATISFIED** because
  the distinct one-unit fixture fee is unpaid. Duplicate evidence is counted
  once. The common semantic core matches while rail-specific evidence remains.

The exporter requires all three namespace admissions/exits to pass and records
public proofs, keys, tool/source hashes and npm audit metadata. Private wallets
and signing keys are outside the export. The historical and failed-run evidence
remain separately available rather than being overwritten by this success.

## Focused checks on the integrated tree

| Command / scope | Observed result |
| --- | --- |
| `cargo test --locked --manifest-path tools/solana-tungsten/Cargo.toml` | 8 passed, 0 failed |
| `cargo test --locked -p settle-solana` | 8 boundary tests passed, 0 failed; binary/unit/doc targets contain 0 tests |
| Five WB001/WB002 `node --test` files | 42 passed, 0 failed |
| `node --test plur-festival-entry.test.mjs plur-eternal.test.mjs` from `e2e` | 13 passed, 0 failed |
| `python3 -m unittest discover .../lab -p 'test_*.py' -v` in WSL | 2 passed, including competing inbox connections |
| Experiment `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` | Both exit 0 |
| `node tools/solana-tungsten/run.mjs` | Exit 0; dry-run reconciliation correctly OPEN |
| Git-for-Windows `bash.exe e2e/hooks-installed.test.sh` | All absent/wired/block/marker/clean cases pass |

The five workbench test files are `wb001.test.mjs`, `wb001-boundary.test.mjs`,
`wb001-bridge.test.mjs`, `wb002.test.mjs`, and `wb002-hardening.test.mjs` under
`scripts/btungsten`. They establish sampled executable results, not universal proof.
Initial Windows `python` and bare `sh` commands were unavailable; the recorded
passes use WSL Python and the installed Git-for-Windows Bash respectively.

The old PR CI failure was `plur-festival-entry.test.mjs:75`,
`raver: the press lands on the section`. Main already contains the repair,
including `a79d32e5a2eabbfab16092d16252e4e8fcc3babc` (instant iframe re-landing).
This lane imports that repair and verifies it; it does not claim authorship.
Fresh pushed-head CI is separate from these local results.

## Formal scope, upstream priority and costs

Main's [WB001 correction](2026-10-08-btungsten-wb001-zero-tail-correction.md)
concerns zero padding in encoded wire bytes, not operating expenses. The old
unrestricted `wireZeroTailRaw` claim has an executable oversized-length
counterexample; the correction states `validIntent` as a premise. Open solver
obligations remain open. No universal-standard certification follows from this lab.

David Irvine's [October 5 #504 comment](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
keeps the default byte policy ObserveOnly, with default shedding tied to ADR0078,
envelope changes tied to ADR0101, and per-kind counters tracked in open
[#1170](https://github.com/saorsa-labs/x0x/issues/1170). A same-workload
delivered/published capture remains distinct from this isolated loopback test.
#505 is closed with its prior field acceptance; no upstream messages were sent.

The standing #622 handoff was checked against its current discussion:
[David's September 30 closure](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
moves the remaining slices and per-pair measurement back to #504. The sequence
is unicast caps/DM hedges, consume-only Leaves, then protected-class-aware
shedding, with every step gated by the delivered/published matrix. Closing #622
does not establish completion of those slices.

The lab measures two same-host peers and sequential HTTP-controlled sends.
It does not establish mesh scale, partition/churn behavior, adversarial load,
independent cryptographic audit, production bPay authority or cost-free operation.
CPU, bandwidth, persistent storage and chain fees remain real costs. Timing from
these contended-host reruns is not a controlled comparison with October 3.
