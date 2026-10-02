# zBlood edition v2 — post-merge capability stop and provenance repair

PR #302 merged before four late automated review comments were returned in the same merge command. All four findings were valid, so its `AWAITING FOUNDER APPROVAL` ledger is not actionable and no approval was requested. The gate prevented payment throughout.

`ant 0.3.9 file upload --help` exposes no storage-price ceiling and no gas ceiling. A separate `file cost` estimate cannot atomically constrain the later paid command. `tools/genealogy/preserve-service.mjs` now code-disables `/api/preserve/upload` regardless of gate status or secret-key availability and reports the missing capability. Re-enabling it requires a reviewed client/API that applies both bounds to the payment itself.

`surfaces/blood.html` no longer prepares or invoices the superseded pkg3 artifact. Its preservation handoff opens an honest status panel naming the privacy-safe edition's quote and the client-capability stop; wallet review is unavailable. Because this surface is a mandatory member of the public archive, the previously quoted tar is superseded and must be rebuilt after this correction.

The deterministic derivation is now executable at `tools/genealogy/build-eternalization-tar.sh::verify_reproducible_eternalization_tar`. It constructs the archive twice with the fixed metadata recipe, byte-compares the outputs, emits the size and SHA-256, writes through temporary files, and refuses any mismatch. A fresh run from the verified prepared package reproduced the prior 106,844,160-byte tar and `2538275c3f5f7a775769d5f2907cbba447a0df01c71f478a94b78d4e4059047f`; that receipt closes the derivation-proof gap while the subsequent surface change deliberately invalidates the artifact. PUBLIC-CONSTANT superseded tar digest.

Verification before the rebuild: shell syntax clean; complete genealogy suite 463/463; `e2e/blood-eternal.test.mjs` 6/6; `git diff --check` clean. No payment, wallet mutation, upload, or network write occurred.
