# Independent H01 frozen-fixture qualification — 2026-10-30

## Result

`execution-001/SUMMARY.json` records **PASS: 27 measured executable cases**,
completed in **18,938 ms**, using a fresh local build of the actual H01 binary.
These are the controller's measured generation/verification/refusal cases, not
27 new product unit tests. The controller's two archive-boundary unit tests also
passed. Its final `cargo fmt -- --check` and locked offline `cargo test` exited 0.

No harness implementation, existing evidence, other owner's branch, policies or
workflows were edited. This receipt is independent lead evidence. It does not
rewrite Agent 3's earlier pre-correction or annotated-archive receipts.

## Frozen inputs and executable

- Source: merged H01 `43b906223860ee34b8e05390c1fe23f6694ba446`.
- Full Git tree: `8973d724aae232a5e08390e88f8b12f14724501f`, equal to the reviewed child candidate's tree.
- Fixture source: `b6b951a3ffbf93946f492e92a48d26c6dcca12ba`, `docs/dispatches/evidence/2026-10-29-spark-h02-b9/manifest.json`.
- Fixture: 5,037 bytes, 40 `items` entries; entry 23 equals entry 7 and still counts. Order: `demo-task`.
- Fixture SHA-256: `acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c`. <!-- PUBLIC-CONSTANT: synthetic frozen manifest digest -->
- Product binary SHA-256: `67207f82a27f64afe6d1a7dd226405cb10fc9b8868ff7fc1ffd5569390ce9085`, 96,893,464 bytes. <!-- PUBLIC-CONSTANT: locally built product binary digest -->
- Controller binary SHA-256 at execution: `810ac57dfd2f3b555f20b4b4ee226530afe6d93207559b884b5eb0316a6c28e2`. <!-- PUBLIC-CONSTANT: local native test controller digest -->

`PROVENANCE.json` retains compiler/Cargo output, binary/source/toolchain digests,
the committed lockfile digest, limits and the controller source digests. The
runner inspected the actual pinned `rustc` executable and required version
**1.98.1**, then captured `cargo build -p harness-sovereign --locked --offline`
with that compiler first in its cleared child PATH. This is a fresh pinned local
qualification. It is separate from the historical hosted action's `+stable`
setup banner. The final binary digest and product-source diff were rechecked.

The new worktree is `wt-chatgpt-h01-frozen`, branch
`spark/h01-frozen-qualification-2026-10-30`. No commit, push, merge or rollout was
performed by this evidence seat.

## Actual results

| Case | Observed result |
| --- | --- |
| Fresh A and B, same session/order/manifest, different identities | Both execute and independently verify under their own retained pins, exit 0 |
| Direct controls restored from public archives | Both verify again; regenerated archives equal originals byte-for-byte |
| Fresh two-checkpoint failover | Execution and original/restored verification pass; `checkpoints_verified=2 same_actor=true` |
| Fresh three-checkpoint failover | Execution and original/restored verification pass; `checkpoints_verified=3 same_actor=true`; middle drops exactly all three transport attempts |
| B's entire public bundle substituted into A's disposable workdir | Exit 3; `archived public material does not match the supplied expectation` against retained external A pin |
| Omit each of session/order/public-material/manifest individually | All four exit 3 at `stage=expectations`; complete valid bundle and all remaining pins stay intact |
| Consistent two-copy checkpoint duplication | Exit 3 at `stage=inventory-commitment` |
| Consistent two-copy checkpoint metadata mutation | Exit 3 at `stage=inventory-commitment` |
| Consistent two-copy inventory reversal | Exit 3 at `stage=checkpoint-order`; this is an earlier order refusal, not a claimed commitment-stage result |
| Interior signature corrupted at checkpoint index 1 in both copies | Exit 3 at `stage=checkpoint-signature`, explicitly naming `checkpoint 1` |
| Same workdir/session reused | Exit 2 naming occupancy; zero requests to the second backend; every original directory and file's exact bytes unchanged; original still verifies |
| Final untouched failover and three-checkpoint controls | Both still verify, exit 0 |

All checkpoint mutations preserve the original signed `run-outcome.json` bytes.
The controller asserts that the mutated exported array equals the parsed
persisted JSONL inventory, so a one-copy mismatch cannot substitute for the
required signature/commitment counterexample. The external identity pins and
golden manifest remain unchanged throughout.

## Evidence layout and replay

- `golden/manifest.json` is the exact Git blob, made read-only before execution.
- `execution-001/pins/` contains only the four original public identity files.
  Each was retained during the loopback `/models` health request before any
  scripted model response. The pins are external to all disposable bundles.
- `captures/` records actual argv, cwd, exit code, timestamps, elapsed time,
  timeouts, and exact stdout/stderr bytes as base64 plus digests.
- `checks/` records the observed conditions and loopback request evidence.
- `archives/` contains byte-preserving public bundles and counterexamples.
  Each wrapper has an explicit public classification and an allowlisted file
  inventory with path, byte length, SHA-256 and original body bytes as base64.
  Machine JSON/JSONL and transcript bytes are not annotated or rewritten by
  archiving. Metadata is outside the signed evidence.

Use the native controller's `restore --archive ABS --dest NEW_ABS` operation to
restore a bundle, then the actual harness's `--verify-only` with the session,
`--order-id demo-task`, the separately retained public-material pin and external
golden manifest. The controller README contains the complete invocation forms.
All four valid archives were actually restored and verified during this run.

`keys/` and `nostr-keys/` are excluded before archive reads and case copies. The
full occupied-session comparison includes those runtime files only in memory;
its published inventory contains lengths/digests, never private bytes. Original
private scratch trees were removed on successful completion. No environment
dump or recovery material is present in public receipts.

## Build-environment provenance

Initial preparation encountered three environment issues, all before the captured
passing qualification:

1. A first `--locked --offline` build exited 101 because the available Cargo cache
   lacked the workspace's `rand` package/index entry. The committed dependencies
   were then fetched through the supported network-enabled build path.
2. That build exited 101 because `pkg-config` was absent. Inspection showed that
   the system OpenSSL headers and libraries already existed. The subsequent
   build supplied their actual `/usr/include` and
   `/usr/lib/x86_64-linux-gnu` paths explicitly; no source or Cargo lock change
   was needed.
3. The sparse checkout initially omitted unchanged `surfaces/pq-kat.json`, which
   bSigner includes at compile time. Materializing that exact HEAD file resolved
   the remaining build-input omission. The next pinned offline build succeeded.

These preparation failures are recorded as environment provenance, not product
test failures. The authoritative complete machine build receipt is
`execution-001/captures/pinned-offline-build.json`, which exited 0.

## Scope and limits

This execution used Ubuntu 24.04 x86-64 and the local dynamically linked debug
binary. The controller currently specifies Linux host tool paths. Its loopback
servers are bounded test fixtures, not new production services. Every model URL
was explicit loopback; child environments were cleared. There were no paid model
calls or remote provider/relay credentials.

This establishes the specified offline frozen-fixture acceptance/refusal cases
for the recorded source and binary. It does not establish live provider
qualification, settlement, host/process-loss continuity, unique-human identity,
bit-for-bit build reproducibility, or 1,000-year durability. #492's applicable
review and current hosted integration gates remain the lead's decision.
