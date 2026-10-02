# zBlood privacy-safe edition v2 — exact artifact and ant 0.3.9 quote

The successor genealogy archive was rebuilt from corrective commit `79f442f43872ae5d831f8aa815ad9c9bc632ba7b` after PR #296 and #302 landed. `node tools/genealogy/preserve.mjs verify C:\Users\travi\family-lineage\pkg4-public` verified all 22,107 declared files with no bad entries. The manifest declares 86,331,532 content bytes and digest `123ff6c5befadcc1dee6b71a4ad3c7109ba70fa3aa26ad810b202198f7d4b0f4`. PUBLIC-CONSTANT manifest digest.

The privacy audit read the packaged `sources/records.json`, not the repository source. It contains schema `skaists.sources-records-public/1`, 13,249 records, 49,342 evidence descriptors, and zero `evidence[].value` fields. `sources/search-evidence.json` is included. The 307 downloaded record images remain private-tier; the public edition carries counts, SHA-256 digests, and ARK pointers through `sources/images-summary.json`.

Two independent GNU tar constructions used the executable derivation in `tools/genealogy/build-eternalization-tar.sh::verify_reproducible_eternalization_tar`: sorted names, fixed `2026-10-02T00:00:00Z` mtime, numeric owner/group zero, POSIX format, and deleted atime/ctime PAX headers. Both produced 106,833,920 bytes and SHA-256 `960045b2f32cf2988041b235c3588d92cfd93b318e2672dae72c41f4f20b6c2f`. PUBLIC-CONSTANT tar digest. The copy at `C:\Users\travi\family-lineage\pkg4.tar` independently matches that size and hash.

The live keyless quote ran `ant --json file cost C:\Users\travi\family-lineage\pkg4.tar` with `ant 0.3.9`. The client logged several peer-connection warnings, then exited 0 with JSON: file size 106,833,920; 29 chunks; storage `2432547952148437500` atto-ANT = `2.432547952148437500 ANT`; estimated gas `150000000000000` wei = `0.000150000000000000 ETH`; payment mode `single`; confidence `priced_sample`. No payment, wallet mutation, or upload occurred.

The proposed separated ceilings are 2.5 ANT for storage and 0.0002 ETH for gas, with an exact 29-chunk condition. `ant file upload --help` in 0.3.9 exposes no option that applies either ceiling atomically to the paid operation. A separate preflight quote cannot prevent demand pricing from changing before upload, so this edition is `PAYMENT CLIENT CAPABILITY REQUIRED`, not approvable for spend.

The `/api/preserve/upload` endpoint is code-disabled regardless of the gate status or presence of a secret key. `surfaces/blood.html` no longer builds the superseded pkg3 plan or invoice; it shows the exact privacy-safe edition and the payment-capability stop. Enabling payment requires reviewed client/API support for both atomic limits rather than a ledger-only status change.

Verification: shell syntax clean; complete genealogy suite 463/463; `e2e/blood-eternal.test.mjs` 6/6; `git diff --check` clean.

Progression at dispatch: privacy-safe package prepared and locally verified; exact tar deterministically reproduced by a committed source function; ant 0.3.9 quote captured; approval blocked on payment-client capability; purchase, upload, retrieval, storage hash verification, and restoration verification not started.
