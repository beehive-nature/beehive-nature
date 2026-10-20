# Dispatch: harness-sovereign R1–R6 + transport seam (2026-10-19)

**Lane:** Rust harness ("Kill the Model, Keep the Agent", kernel-native).
**Branch:** `spark/harness-sovereign` (worktree `wt-spark-harness`, base `main`).
**Reference:** `workspace/hackathon-harness` Python B1–B7 (5/5 smoke) + SPEC v1.
**Status:** R1–R7 code-complete with ports verified test-for-test; 41/41
harness tests + 32/32 shared-types tests pass. NOT YET: live run against
real backends (needs `MODEL_API_KEY`/`TOGETHER_API_KEY`), hosted CI,
x0x second adapter.

## What landed

- `crates/bsigner/src/lib.rs` (new): the organ as a library. CLI untouched.
- `crates/harness-sovereign` (new): `backend` (R1: taxonomy, retry,
  streaming SSE, cancellation), `identity` (R7: `did:b:`, library-signed
  checkpoints), `switch` (R2: freeze/checkpoint/orphan/handoff/resume,
  byte-parity oracle vectors from the Python), `tools` (R3: fenced
  protocol, sandbox jail), `transport` (capability trait) + `nostr`
  (R4: first adapter, bus bridge both directions), `relay` (R5: local
  relay, id-validated, tag filters), `settle` (R6: full lifecycle, library
  signing), `main.rs` (§3 topology wiring).
- `crates/shared-types`: additive `AgentStatus`/`AgentCheckpoint`
  variants + `AgentEvent` payload + `SourceChain::Harness` (bundled with
  R2 per founder call; precedent BIND-1 K-6). Kernel tests extended, all green.

## Decisions (locked)

- Transport is a trait; Nostr is one adapter, x0x the next. Harness names
  no wire protocol outside adapter modules (founder layering ruling).
- bSigner is linked, never spawned. Envelopes are library-shaped, not
  CLI-shaped (behavior parity, not byte parity).
- No control repeat, no `2360cc78` rebuild: original qualification stands.
- Documented deviations from the Python: tungstenite frame limits instead
  of the 1 MiB cap; no 120 s idle-socket kill; receipt JSON indent-2 in
  state files (tool results stay indent-1).

## Open for next seat

1. Live demo run (`main.rs`) once API keys are available; kill-a-relay beat.
2. x0x transport adapter behind the same trait.
3. Hosted CI on the branch (local MSVC/Windows runs only so far).
4. Cross-run parity: Rust transcript hashes vs Python on a shared fixture.

## Verification

`cargo test -p harness-sovereign -p shared-types` → 41 + 32 pass, 0 fail.
`forbid(unsafe_code)` throughout. No secrets in tree. Temp key dirs in tests.
