# Fresh proof replay after PR reconciliation

See the [reconciliation dispatch](../../dispatches/2026-10-18-pq-pr-reconciliation.md).

`run.json` is the fresh Rust controller's result. It records every formal
obligation, native and solver exit, tool/source/binary/MIR hash and file hash.
`manifest.json` binds that run to main `7163316b` plus the reconciled change,
and records byte equality with the original `ada2cb86` implementation and all
105 source bindings from its earlier proof receipt.

`formal-*.log.gz` contains complete solver transcripts. The seven deliberate
false claims must exit 2 with the required return-equality counterexample.
Native receipts and logs retain the honest pass, five defective-verifier
failures and the required empty-coverage refusal. `proof.linked-mir.json.gz`
is the fresh compiled MIR. The gate-test transcript and larger native
receipts are compressed too. Compression uses `gzip -n -9`; each file was
decompressed and compared byte-for-byte before retention. Hashes are SHA-256
in base64url form without padding.

The remaining logs retain Clippy, installed-hook controls, CI shape,
identity selftests and the staged identity/message check. The manifest
hashes all evidence files except itself and this explanatory README.
The complete contribution's identity is checked again after committing and
by hosted CI; that later result is not claimed by the pre-commit receipt.

These records do not extend the original conditional proof boundary or
claim new performance measurements, dependency audits or arithmetic proofs.
