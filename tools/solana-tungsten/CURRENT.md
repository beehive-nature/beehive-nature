# Tungsten integration — October 10, 2026

PR #338 merged at `36cea386fd3e9be242ec1df2275611de2d31a3a6` on October 10.
The tested branch integrated main at `7f339bb0b`; the normal merge also retained
the later main parent `fe3e9b890`. The original experiment and related work on
main are complementary components, with different acceptance scopes.

All nine retained workflows on the integration head `b689fde58` passed:
23 checks succeeded and four unchanged RB lanes were conditionally skipped.
No submitted review findings or unresolved review threads were present.
All nine post-merge workflows on `36cea386f` also succeeded: 23 checks passed,
the same four RB lanes were conditionally skipped, and Pages deployed successfully.
The [integration closeout dispatch](../../docs/dispatches/2026-10-10-tungsten-integration.md)
records the fresh integration and merge evidence. The private-chain receipts
below remain dated October 7; they have not been relabeled as a new chain run.

| Component | Responsibility | Evidence boundary |
| --- | --- | --- |
| `tools/solana-tungsten` | Square-job computation, pinned proof verification, delivery and two local settlement routes | Private chains, trusted fixture grants; not production bPay |
| `scripts/btungsten/wb001*` | Canonical signed intent wire and hostile-input checks | Its compact TLV wire is distinct from this lab's Rust JSON commitment; no interchangeability implied |
| `scripts/btungsten/wb002*` | Sovereign-authority continuity and faithful SimpleAssets behavior | Model tests and a sampled vendored-WASM corpus; not universal equivalence |
| `crates/settle-solana` | Offline native-transfer intent, external signature verification and exact-transaction reconciliation | Does not verify this lab's Groth16 instruction or own an RPC/signing key |
| `tools/firmware/solana-emulator-bench.py` | Trezor/bSAFE emulator signing interoperability | Emulator receipts are separate from physical-device or broadcast acceptance |
| `scripts/lib/bpay-invoice-generic.mjs`, `recon-reconcile.mjs` | Invoice identity and evidence-derived reconciliation | Shared existing functions used by this lab; the unpaid fixture fee remains visible |

There is one repository baseline and an explicit map of the components, not a
claim that their distinct wire formats, authorities or receipts are already one
production protocol. Before connecting the offline Solana crate to this lab's
two-instruction transaction, its exact-message contract must be extended and
tested. Reusing its transfer-only receipt for proof-plus-transfer would be
incorrect. Before using WB001 as this circuit's commitment, regenerate both
proof circuits/keys and demonstrate exact byte agreement.

## Runtime correction

The October 3 receipt passed a single x0x v0.46.0 restart sample. A fresh run
on the integrated tree delivered all 111 messages, then stored the first
payload twice under the same authenticated ingress sender and logical request
ID, with different history message IDs. The failing assertion and SQLite
readback are retained in
[`2026-10-07-v0460-restart-failure.json`](evidence/2026-10-07-v0460-restart-failure.json).
The historical passing receipt is not deleted or upgraded into a general
guarantee.

The lab now pins [x0x v0.46.5](https://github.com/saorsa-labs/x0x/releases/tag/v0.46.5),
commit `427c411c035474ab4fb06102f19815ba4490e6ac`. It is a security release
for authenticated discovery evidence; its release notes do not claim a fix for
this history duplicate. No public node was upgraded by this lane.

`lab/inbox.py:Inbox.receive` independently reserves each sender/logical-ID pair
with an atomic SQLite transaction and binds it to exact payload bytes. A retry
can recover the pending payload but cannot enqueue a second job. A conflicting
payload is refused. Two simultaneous connections can create only one row.
This is a local fixture queue, not a distributed payment-authorization service.
The delivery receipt preserves native-history duplication as a separate field;
the BNR acceptance gate requires queue idempotency and complete receiver history.

## Formal claims and upstream acceptance

The correction already on main concerns **zero padding in the encoded wire**,
not operating costs. The original unrestricted `wireZeroTailRaw` theorem was
false for oversized lengths. The counterexample is now executable and the
corrected theorem states its valid-intent premise. The scope and open
obligations are owned by
[`scripts/btungsten/README.md`](../../scripts/btungsten/README.md) and the
[correction dispatch](../../docs/dispatches/2026-10-08-btungsten-wb001-zero-tail-correction.md).
Sample agreement, a solver timeout, and universal proof remain different results.

David Irvine's [October 5 update to x0x #504](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476)
keeps default byte policy ObserveOnly and calls for
[#1170 per-kind counters](https://github.com/saorsa-labs/x0x/issues/1170) and a
same-workload delivered/published capture. This local two-peer test does not
complete that public-mesh acceptance work. #505 remains closed with prior field
acceptance. No upstream messages were sent.

The older #622 handoff has also been refreshed: David's
[September 30 closure](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450)
moves the outstanding slices and per-pair measurement back to #504. Its ordering
requires unicast caps/DM hedges, consume-only Leaves, then protected-class-aware
shedding, each through the delivered/published matrix. The closed badge does not
mean those slices were completed.

## Current acceptance

See [the October 7 integration dispatch](../../docs/dispatches/2026-10-07-tungsten-current-unified.md)
for exact commands, results and current limitations. Old local throughput is
not a current benchmark: host contention and release changes prevent treating
these separate runs as a controlled performance comparison. CPU, bandwidth,
storage and chain fees remain real costs.
