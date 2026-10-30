# ANT SDK 0.1.5 consumers (AGENT 2) — dispatch 2026-10-29

Branch: `spark/ant-sdk-015-consumers-2026-10-29`
Base: qualified SDK revision `497ac49173556e630bec0fe2a7c3ff9c7d98d711` (PR #495 head at bank).
Stack: on Wonder's `spark/ant-sdk015-qualification-2026-10-29` while #495 is open.
Ownership: consumer files only. Vendor payload (`vendor/ant-browser-sdk/0.1.5/**`,
`SDK_PINS.json`), runner and receipts stay on #495. No merge or production rollout.

## Source attribution

Consumer delta ported file-by-file from Wonder's commit
`44872214882af1fe77f960374b6f93890b63dcbf` (NOT cherry-picked: the mixed
vendor/consumer commit's SDK payload already matches #495 byte-for-byte, so only
the consumer paths were taken):

- `surfaces/bview.html` (SDK_ROOT 0.1.2 → 0.1.5)
- `surfaces/bpay-invoice.js`, `surfaces/bdrop.js` (ANT_KIT → 0.1.5)
- `e2e/wallet-unified.mjs` (fixture kit path → 0.1.5)
- `e2e/bview-ant-hls.test.mjs`, `e2e/bview-direct.test.mjs`, `e2e/bview-file.mjs`,
  `e2e/bview-mse.test.mjs` (mock SDK routes → 0.1.5)
- `docs/dispatches/2026-10-29-ant-sdk015-qualification-inventory.md` (Wonder's
  inventory, preserved verbatim)

## Mock-route fixes (this branch, with the consumer imports)

The five wallet harnesses still served their inline fixtures at the stale
`.../0.1.1/index.js` URL. Each now registers one guarded route over
`**/vendor/ant-browser-sdk/**` that:

- fulfills only `/vendor/ant-browser-sdk/0.1.5/index.js` from the inline fixture
  (fixture tagged `globalThis.__antFixtureSdk='fixture-0.1.5'`);
- falls through same-version asset paths (`limits.js`, dynamically imported by
  `bpay-invoice.js`) to the default-deny source fixture;
- aborts any other SDK version request and records the path.

Each harness asserts the fixture pin in-page (`window.__antFixtureSdk`) and that
the fixture was served with zero unexpected SDK requests. Deliberate
baseline-version tests: none — nothing on this branch tests 0.1.1/0.1.2
behavior; the ported bView tests already pin 0.1.5.

Files: `e2e/ant-hosted-browser.mjs`, `e2e/keychain-wallet-purchase.mjs`,
`e2e/ant-record-import.mjs`, `e2e/ant-replacement-recovery.mjs`,
`e2e/keychain-devnet.mjs`.

## Qualification-test cutover (this branch, with the consumer imports)

`e2e/bview-sdk-qualification.test.mjs`: the `production still pins 0.1.2`
assertion is the #495-branch invariant and correctly fails here — this branch's
purpose is moving the consumer to 0.1.5. Replaced with `consumer pins the
qualified 0.1.5` (0.1.5 root present, no 0.1.2 root, overlay identity for 0.1.5,
unknown version still throws). All other pins/provenance/closure/refusal/
deadline/browser checks unchanged. Observed the authentic failure first (7/8),
then updated the expectation with the reason recorded.

## Results (consumer worktree, this head, sequential runs)

Five affected suites — all PASS:

- `node e2e/ant-hosted-browser.mjs` — 6/6 (bee/raver/cypherpunk x 320/390px)
- `node e2e/keychain-wallet-purchase.mjs` — PASS, two payments, verified retrieval
- `node e2e/ant-record-import.mjs` — PASS, cases 1–5 + 12 malformed refusals
- `node e2e/ant-replacement-recovery.mjs` — PASS, 7 scenarios (case 7 outcome
  measured; paid-but-incomplete upload with total state loss stays OPEN)
- `node e2e/keychain-devnet.mjs` — PASS, 3 scenarios

Wallet job (CI `wallet` sequence, repo root) — all green:

- batteries fund/vault/matrix/arweave/signer/adapter x cypherpunk/bee/raver:
  18/18 (raver arweave 74/75 first pass — second-tab anchor timing flake
  unrelated to the SDK delta, 75/75 on clean rerun)
- registers 128/128, action-sheet 283, arweave-keys 40, hive 60, accounts 69,
  bridge-acct 82, compose-xss 27, unified 201, hosted-browser (above),
  sdk-qualification 8/8, keychain battery 8/8, guided-flow 9 configs,
  read-budget 9, trezor 28, forge-pq 174, soul-chrome 17

bView regressions (`e2e/` working dir) — all green:

- `bview.test.mjs bview-direct.test.mjs scorecard.test.mjs` — 41/41
- `bview-mse.test.mjs` — 6/6
- adaptive/published/hls/capacity/package-hls incl. `bview-ant-hls.test.mjs` — 17/17

## Remaining gaps

- Hosted CI on the consumer PR (exact head) not yet observed.
- Live transfer/seek evidence is the #495 dataset; not rerun on this branch.
- Raver arweave second-tab anchor check flaked once (timing); watch for recurrence.
- `tools/agent20-ux-shots/` untracked in the worktree, left untouched/uncommitted (not mine; needs owner triage).
- No merge or production rollout assigned.
