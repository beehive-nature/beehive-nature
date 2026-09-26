# WORKERB2 — watchpay/watchsign independent verification (merge-readiness report)

**Seat:** Workerb 2 (zCode/GLM worker instance). **Date:** 2026-09-16 (UTC).
**Mode:** independent verification per founder dispatch — inspect the unmerged
watchpay/watchsign branches against CURRENT origin/main, reproduce the tests,
identify drift/conflicts/security issues, produce a merge-readiness report.
**NO MERGE performed** (none of main, `codex/z2b-watchpay`, `codex/z2c-watchsign`
was modified).

**Baseline (concurrency protocol, CONCURRENCY-PROTOCOL.md @ce814e30):**
`origin/main = b20d44772c0c310c41f542575bc8829e10bf4d15`, fetched and recorded
before analysis. Shared checkout HEAD (`watch-verify` @856e5c09) not trusted;
all work done from seat worktrees `wt-workerb2*`.

**Evidence bar:** every load-bearing claim below is FACT at a pinned SHA with
the receipt beside it. Test-run receipts are from this seat, this session.

---

## 1. Verdict

**MERGE-READY — every gate finished green, including the full e2e `node` job
on the integration candidate (§4).**

- `codex/z2c-watchsign` @`70dc26f0` is a strict superset of
  `codex/z2b-watchpay` @`76b23661` (the four z2.b commits are inside z2.c's
  history; all six z2.b test files byte-identical at the z2.c tip). **Merging
  z2.c alone delivers everything; a z2.b-only merge would strand z2.c's
  superset and buy nothing.**
- Both branches merge **textually clean** into current main
  (`git merge-tree --write-tree` exit 0, zero conflicted paths, for both).
- All tests reproduce: **65/65 at the z2.b tip, 121/121 at the z2.c tip
  (local, this seat, `cargo test -p watchpay --locked --offline`), and the
  full workspace passes on the integration candidate** (current main × z2.c),
  CI `test` job green in 1m45s.
- Security review of the crate found **no new blockers** (§6); the standing
  honest limits are unchanged and correctly labelled in-tree.
- Two archaeology claims are corrected by measurement (§7): the "186 tests"
  figure double-counts (true unique merge gain = **121 executed tests**), and
  the "313 files / +44,955 lines incl. connect-store" figure was a two-dot
  diff artifact (true payload: **28 files / +6,253** for z2.b, **42 files /
  +14,926** for z2.c, **zero connect-store files**).

---

## 2. Branch inventory (FACT)

| branch | tip (local = origin) | commits beyond merge-base | payload since merge-base |
|---|---|---|---|
| `codex/z2b-watchpay` | `76b23661513d` | 4 (`d435de93`→`f70a4b2d`→`e1ca64b1`→`76b23661`) | 28 files, +6,253/−1 |
| `codex/z2c-watchsign` | `70dc26f08f90` | 6 (the 4 above + `20659754`→`62c60816`→`27303c48`→`70dc26f0`) | 42 files, +14,926/−4 |

- Common merge-base with current main: `8d42da2844bc` (eco-adaptor-sweep,
  2026-09-12). Main has moved **111 commits** past it.
- The whole payload lives in `crates/watchpay` (+ the workspace member line,
  Cargo.lock entries, four dispatch receipts, and — z2.c only — a 6-line
  content edit to `surfaces/dock.html`).
- Toolchain pins identical on branch and main (`rust-toolchain.toml` 1.98.1)
  — no toolchain drift.

## 3. Test reproduction (FACT, this seat, this session)

Local runs, Windows seat, Smart App Control did NOT interfere this session
( contrary to its intermittent os-error-4551 reputation — runs completed):

- **z2.b tip `76b23661`: 65/65 PASS** — lib 14, ledger_lifecycle 11,
  parity_calldata 3, plan_validation 15, receipt_binding 13,
  review_adversarial 5, review_round1 4. `0 failed; 0 ignored`.
- **z2.c tip `70dc26f0`: 121/121 PASS** — lib 16, adapter_signing 50,
  ledger_contention 4 (+1 `#[ignore]`d child arm `child_lock_holder`, by
  design spawned by its parent, never run alone), ledger_lifecycle 11,
  parity_calldata 3, plan_validation 15, receipt_binding 13,
  review_adversarial 5, review_round1 4. `0 failed`.
- The six z2.b-owned test files are **byte-identical** (`git rev-parse` per
  blob) at the z2.c tip — the 65 z2.b tests inside the 121 passed against
  z2.c's HARDENED `ledger.rs` (the only z2.b source file z2.c modified,
  plus lib.rs module wiring). That is the strongest form of the claim
  "z2.c preserves z2.b": not asserted, executed.
- Past CI at the tips corroborates (GitHub runs of 2026-09-12):
  z2.b `tests` green 5m22s; z2.c `tests` green 5m34s; the red runs under
  them are the pre-fix commits (`e1ca64b1` fmt-red → format-only commit;
  `27303c48` dock-red → R2 rider) — the commit story and CI story agree.

**Test-count arithmetic correction:** "65 + 121 = 186" counts the shared 65
twice. z2.c's 121 INCLUDES z2.b's 65. **The merge gain is 121 executed tests
(122 `#[test]` functions including the spawned child arm).**

## 4. Drift / conflict analysis vs current main (FACT)

- File-level intersection between main's 111-commit drift and the z2.c
  payload: **exactly `Cargo.toml` + `Cargo.lock`** — nothing else overlaps.
  Main added `crates/royalreview` to the member list; the branch added
  `crates/watchpay` at a different position. Orthogonal additions.
- `git merge-tree --write-tree origin/main origin/codex/z2b-watchpay` →
  clean tree `570e8367`; same for z2.c → clean tree `b9c13372`.
  **Zero textual conflicts either way.**
- **Integration candidate (verification-only, NOT a merge):** I committed the
  byte-exact merge-tree result of `b20d4477 × 70dc26f0` as `4bddf102` on
  branch `workerb2/integration-z2c-watchsign-2026-09-15` and pushed it so CI
  proves the merged WORLD (this is the only way to run the branch against
  current main — the `tests` workflow has no `workflow_dispatch`):
  - run 35055635823: **`test` ✓ 1m45s** (full `cargo test --workspace
    --locked` incl. all 121 watchpay tests, fmt check, shell-chain lint,
    bSAFE host, bindexer keyless) — **the lockfile and member merge are
    coherent under `--locked`; the crate compiles and passes against
    current main.**
  - **`static` ✓ 52s** (estate checks on the merged tree).
  - **`node` (e2e) ✓ 8m7s** — dock-claims (held-tests hero re-derived as 4
    on the merged tree — the R2 rider's whole purpose, now proven against
    current main), university-smoke, wallet-signer incl. the spend-cap
    mutation test, i18n floors. **All green.**
  - `secret-scan` ✓ 12s.
  - The candidate branch is disposable evidence — delete after the merge
    decision; it touches no one else's refs.

## 5. What the branches actually contain (FACT, read at `70dc26f0`)

`crates/watchpay` — one crate, both lanes:

- **z2.b (offline contract slice):** `plan_model` (versioned, bounded,
  Merkle-only, `deny_unknown_fields`), `plan` (strict validation;
  `ValidatedPlan` fully private — inner plan + derived figures behind
  immutable getters, `sealed_plan_hash` set once at `validate_plan`, no
  mutator, `revalidate` re-derives everything), `pricing` (ceiling = max
  over pools of median16<<depth, never the candidate sum, never
  `Amount::MAX` — the E7 collision answered), `canonical`/`calldata`
  (byte-parity pinned against evmlib v0.9.1's own helper on offline-generated
  vectors), `tx` (decoded-transaction validation), `receipt` (strict
  receipt→tx→batch binding, completed-payment read-back required for Paid),
  `ledger` (durable intent/signed/outcome states, crash points, torn-file
  fail-closed, Unknown never auto-re-signs, HumanGate-only resolution).
- **z2.c (offline Trezor Connect adapter):** `eth` (k256 0.13
  **recovery-only** + EIP-2 low-s as one named check), `signed_tx`
  (strict signed-envelope decode via alloy-rlp 0.3: 128 KiB pre-parse bound,
  library-strict headers, canonical re-encode equality, minimal integers,
  EIP-155 replay law refusing 27/28, only type 0x02 with empty access list),
  `connect` (plan-bound `SignRequest::compose` at the plan's own ceilings;
  `ConnectTransport` trait with **no implementation shipped**; the
  `verify_signed_result` chain: bounds → strict hex → strict decode → family
  match → field-by-field bind → response-v/r/s == envelope components →
  nonzero scalars + low-s → signer recovered from the LOCALLY computed
  preimage must equal `expected_payer` → z2.b `validate_transaction` again;
  `VerifiedSigned` constructible only by that function; `sign_batch_payment`
  one-shot driver, intent-first, single transport call, phase-typed
  Before/AfterDispatch errors, injected clock read twice so expiry-during-
  bridge refuses at the recording boundary), and the z2.c ledger hardening:
  **EXCLUSIVE-WRITER contract** — all 8 public mutations take
  `File::lock` on `<root>/.lock` across their entire read/check/write
  sequence (verified by inspection: `acquire_exclusive` at the top of each),
  public read takes `lock_shared`; cross-process contention proven by
  deterministic tests incl. a real child-process arm.

## 6. Security review findings (this seat's independent read)

**No new blockers found.** Specifics:

- **No `unsafe` anywhere in `crates/watchpay/src`** (grep-verified).
- **No network surface:** no HTTP/ws/tokio/reqwest in the crate; the
  transport is an injected trait with zero shipped implementations; the
  fixture generator (`dev/gen-connect-fixtures/gen.js`) uses local
  `@ethereumjs/*` + `@trezor/connect` package reads only — no fetch.
- **Untrusted-input discipline is real, not cosmetic:** every bridge result
  path bounds length BEFORE parsing (document-level and per-field), hex
  strictness distinguishes byte-strings from quantities, decode is strict +
  canonical-re-encode-equal, and identity figures (signer, tx hash, signing
  preimage) are always computed locally — never taken from the response.
- **Test keys are invented and labelled** (`0x0202…02a`, `0x0303…03b`,
  same-line PUBLIC-CONSTANT markers, "never a wallet"); the only unmarked
  48-hex runs in the branch diff are `Cargo.lock` checksums.
- **Dependencies added:** `alloy-rlp 0.3` (alloy-rs), `k256 0.13`
  (RustCrypto, recovery-only), `primitive-types 0.13` — mainstream,
  same-family as existing workspace crypto; lockfile delta minimal and
  CI-`--locked`-coherent on the integration run.
- **Standing honest limits (unchanged, correctly labelled in lib.rs /
  commit receipts):** PaymentVaultV2 deployment parity UNVERIFIED;
  tx_hash recorded-not-rederived; RPC evidence externally supplied, not
  finality proof; Windows ledger durability documented-not-proven (no
  directory fsync on Windows); no upload-process-death recovery; the z2.b
  synthetic door (`DecodedTransaction` public fields + `record_signed`)
  remains open and is honestly disclaimed as offline-only — the crate does
  NOT claim bypass prevention while it is open; evmlib stays outside the
  workspace build (pinned vectors + checked-in generator).
- One **observation, not a blocker:** `connect_payload()` emits lowercase
  hex `to` addresses while Connect's own examples use checksummed forms —
  Connect accepts both (its init normalizes), and the round-trip is
  re-verified field-by-field after the bridge returns, so nothing rides on
  the display form. Noted for the integration slice only.

## 7. Corrections to GLM-ARCHAEOLOGY.md (this verification's deltas)

1. **"186 tests on unmerged branches" → 121.** z2.c's 121 includes z2.b's
   65 (§3). The archaeology §K "main gains 186 tested-but-unmerged tests"
   and the rider's "186 shelved tests" both double-count. Verified capital:
   **121 executed tests (122 functions incl. the spawned child arm).**
2. **"codex/z2b-watchpay: 313 files, +44,955 lines vs main: watchpay
   contract lane + connect-store" → measurement artifact.** That number is
   exactly the TWO-DOT diff `856e5c09 → 76b23661` (313 files, +44,955/−2,832
   — reproduced), which predominantly measures MAIN's own 111-commit drift
   in reverse. The branch's true payload since the merge-base is **28 files,
   +6,253/−1**, and **zero connect-store files ride either branch** (the
   only "connect" hits are `crates/watchpay/dev/gen-connect-fixtures/`,
   which IS the z2.c lane). Connect-store remains a separate unmerged stack
   (`codex/connect-store-*`), untouched by this verification.
3. Archaeology §D "watchpay/watchsign capital (65 + 121 tests) sits on
   branches — main CI never runs it" — **CONFIRMED** and now also proven
   against current main via the integration run (§4).

## 8. Merge-readiness summary

| dimension | verdict | receipt |
|---|---|---|
| tests at tips | 65/65 + 121/121 reproduced locally | §3, this session |
| tests vs CURRENT main | full workspace green on integration candidate | run 35055635823 `test` ✓ |
| textual conflicts | none, either branch | merge-tree §4 |
| semantic drift | member-list/lockfile only; orthogonal; `--locked`-coherent | §4 |
| static gates | estate/static ✓ on merged tree | §4 |
| e2e gates (dock-claims 4-hero et al.) | node job ✓ 8m7s on merged tree | §4 |
| security | no new blockers; honest limits labelled | §6 |
| branch hygiene | z2.c ⊇ z2.b; merge ONE branch (z2.c) | §2 |

**Recommendation to founder/Astra:** `codex/z2c-watchsign` @`70dc26f0` can
merge as-is — the integration candidate `4bddf102` is byte-what-a-merge-
would-produce, and every job on it finished green (test / static / node /
secret-scan). The z2.b branch then becomes redundant history — do not merge
both.

**Left in place after this mission:** branch
`workerb2/integration-z2c-watchsign-2026-09-15` (verification-only, delete
after the decision), worktrees `wt-workerb2`, `wt-workerb2-z2b`,
`wt-workerb2-z2c`. No main, codex/*, or other seat refs were touched.
