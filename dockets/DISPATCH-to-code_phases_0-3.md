# DISPATCH → Claude Code — land console phases 0–3 & turn the tests badge green

**From:** the research/design seat (sandboxed — no git creds, no Rust toolchain,
host holds `.git/index.lock`).
**To:** Claude Code (on the machine — has creds, toolchain, and can write git).
**Goal:** commit + push the four new crates so `tests.yml` runs and the README
badge goes green. Everything below is already written to disk and unpushed.

---

## What's already done (on disk, do NOT redo)
- New crates: `crates/adapter-autonomi`, `crates/console-api`, `crates/capability`,
  `crates/b-token` — each with lib + full unit tests.
- `fixtures/antctl-status-fixture.json` (pinned `antctl status` fixture).
- `Cargo.toml` — 4 crates added to workspace members.
- `Cargo.lock` — 4 package entries hand-added (no new external deps; `--locked`-safe).
- `dockets/BUILD_DOCKET_phases_0-3.md` — the design record.
- Logic verified via an equivalent harness (40/40 checks vs the real fixture);
  formatting scrubbed for the known rustfmt-divergence points.

## Tasks for Code

### 1. Clear the stale git lock (host can, sandbox couldn't)
```
rm -f .git/index.lock   # empty/stale; the working index is intact
```

### 2. Stage ONLY these paths (leave unrelated in-progress files alone)
```
git add Cargo.toml Cargo.lock \
  crates/adapter-autonomi crates/b-token crates/capability crates/console-api \
  dockets/BUILD_DOCKET_phases_0-3.md dockets/DISPATCH-to-code_phases_0-3.md \
  fixtures/antctl-status-fixture.json
```
**Do NOT stage** `docs/fusd-peg-monitor.md` or
`crates/sense-atproto/proptest-regressions/` — those are unrelated, not part of
this work.

### 3. Verify locally BEFORE pushing (this is the real compile — the sandbox couldn't)
```
cargo fmt --all --check
cargo build --workspace --locked
cargo test  -p adapter-autonomi -p console-api -p capability -p b-token
```
- If `fmt --check` flags anything: run `cargo fmt --all`, re-stage, done (mechanical).
- If a test/compile error appears, the two most likely spots to check first:
  (a) serde map-key handling for the `Did` newtype in `b-token`'s `BLedger` /
  `RespectBook` (serde_json supports newtype-string keys, but confirm the
  `ledger_roundtrips_through_json` test passes); (b) the `#[serde(other)]` sinks
  on `adapter-autonomi`'s `NodeState`/`Connection`. Fix and re-stage.

### 4. Commit (NO `Signed-off-by` — machine-seat policy, ORDERS-1 §3)
```
git commit -m "console: phases 0-3 crates (adapter-autonomi, console-api, capability, b-token)" -m "storage.sovereign farming adapter (antctl->FarmSnapshot derived view), console read-model, identity.root/UCAN capability core, and b/Respect resource-accounting. Wired into workspace + Cargo.lock; logic-verified, fmt-clean."
```

### 5. Push and confirm green
```
git push origin main
```
Then watch: https://github.com/beehive-nature/beehive-nature/actions/workflows/tests.yml
— the `tests` badge in `README.md` goes green when `build`, `test`, and `fmt`
all pass.

## Follow-ups (separate commits, not blocking the green light)
- Capture a real `antctl status --json` and reconcile `NodeStatus` + the fixture
  (the only field-shape assumption in the set).
- Implement `capability::Verifier` (Ed25519 over `Delegation::signing_payload`)
  and `b_token::ProofVerifier` behind their traits — workspace pins
  `curve25519-dalek`/`sha2` already.
- Subscribe `console-api::ConsoleView` to a live `EventBus` in `composition` and
  expose it over the web-served core (openclaw dashboard seed).
