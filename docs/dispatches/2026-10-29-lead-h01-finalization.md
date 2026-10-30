# H01 strict finalization and independent expectation arguments

This lane implements the two remaining producer/parser corrections from the
lead review of PR #492. Its upstream is
`a14a78d28ff6b8149ccd0d4d6c42030623af9c97`; it changes three Rust files and
this dispatch in an isolated `spark/lead-h01-finalization-2026-10-29` branch.
Wonder's branch is the target of the child PR. No other seat's worktree is used.

## Executable changes

- `main.rs::required_flag` requires each independent verification expectation
  exactly once: `--session`, `--order-id`, `--public-material`, `--manifest`.
  An omitted option, absent or empty value, whitespace-only value, another
  long option in the value position, or a duplicate option refuses at
  `stage=expectations` before candidate artifacts are opened. Values are
  returned unchanged; the caller's identity and manifest pins remain external.
- `SessionStore::read_checkpoints_strict` preserves every parsed JSONL entry
  in order. Malformed or blank interior lines, invalid UTF-8, and I/O failures
  return an error. A genuinely absent log in an existing sessions directory
  represents an empty inventory; a removed sessions directory or dangling
  checkpoint symlink does not.
- Finalization reads that strict snapshot once. The same entries supply the
  exported array, checkpoint count and signed inventory commitment. An unreadable
  inventory exits `3` at `stage=checkpoint-inventory` before terminal signing
  or acceptance. The legacy best-effort reader remains for existing inspection
  callers and is explicitly documented as unsuitable for evidence finalization.

Strict parsing is distinct from cryptographic validation. The existing saved-run
verifier continues to validate checkpoint signatures, canonical prefixes, order,
inventory commitment and the signed terminal record. This patch changes no
signature algorithm, bzDiD binding, five-field B9 receipt or bSigner interface.

## Regression scope

The existing binary identity-substitution test now exercises 28 malformed
invocations: seven cases for each of the four expectations. Each must refuse at
the named expectation boundary, preserve the original run and independent pins
byte-for-byte, and leave the valid pinned control accepted. Same-session,
same-order, same-manifest actor substitution remains covered.

Four strict-reader tests cover ordered and equal-entry controls, missing and
empty logs, malformed and blank lines, invalid UTF-8, directory/read failures,
removed session storage and Unix dangling symlinks. Existing full-failover,
interior-signature, inventory-commitment and occupied-session tests remain.

## Execution provenance

The cloud shell cannot reach its configured Git proxy and has no Cargo or Rust
compiler. Source was fetched at the exact upstream SHA through the connected
GitHub API. A dedicated local Git checkout tracks the exact fetched source
subset for diff review; it is not represented as a complete repository clone.
The repository's unchanged hook installer, secret scanner and stack-inventory
gate are used locally. Publication applies only the four owned paths to the
real upstream Git tree through GitHub, preserving every other tree entry.

Independent source review found no blocking defect in this focused patch.
Compilation and runtime results are not claimed from this shell. The child PR's
exact published head must pass the existing hosted commands:

```text
cargo fmt -p harness-sovereign -p shared-types -- --check
cargo test -p harness-sovereign -p shared-types --locked
```

Actual hosted receipts are attached to the child PR after completion; greens
from the upstream head do not qualify this change. No workflow, compiler pin,
dependency, SDK surface, payer configuration, or provider authorization changes.
No paid inference calls. H02 current-backend/generation health integration and
live provider qualification remain separate work.
