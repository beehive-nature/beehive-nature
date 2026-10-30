# ANT SDK qualification corrections — lead, 2026-10-30

Source: consumer PR #497 at `22845fe12e2aadb015e618d4c5fbfd11749ff99e`,
including qualification PR #495 at `497ac49173556e630bec0fe2a7c3ff9c7d98d711`.
Own worktree: `wt-chatgpt-ant-sdk-015`; branch:
`spark/lead-ant-sdk-015-corrections-2026-10-30`.
The actual #497 base is Agent 2's `spark/ant-sdk-015-qualification-2026-10-29`;
the similarly named Wonder branch remains untouched.

## Findings reproduced before correction

Both submitted heads have 44 successful hosted checks and eight conditional RB
skips. The consumer's push and PR wallet logs each show eight SDK qualification
tests passed. Those greens did not exercise these three cases:

1. The HTML selector only rewrote the 0.1.2 root. After the consumer changed to
   0.1.5, requesting the baseline threw “candidate HTML carries no selectable SDK
   root.” Two independent source reviews reproduced the four-way matrix against
   the complete original HTML: both selections worked before the consumer change;
   baseline selection failed afterward.
2. The live reader's seed-loss test called a function absent from index.js.
   Its broad refusal assertion accepted TypeError. This does not establish the
   claimed seed-loss case in the historical “9/9”; the other measurements and
   original receipts are preserved.
3. The summary writer promised digest-mismatch refusal but copied accepted=true
   into a successful output with wasmDigestOk=false. A supplied wrong WASM digest
   reproduced that behavior. The live transfer runner has separate asset checks;
   this finding does not establish a live-transfer bypass.

Reviews: #495 review 5709873184 and #497 review 5709858758.

## Implementation

New host verification/control is Rust in `tools/ant-sdk-qualification`, with
locked dependencies and the repository's pinned Rust 1.98.1. The existing
Node modules are thin process/Playwright adapters with no fallback verifier.

The native process owns SHA-256, per-arm asset pins, full directory verification,
bounded import traversal, HTML arm selection and receipt-summary validation.
It accepts one JSON request, emits one result, and exits nonzero on invalid input.
Input/file, inventory, traversal and aggregate limits are explicit; the adapter
also enforces a 30-second process deadline. This is local tooling with no server,
wallet, payer, signer or model-provider integration.

Both source HTML versions can select either supported arm, with the corresponding
SDK labels updated. Identity and roundtrip controls compare complete bytes against
an independently constructed expected baseline. Missing, unknown and ambiguous
roots refuse.

Summary validation checks both supplied digest inventories, detects conflicting
arms/outcomes, refuses present mismatches and successful outcomes without entry
and WASM evidence, and validates everything before replacing SUMMARY.json.
Reported measurement outcomes remain distinct from recorded asset provenance.
A nonempty content hash never becomes an integrity pass. Historical failed or
unknown measurements without complete evidence stay explicit missing rows.
This compares recorded digests against pins; it does not authenticate the author
of an unsigned receipt or reconstruct a content-transfer proof.

The seed-loss case invokes the actual network-profile.js export, first passes a
valid bundled profile and then requires AutonomiError / CONNECTION_FAILED.
A missing function, TypeError or failed valid control cannot count as refusal.
The existing offline browser test exercises both actual SDK versions and bundled
WASM while blocking external HTTP, WebRTC and WebSocket attempts. Browser
prerequisites may be reported as unavailable locally; in CI they fail instead
of silently skipping.

The workflow adds native formatting, tests and release build before the existing
browser qualification suite. The standalone tool is explicitly tested there.
The module check covers supported pinned syntax with bounded traversal; it is
not a general JavaScript dependency proof. The reader rule is no bare/external
imports; SDK-local helper filenames containing payment are not excluded by name.

## Actual local verification

Environment: Linux x86_64; Node v24.22.1; rustc 1.98.1 (48a229cea 2026-09-01),
cargo 1.98.1. Official compiler-component archives were checked against the
downloaded official 1.98.1 channel manifest before installation under /tmp.

- `cargo fmt --manifest-path tools/ant-sdk-qualification/Cargo.toml -- --check`:
  exit 0.
- `cargo test --manifest-path tools/ant-sdk-qualification/Cargo.toml --locked --offline --target-dir target/ant-sdk-qualification`:
  12 boundary tests passed, 0 failed.
- `cargo build --manifest-path tools/ant-sdk-qualification/Cargo.toml --locked --offline --release --target-dir target/ant-sdk-qualification`:
  exit 0.
- Native asset verification: 0.1.2 = 29 files / 5,759,915 bytes;
  0.1.5 = 31 files / 6,283,793 bytes. Both graph checks passed both versions.
- `node --test e2e/bview-sdk-qualification.test.mjs`: six passed, zero failed,
  two skipped locally because Chrome is unavailable. This is not an eight-test
  browser pass.
- Direct offline invocation of both actual vendored validators with each local
  WASM: valid-profile controls and exact CONNECTION_FAILED refusals passed;
  fetch attempts = zero.
- Summary adapter on a disposable copy of all 30 historical receipts: 28 rows
  with matching recorded asset provenance, two explicitly missing. The original
  receipt directory is byte-unchanged.
- Missing-browser CI negative control selected only the two browser tests:
  exit 1, two failures, zero skips, as required.
- Node syntax checks and `git diff --check`: exit 0.

The first restricted-sandbox Node integration attempt stalled at subprocess stdin
closure and was terminated. Even an independent execFileSync(cat) probe returned
its bytes but timed out waiting for EOF. The supported escalated execution passed
that unchanged probe and the six offline tests. No product protocol workaround
was added. The official Chromium archive URL returned HTTP 200 with a 195-byte
“Site Unavailable” HTML page, not a ZIP; local browser execution remains unclaimed.

The local release executable SHA-256 is
`896f94582080e20c228932a658957e97950795368df5a3fea1cac0952f3081c3`. <!-- PUBLIC-CONSTANT: locally built public tool artifact -->
This digest identifies this build, not bit-for-bit reproducibility.

## Historical evidence and integration

All upstream SDK bytes, production consumer files, original receipt JSON and
historical SUMMARY.json remain unchanged. No live retrieval, seek, upload, payment
or model-provider campaign was rerun. The new host policy implementation is Rust;
JavaScript remains at the existing browser/Node invocation boundary.

The complete SDK stack must qualify at the corrective published head before
main integration. Prior green commits are provenance, not a hosted pass assigned
to this descendant. The parent and consumer PRs remain held while that candidate
is reviewed. H01, its evidence lane, bSigner, bzDiD and settlement contracts are
outside this correction.

The changes provide bounded offline checks and replaceable local tooling toward
the standing system requirements; they do not demonstrate 10-billion-human scale
or thousand-year continuity. Receipt/key continuity is not unique-human proof.
