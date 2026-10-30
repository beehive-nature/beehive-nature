# Dispatch: MUSE-SPARK H02 backends (2026-10-29)

**Lane:** Muse Code terminal implementation seat (working with Wonder).
**Worktree:** `C:\Users\travi\wt-muse-spark-h02` (own worktree; the shared
checkout was never staged from).
**Branch:** `spark/h02-backends-2026-10-29`.
**Base:** `059e16f270adae824bf1b6980fc89f5fcdcf78ca` (fetched PR #492 head,
`pr-492-candidate`; H01 acceptance-fixes commit, clean worktree).
**Scope owned:** `crates/harness-sovereign/src/backend.rs` plus the new
separately named test file `crates/harness-sovereign/tests/backend_providers.rs`.
Untouched per lane split: `main.rs`, `lib.rs`, `switch.rs`, `b9.rs`,
`identity.rs`, all dependency manifests (no new dependencies; `std` +
existing `tokio`/`reqwest`/`serde` only).

Standing requirements honored: replaceable providers (config, not code),
owner-controlled keys (env-only, never printed/committed), bounded
resources (every network/retry/output/queue dimension validated nonzero),
explicit payer responsibility (missing credential = fatal, never a
silent fallback; live smoke calls gated on authorized credentials plus
a verified payer/budget — not present, not attempted).

## Configuration interface (`backend.rs`)

- `BackendConfig { name, endpoint, model, credential_var, auth,
  provider, network, retry }` with `validate()` (rejects empty
  name/endpoint/model, non-HTTP endpoints, bearer-without-variable,
  variable-on-no-auth, any zero network budget).
- `AuthMode::{BearerEnv, None}`, `ProviderKind::{OpenAiCompat, LocalPool}`.
- `NetworkBudgets { connect_timeout_ms, header_timeout_ms,
  stream_idle_timeout_ms, max_output_bytes, max_inflight }`
  (defaults 3000/5000/2000/262144/4); `RetryBudgets { max_retries,
  base_delay_ms }` (defaults 2/500).
- `OpenAiCompatBackend::from_config(&BackendConfig)`,
  `backend.config()` round-trip, `build_backend(config)` returning
  `Arc<dyn ModelBackend>` for `main`.
- Tested examples: `BackendConfig::spark_primary()`,
  `openweights_secondary()`, `spark_11_tertiary()` (mirror current
  `main` wiring), `local_pool(name, endpoint, model)` (no-auth
  loopback/pool route, never a fallback).
- `preflight(&backends, per_backend_timeout_ms)` returning
  `PreflightReport { entries: [{ name, healthy, elapsed_ms }],
  elapsed_ms }` with `any_healthy()` / `all_healthy()`.
- Enforcement: `complete()` acquires a bounded in-flight permit
  (`queue full` = failover-eligible transport), sends are header-bounded,
  stream reads are idle-bounded, output is byte-capped (fail closed,
  partial kept), retries are transport/server_5xx-only with configured
  backoff, terminal failures carry `elapsed_ms=` in `detail`.

## Verification (this worktree, offline loopback only)

- `cargo fmt -p harness-sovereign -p shared-types -- --check` → exit 0.
- `cargo test -p harness-sovereign -p shared-types --locked` → exit 0:
  harness-sovereign **58 lib passed** (incl. 4 new config unit tests),
  **12 integration passed** (`tests/backend_providers.rs`),
  shared-types **32 passed**. Remaining warnings pre-existing and
  untouched (dead non-streaming response structs, `nostr`/`relay`/
  `settle`/`tools`/`switch` notes as in H01).
- Loopback fault coverage (all `127.0.0.1`, all with elapsed bounds):
  success+`EndTurn`; stalled headers → transport, 3 hits (polite
  retries), <2.5s; stalled stream → transport with partial `kept`;
  429 → rate_limit, exactly 1 hit (never retried); 503 → server_5xx,
  exactly 3 hits (1+2 retries); missing credential → fatal, 0 hits,
  `health()==false`; local pool → healthy, no auth header;
  cancellation → `Cancelled` with partial; queue-full → transport in
  <1s while the first turn still succeeds; 32-byte flood → transport
  `output budget` with partial ≤32 bytes; health true/500/refused;
  two-backend preflight mixes healthy pool + missing-cred remote.

## Minimal two-backend preflight (for Wonder's `main`)

```rust
let pool = build_backend(BackendConfig::local_pool(
    "pool-local", "http://127.0.0.1:11434/v1", "pool-model"))?;
let primary = build_backend(BackendConfig::spark_primary())?;
let report = preflight(&[pool, primary], 2_000).await;
assert!(report.any_healthy()); // missing creds report false; fix env, don't substitute
```

## Unverified readiness fields (funding-gated, NOT attempted)

No live provider smoke calls were made: no authorized `MODEL_API_KEY`
/ `TOGETHER_API_KEY` observed, no verified payer/budget, no successful
provider calls. Offline work is complete; live rehearsal still requires
those three fields plus the exact-head hosted harness checks. No
production fault injection was performed (loopback only).

## Continuity addendum — provider qualification finish

- PR #492 head moved to `4613c22f` (Wonder: close H01 acceptance).
  Verified read-only: it touches `main.rs`, `switch.rs`, `b9.rs`,
  `tools.rs`, `tests/b9_binary.rs`, `AGENTS.md` — none owned here,
  no changes to `backend.rs`. This lane stays on its
  `059e16f27` base (no rebase requested); all additions remain
  additive and trait-compatible.
- Payer attribution: `BackendConfig.payer` (identifier, never a
  secret); `complete_with_report()` returns an `AttemptReport`
  `{ backend, payer, attempts, retries, classification, fatal,
  cancelled, elapsed_ms }` counting every attempt and retry against
  that payer. Terminal error `detail` now stamps
  `elapsed_ms=N attempts=M`. Retry rule documented on the report:
  replaying a failed inference is the same billed request, never a
  new authorization, and never authorizes repeating an uncertain
  external effect or payment (tool re-execution stays forbidden in
  the switch-owned freeze path).
- Bootstrap record: `BackendConfig::dependencies()` returns the real
  requirements in build order — `endpoint`, then `credential_env`
  (bearer only), then `payer` (when set). Shipped examples carry no
  payer; live calls stay gated until one is set and verified.
- Health monitoring: `monitor_health(backends, interval, cancel, tx)`
  forwards one bounded `HealthEvent { name, healthy, changed,
  elapsed_ms }` per backend per round until cancelled (zero interval
  = single round). Wonder wires it beside the switch prober.
- Verification: `cargo fmt --check` exit 0; full lane gate exit 0 —
  harness-sovereign **59 lib**, **13 integration**
  (`tests/backend_providers.rs`, incl. 503 payer report with
  attempts=3/retries=2 and a 500→200 monitor transition test),
  shared-types **32**. Only pre-existing warnings remain.

## Bank record (lead order 2026-10-29)

- Commit: `3ebe1c0cf89da3dab623e1be62d4373c51e87497` (branch
  `spark/h02-backends-2026-10-29`, published to origin).
- Review: PR #493 (`spark/h02-backends-2026-10-29` → `main`).
- Base: `059e16f270adae824bf1b6980fc89f5fcdcf78ca` (PR #492 head at
  lane start; PR head has since moved to `4613c22f`, which does not
  touch `backend.rs` — no rebase).
- Changed files (this lane only):
  `crates/harness-sovereign/src/backend.rs`,
  `crates/harness-sovereign/tests/backend_providers.rs`,
  `docs/dispatches/2026-10-29-muse-spark-h02-backends.md`.
- Exact commands (from `C:\Users\travi\wt-muse-spark-h02`):
  `cargo fmt -p harness-sovereign -p shared-types -- --check`
  → exit 0;
  `cargo test -p harness-sovereign -p shared-types --locked`
  → exit 0 with harness-sovereign 59 lib + 13 integration passed,
  shared-types 32 passed.
- Retry wording corrected per lead order: each retry is a potentially
  billable attempt under the ORIGINAL bounded authorization; uncertain
  usage after transmission is preserved as-is (`AttemptReport.usage`
  = provider usage on success, `Null` otherwise); a payer identifier
  alone never authorizes spending.
- Remaining gaps: no live provider smoke calls (no authorized
  credentials, no verified payer/budget); no combined-tree validation
  (Wonder-owned `main.rs`/`switch.rs` integration); hosted CI on the
  published head not yet observed.

## Integration requirements for Wonder

- Consume and retain `AttemptReport` on the executable's success,
  failure, cancellation and exhaustion paths (it is returned beside
  every `complete()` outcome via `complete_with_report()`).
- Enforce the remaining run allowance BEFORE dispatch — across
  polite retries and backend switches — from the pre-verified payer
  budget; each retry spends from that same bounded authorization.
- Fence health events to the active backend instance/generation:
  tag `monitor_health` consumers with the backend generation they
  polled, so a delayed primary failure cannot displace a healthy
  replacement after failover.
- Keep waits, queues and evidence bounded and sanitized: honor
  `NetworkBudgets`/`RetryBudgets` end to end, never log credentials
  or payer secrets, and carry `AttemptReport.usage` verbatim
  (including explicit-unknown) into receipts.
