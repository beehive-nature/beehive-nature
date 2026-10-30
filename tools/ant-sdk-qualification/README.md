# Native SDK qualification

This standalone Rust tool owns the host-side checks used by the ANT browser SDK
qualification harness. It reads local public artifacts only; it has no network,
wallet, payment, signer or model-provider integration. The browser harness retains
SDK invocation and browser lifecycle handling.

Build with the repository's pinned toolchain:

```text
cargo build --release --locked --manifest-path tools/ant-sdk-qualification/Cargo.toml --target-dir target/ant-sdk-qualification
cargo test --locked --manifest-path tools/ant-sdk-qualification/Cargo.toml
```

The executable accepts one JSON object on standard input and emits one JSON value
on standard output. Validation or I/O failures emit a diagnostic on standard
error and exit 2, without a success result. The request and each input file are
limited to 64 MiB; inventories and directory scans have 4,096-entry limits and
512 MiB aggregate input limits. Summary output is also capped at 64 MiB before
replacement. The invoking harness supplies a process deadline.

| `op` | Inputs | Result |
| --- | --- | --- |
| `sha256` | `body_b64` | Lowercase SHA-256 string |
| `served` | `version`, `rel`, `status`, `body_b64`, `pins` | Verified asset record |
| `verify-dir` | `version`, optional `dir`/`pins`, otherwise `repo` | File count and byte total |
| `overlay` | `html`, `version` | HTML with exactly one supported SDK root selected |
| `module-closure` | `dir`, optional `entries` | `true` for supported relative import graph |
| `reader-closure` | `dir`, optional `entries` | Visited files; bare/external imports refuse |
| `summarize` | `dir`, `pins` or `repo` | Summary JSON, also atomically replaces `dir/SUMMARY.json` |

Paths supplied as `dir` and `repo` are absolute. An explicit `pins` object is a
caller-supplied expectation; otherwise the tool reads
`repo/vendor/ant-browser-sdk/SDK_PINS.json`. That expectation must be retained
independently from any candidate being tested. Path normalization, canonical
containment, regular-file checks and visit limits bound filesystem traversal.

The import check handles static import/export declarations, side-effect imports,
and literal dynamic imports in the pinned module syntax. It does not prove all
possible JavaScript execution dependencies. Worker entry points remain explicit;
the complete file inventory includes WASM. Missing baseline-only top-level
`manifest.js`/`pointers.js` entries are allowed, but missing imports are refused.

Summary rows retain the reported measurement outcome separately from SDK asset
provenance. `accepted` and `integrityMatches` are not independently reconstructed
content-transfer proofs. A content hash alone does not produce an integrity pass.
All present digest inventories are checked, including both arrays if supplied.
Unknown/mismatched assets, conflicting metadata, and a successful outcome with
missing entry/WASM evidence refuse before the previous summary is replaced.
Historical failed or unknown outcomes with missing provenance remain explicit
`assetProvenance: "missing"` rows. Original receipt files are never rewritten.
