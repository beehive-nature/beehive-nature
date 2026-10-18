# Prepared-key proof receipts

These are the final local run's outputs. See the
[dispatch](../../dispatches/2026-10-14-btungsten-pq-prepare-proof.md) and
[proof boundary](../../../crates/btungsten-x0x-pq/proof/README.md).

- `run.json`: overall PASS, exact conditional obligations, tool versions,
  source/MIR/binary hashes, native and SAW exit codes.
- `source-pins.json`: the actual checked source inputs.
- `formal-*.saw`, `common.saw`, `Boundary.cry`, `names.saw`: exact proof inputs.
- `formal-*.log[.gz]`: complete solver transcripts, including seven deliberate
  return-value counterexamples. A control's nonzero exit is required evidence.
- `native-*.json[.gz]`: exact coverage and failures. Honest passes; five broken
  verifiers and empty coverage must fail their named gates.
- `proof.linked-mir.json.gz`: the actual fresh compiled MIR submitted to SAW.
- `operational-*`: actual source-drift and stale-receipt failure controls.
  `operational-run.json` intentionally says FAIL because its SAW path is absent.
- `controller.log`, `gate-tests.log.gz`, `mir-build.log`, `clippy.log`, `hooks.log`:
  execution and ancillary check logs.

`manifest.json` hashes all 45 retained evidence artifacts. It excludes itself
and this explanatory README. Digests use SHA-256 encoded as base64url without
padding. The linked MIR, native receipts larger than 16 KiB, and raw proof/test
transcripts were compressed with `gzip -n -9`; each was decompressed and
compared byte-for-byte before retention. The manifest records
both compressed and original byte counts/hashes. `run.json` hashes refer to the
original bytes; `gzip -dc FILE.gz` recovers them without modifying the receipt.

Countermodels contain public-key/message/signature values. Native fixtures use
public deterministic test seeds, with no production identity or secret input.
The native executable, proof tool binaries, Cargo build trees, and translated
standard-library tree are not retained here; their recorded hashes identify
the local execution artifacts. Rebuild using the documented pinned toolchain.
