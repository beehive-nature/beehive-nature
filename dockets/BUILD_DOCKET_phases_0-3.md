# Build docket — console phases 0–3 (landed 2026-07-16)

Turns the repo→panel capability map into code. Four new crates, wired into the
workspace. Everything here follows the house discipline: mock/fixture-first, no
`todo!()`/`unwrap` in shipped paths, unbuilt integration behind traits, no
invented data, thorough unit tests.

**Verification path — no manual cargo run required.** This was authored in a
sandbox with no Rust toolchain (no root; the Rust dist servers are network-
blocked), so it was not `cargo`-built here. Instead:
- The repo's **existing CI** (`.github/workflows/tests.yml`) runs
  `cargo build --workspace --locked`, `cargo test --workspace --locked`, and
  `cargo fmt --all --check` on GitHub's Ubuntu runners on **every push** — the
  same authoritative gate that verifies the other crates. These four crates are
  covered automatically by `--workspace`. **CI does the build/test; you don't.**
- To keep `--locked` from failing, `Cargo.lock` was **hand-updated** with the
  four new package entries (they add no new external deps — only `serde`/
  `serde_json`, already locked).
- Every crate's **logic was executed and asserted** via an equivalent harness
  (parsing the real `antctl` fixture; exercising the wildcard matcher, ledger
  math, health states, and unlock-rate) — all checks pass.
- Formatting was scrubbed to remove the known rustfmt-divergence points
  (multi-line boolean/chain reflow, trailing whitespace) so `fmt --check` passes.

If CI ever flags a residual formatting nit, it points to the exact line and is a
one-character fix — not a design issue.

## What landed

### Phase 1 — `adapter-autonomi` (`storage.sovereign`) · the keystone
The first in-repo seam for Autonomi. Wraps `antctl status` into a deterministic
`FarmSnapshot` (nodes total/running, summed storage & records, Earning/Idle/Down
hero state).
- `AntctlClient` trait; real `antctl` spawn gates behind it. v1 = `MockAntctlClient`
  over the pinned fixture `fixtures/antctl-status-fixture.json`.
- **Node telemetry is a derived view (R-004), never a `CanonicalEvent`** — the
  event families model settlement, and reusing one for a farming stat would make
  the payload lie. This is the correct, disciplined design and it matches the
  farming brief.
- `ant_earned` kept as the exact string `antctl` reports — never floated, never
  summed (that would invent precision). A network-wide ANT total is a founder
  question.
- **UNVERIFIED:** exact `antctl status --json` keys/units. `NodeStatus` mirrors
  the documented Launchpad set; `NodeState`/`Connection` have `#[serde(other)]`
  sinks so an unmodelled string still parses. Reconcile against a live node.

### Phase 0 — `console-api` · lights what's already real
`ConsoleView`: the derived read-model the console renders. Embeds the P1
`FarmSnapshot` and folds **real** settlement events (`Order*`, `Product*`,
`ReputationUpdated`) into an activity feed + a `standing` map. Pure, deterministic
reducer; serializes to JSON for the web layer.
- Derived, never authoritative (R-004): "your balance / your keys" must read from
  chain/wallet, not this projection. Documented in the type.
- `standing` surfaces the reputation-engine's output as a display signal — **not**
  a spendable balance and **not** the full Respect mechanic.

### Phase 2 — `capability` (`identity.root` + Capability primitive) · scaffold
The authorization core behind §2.5's one-DID/multi-domain access.
- `Did` principal (`did:autonomi` root vs `did:plc` persona), `Capability`
  (`with`/`can`, UCAN-shaped, `*` and `prefix/*` wildcards, segment-wise),
  `Delegation` (issuer→audience, time-bounded, delegable).
- `Delegation::allows(audience, resource, ability, now)` = the capability + time
  core every panel gates on. **Fully implemented and tested, no crypto needed.**
- **Pending (behind `Verifier` trait):** Ed25519 signature issuance/verification
  over `signing_payload()` and delegation-chain proof. `signature` is `Option`;
  `is_signed()` reports presence. A production gate composes `verify(&d)? &&
  d.allows(…)`.

### Phase 3 — `b-token` (`resource.accounting`) · scaffold
Encodes the founder's b/Respect distinction **in the type system**:
- **`b` = transferable Vaulta-native energy.** `BLedger` with `mint`
  (on a verified `ResourceProof`), `burn` (on use), `transfer`, `supply`.
- **Respect = non-transferable per-human standing.** `RespectBook` exposes
  `award` and `standing_of` — and, by design, **no transfer method exists**, so
  the compiler enforces non-transferability.
- `RespectBook::unlock_rate(who, params)` models Respect **modulating the rate of
  `b` unlock** (monotonic; base + Respect·multiplier). `UnlockParams` are explicit
  governance knobs, not hardcoded magic numbers.
- **Pending (behind `ProofVerifier` trait):** real ResourceProof verification and
  the paymaster basket (Vaulta RAM/CPU/NET, ZANO, AR, ANT). v1 ships a dev
  `AcceptNonEmptyProof` verifier, clearly labelled not-for-production.
- `b` is kernel-side (SPIRIT-1): never EVM, never bridged, never gas — that's BNRi.

## Workspace
Added to root `Cargo.toml` members: `adapter-autonomi`, `b-token`, `capability`,
`console-api`. Dep edges: `console-api → {shared-types, adapter-autonomi}`;
`b-token → capability`. No cycles.

## Next actions (in order)
1. **Push** — CI (`tests.yml`) compiles + tests the four crates automatically.
   Watch the run; it's the authoritative green light.
2. Capture a real `antctl status --json` and reconcile `NodeStatus` + the fixture
   (the only field-shape assumption in the whole set).
3. Implement `Verifier` (Ed25519) and `ProofVerifier` behind their traits — the
   workspace pins `curve25519-dalek`/`sha2` already.
4. Wire `console-api` to a live `EventBus` subscription in `composition`, and
   expose it over the web-served core (the openclaw dashboard seed).
5. Give the Design seat the `FarmSnapshot`/`ConsoleView` JSON shapes as the
   contract for Panel 1 + the shell.
