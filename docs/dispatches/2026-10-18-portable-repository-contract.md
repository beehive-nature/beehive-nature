# Portable repository manifest and acceptance verifier

Lane: `codex/portable-repository-contract`, isolated worktree
`wt-codex-repository-contract`. Base: `6b75851d9` (contains the landed CI
throughput/cache work). Date: 2026-10-18, America/Denver.

## Delivered scope

`tools/repository-contract/` adds a complete source-snapshot manifest, offline
content-addressed packaging/restoration, and a deterministic signed-update
acceptance verifier. GitHub remains stage-one hosting and live branch authority.
The verifier returns a shadow transition and never signs, pays, invokes an
execution provider, deploys, merges, or updates an existing ref.

The implementation reuses INVOICE-1 canonical bytes, SETTLE commitments, the
frozen bSigner envelope, the existing noble ML-DSA-65 vendor, and the existing
CI observation format. bSigner, bPay, bindexer and the production backend
contracts are unchanged. See `tools/repository-contract/README.md` for the
closed wire profile, commands, trust model and migration boundary.

`contract.mjs::acceptUpdate` checks an externally pinned current-state digest,
the pinned policy, byte-complete manifest, exact next sequence/previous state,
direct current-head parent, authorized distinct-key signature thresholds and
every required signed suite. `signature.mjs::verifyEnvelope` consumes
`bheart.signature/1`; `bsigner.test.mjs` crosses it with the real frozen Rust
organ. This is a pinned-executor trust model, not an independent computation
proof or audit of the crypto libraries.

Source restoration is explicitly a snapshot with declared parent boundary.
Full history, submodules/LFS, production bootstrap keys, policy/key transitions,
distributed compare-and-swap, independent execution and ANT/AR publication are
not implemented. A later authority store must atomically install only one
transition from a checkpoint. Replays/conflicts refuse after the checkpoint
advances; this pure verifier is not itself an ordering service.

## Decision-changing validation

The local pure/CLI suite covers wrong signatures/roles/domains, quorum counts,
stale state/replay/conflict, altered policy/recipe, wrong Git tree/oid, missing
objects, input/output tampering, missing/skipped/cancelled checks, invalid JSON,
resource limits, and unsigned GitHub evidence. An offline fixture is restored
to a fresh bare Git repository and checked for exact commit/tree plus strict
Git object integrity. The native suite builds the existing bSigner and verifies
its actual proposal and executor envelopes through the new consumer.

Initial harness run: 53/55 passed. The two failures were test-fixture mistakes:
`Buffer` compared with its `structuredClone` `Uint8Array`, and a competing
proposal fixture whose payload map changed without updating its manifest.
Both were corrected; the subsequent pure/CLI run passed 59/59 with zero skips.
The real bSigner interoperability run passed 1/1 with zero skips after a
successful locked `cargo build -p bsigner`. Final pre-push and CI receipts are
reported in the PR, bound to the candidate and actual merge separately.

Combined local run before checkpoint hardening: **90/90 passed, zero skipped**, comprising 60 new
repository tests and 30 retained CI policy/observation tests, on Node 24.18.0
and Git 2.55.0.windows.2. CI separately runs the static suite on Node 22.

Pre-merge inspection added `state.last_proposal`: every next checkpoint now
retains the SHA-256 commitment to the accepted manifest and predecessor through
its proposal, beyond Git's head/tree identifiers. An adversarial test holds the
Git head/tree constant and changes a carried artifact; the accepted checkpoints
must differ. The amended candidate is requalified, not covered by old CI.
The resulting combined local run passed **91/91, zero skips**.

A real estate snapshot export carried 27,901 objects from initial candidate
`c4cc89358` (roughly 556 MB of source blobs). Its restoration probe exposed the
cost of invoking Git per object and was stopped with its partial directory
preserved. The adapter now writes Git's standard compressed loose objects and
retains final strict Git validation. This changes only the I/O implementation,
not the manifest or acceptance bytes. Final full-snapshot restoration and
candidate/merge receipts are recorded in the PR after completion.

Existing CI receives two steps: pure/CLI tests in `static`, real-organ
interoperability after the already-built workspace binary in `test`. There is
no additional workflow or duplicate build; existing checks are retained.

## Upstream priority checked before implementation

Current upstream discussion supersedes the older #622 handoff: David's
2026-09-30 comment closes #622 into **x0x #504**, which remains open. His latest
2026-10-05 direction calls for per-kind counters (#1170) and a same-workload
delivered/published capture; default-policy changes require ADR 0078 and
envelope collapse ADR 0101. #505 was field-accepted on 2026-09-15, explicitly
separating handshake fragmentation from gossip efficiency.

Sources: https://github.com/saorsa-labs/x0x/issues/622,
https://github.com/saorsa-labs/x0x/issues/504,
https://github.com/saorsa-labs/x0x/issues/505. This lane changes no x0x transport,
fanout, shedding default, daemon or network deployment and claims no new field
capture. It implements the repository's offline consumer contract.
