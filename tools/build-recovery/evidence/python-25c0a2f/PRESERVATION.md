# Preserved historical Python recovery implementation

Retained on the founder's explicit instruction for reproducible inspection and
potential future evidentiary use. These files are historical material, not the
current recovery entry points. Do not erase, edit, autoformat or execute them
as part of current Rust qualification. No legal-admissibility claim is made.

Original repository commit: `25c0a2f33bdde7ffe67fec4ad782026209fdc092`.
Original paths: `tools/build-recovery/bsigner.py`, `test_integrity.py`, `README.md`.
The three files here were extracted with native `git archive` from that commit,
without text conversion. Their SHA-256 values are in [INTEGRITY.json](INTEGRITY.json).

Git blob checks independently matched:

- `bsigner.py`: `90d00489c5dfeed17c3e8f6cf66312d9359a9dba` (283 lines).
- `test_integrity.py`: `d9df1cd142e8ace1b9548431a1ab5896063a79fe` (54 lines).

`original-evidence.tar.gz` retains the original complete snapshot manifest,
provenance/dependency inventory, original runner, vendor configuration, two
independent manifest references, raw seven-command logs/receipts, launch,
isolation, artifact and overall result JSON, outer log and resource report.
`original-bsigner.bin` is the binary actually retained from that original run.
The manifest entries retain full source/toolchain/vendor/fixture identities.
The full source archive, toolchain, vendor tree and original snapshot still
exist at the locations recorded in the original dispatch; they were not deleted
or silently replaced with the Rust-controller snapshot.

Archive SHA-256: `90551ef763bc653dabd27de191c7bbefa088a7970207dfff6303ebdb4b9d29df` — PUBLIC-CONSTANT

To inspect without executing, extract the archive into a fresh directory and
check its manifest digest against the historical dispatch. To reproduce the
historical implementation, use its retained README, pinned inputs and original
commands in a separate environment. Reproduction is a new run and must retain
its own source/toolchain/host, output, timing and exit evidence. Never overwrite
the original snapshot or relabel the Rust replacement's results as a Python run.

Checksums establish equality to the named records, not independent authorship,
perfect custody, timeless availability or intent. Copies on GitHub supplement
the existing local originals. Use replaceable, independently retained copies;
GitHub is not an indispensable verification authority.
