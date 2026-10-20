# 2026-10-20 — issue #479, first milestone: sovereign peers, pinned retrieval, hard egress caps

Issue #479 is the governing bar ("the fully decentralized, autonomous,
self-healing, civilization-scale BNROSE stack"). Its execution routing
names the smallest decisive milestone: independently administered,
pinned peer-to-peer retrieval WITHOUT the estate door, with hard
payer/egress caps. That milestone is built, tested, and wired as a
required CI check.

## What landed

**`crates/btungsten-sovereign-rails`** (workspace member, pinned
toolchain, no estate anything):

- **The sovereign peer** — serves sealed artifacts from its own local
  store over a peer-local HTTP/1.1 adapter on a DIRECT address (the
  issue's allowed shape: loopback as local adapter endpoint, never a
  mandatory estate gateway). Closed artifact set + shape-checked person
  ids: no traversal, no listing, nothing else exists server-side, and
  the client pre-checks independently (two layers, both named).
- **The egress ledger** — payer-origin invariant in code: chargeable
  bytes are served ONLY from an explicit bounded authorization;
  exhausted, zero or too-small budget REFUSES the paid route (HTTP 402,
  named verdict: "payer authorization required; no estate fallback
  exists") with ZERO chargeable bytes served. Missing budget can never
  become a hidden subsidy — and this crate has no estate route to fall
  back to, structurally.
- **Verification on the wire** — `fetch_and_verify` runs the FULL /2
  chain (pin → state → state.indexSha256 → index → page digests → page
  bytes) over the RECEIVED bytes before returning anything, via the new
  pure `genealogy_publication::verify_seal_artifacts` (the #477 chain
  extracted to a byte-level verifier; the disk-rooted `gp resolve`
  keeps its flow, each locked by its own tests). Bounded reads
  (oversized refused), Content-Length-integrity (truncation =
  `interrupted transfer`, fail closed).
- **The x0x seam, honestly declared** — `x0x::{SEAM, MISSING, STATUS}`:
  authenticated peer forwarding (`x0x forward add --peer …`, bilateral
  ACL — ops/x0x README) is the intended sovereign transport; the missing
  pieces are NAMED (node access: box SSH refused, then timed out, both
  attempts 2026-10-20; ACL/identity provisioning; a bytes-over-stream
  contract above gossip). No hosted proxy substituted. Lab peers
  discover by direct address, labeled as such.

**The two-peer qualification lab** (`tests/two_peer_lab.rs`) — one test,
every control named: green retrieval (wire bytes identical to the
sealed copy, chain verified, correct pin); corruption (tampered store →
`page bytes drift` refusal → healed → re-verified); wrong pin refused;
interrupted transfer (mid-stream truncation → fail closed → serving
peer restarted clean → retry verifies — recovery without an operator);
**the no-budget negative control** (zero-authorization peer → 402
refusal, zero chargeable bytes, no estate fallback); partial-budget
whole-refusal; traversal refused at both layers.

**CI**: `.github/workflows/btungsten-sovereign-rails.yml` (YAML
validated) runs fmt + both crates' tests on every push/PR touching the
crates — the independent-peer and no-estate semantics are now a
required check, not a review note.

## Honest scope (the promotion rules, obeyed)

This qualifies the **funding-free sovereign local-fixture route's
peer-delivery semantics** — exactly what issue §5 allows — and nothing
else. The lab is two peer services on one host, labeled as such: NOT a
multi-host qualification (the topology-claim law), NOT a 10B claim, NOT
fault-tolerant qualification, and it promotes NO rail — every
`qualified:false` in rail-manifest.json stands. The 7,776-participant
cell scale, billion-user economics models, and 1,000-year roadmap
remain open with their evidence requirements intact. No production
ANT/AR upload, no spend, no .b registration; the studio's content and
the frozen lanes untouched.

NEXT OWNER: the x0x authenticated-peer transport adapter (needs box
access — the named missing seam); multi-host repetition of this lab on
independently administered machines; the scale/economics evidence
programs the issue specifies.
