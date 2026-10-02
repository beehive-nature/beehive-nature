# zBlood privacy-safe edition v2 — exact artifact and ant 0.3.9 quote

The successor genealogy archive was rebuilt from merged `main` commit `974d7559b56adef07b941ae2e045d6376a747d66` after PR #296 landed. `node tools/genealogy/preserve.mjs verify C:\Users\travi\family-lineage\pkg4-public` verified all 22,107 declared files with no bad entries. The manifest declares 86,337,400 content bytes and digest `f0ab56074fa07025ac19828b447dc18019661b9f67f62ac50522c071fdc6d337`. PUBLIC-CONSTANT manifest digest.

The privacy audit read the packaged `sources/records.json`, not the repository source. It contains schema `skaists.sources-records-public/1`, 13,249 records, 49,342 evidence descriptors, and zero `evidence[].value` fields. `sources/search-evidence.json` is included. The 307 downloaded record images remain private-tier; the public edition carries counts, SHA-256 digests, and ARK pointers through `sources/images-summary.json`.

Two independent GNU tar constructions used the same banked recipe: sorted names, fixed `2026-10-02T00:00:00Z` mtime, numeric owner/group zero, POSIX format, and deleted atime/ctime PAX headers. Both produced 106,844,160 bytes and SHA-256 `2538275c3f5f7a775769d5f2907cbba447a0df01c71f478a94b78d4e4059047f`. PUBLIC-CONSTANT tar digest. The copy at `C:\Users\travi\family-lineage\pkg4.tar` independently matches that size and hash.

The live keyless quote ran `ant --json file cost C:\Users\travi\family-lineage\pkg4.tar` with `ant 0.3.9`. The client logged several peer-connection warnings, then exited 0 with JSON: file size 106,844,160; 29 chunks; storage `2432547952148437500` atto-ANT = `2.432547952148437500 ANT`; estimated gas `150000000000000` wei = `0.000150000000000000 ETH`; payment mode `single`; confidence `priced_sample`. No payment, wallet mutation, or upload occurred.

The proposed separated ceilings are 2.5 ANT for storage and 0.0002 ETH for gas, with an exact 29-chunk condition. `ETERNALIZATION-EDITION-V2.json` is `AWAITING FOUNDER APPROVAL`; the service cannot spend in that state. It also refuses an artifact hash mismatch, a quote above either ceiling, a chunk-count change, an artifact or approval mutation during the request, or a client-version change.

The paid path now fails closed unless `ant --version` exactly matches the approved `ant 0.3.9` client field; that field is also part of the immediate pre-upload gate revalidation. Focused preservation tests pass 24/24 and the complete genealogy suite passes 462/462. `git diff --check` is clean.

Progression at dispatch: privacy-safe package prepared and locally verified; exact tar deterministically reproduced; ant 0.3.9 quote captured; founder approval not yet given; purchase, upload, retrieval, storage hash verification, and restoration verification not started.
