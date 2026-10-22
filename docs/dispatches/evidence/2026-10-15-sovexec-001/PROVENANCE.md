# PROVENANCE: the saorsa-seal review pack (GPT-authored, founder-handed, 2026-10-15)

Received as `C:/Users/travi/Downloads/saorsa-seal-review-2026-10-15.zip` (5,795 bytes), handed by the founder in the SOVEXEC-001 session on 2026-10-15. The README was handed separately first as `Downloads/README (3).md` and is byte-identical to the one inside the zip (checked with `cmp`).

The zip itself is not committed. Its two members are preserved here unedited. Both are LF-terminated ASCII as received (`file`: "ASCII text"; deleting every CR byte leaves the digest unchanged), so the stored bytes equal the received bytes and one digest per file suffices. A first draft of this record claimed CRLF on the strength of a `grep -c` over a `$'\r'` pattern; that count was an artifact of the shell wrapper's quoting, and the claim is withdrawn here rather than silently replaced.

| file | sha256 |
|---|---|
| saorsa-seal-review-2026-10-15.zip (not committed) | 3d63f7cf95841efb4c9bf077d94952ef4481cae79ef0e946234e25a50605da28 PUBLIC-CONSTANT |
| saorsa-seal-pack/README.md | d417e2ee09199098de71d8cd1c1ec2f6e526f27a645b677387446b40b993b6e1 PUBLIC-CONSTANT |
| saorsa-seal-pack/bnr_seal_rejection.rs | 68e3d661247f77ef3db0c3996c90926d5a4d026d72f777ab21bba2d21dacc10e PUBLIC-CONSTANT |

The pack describes itself as STAGED / NOT RUN. The run performed in this lane, on an unmodified disposable checkout exactly as the README prescribes, is recorded in `redfirst.log` beside this file and summarized in the dispatch.

## The specimen the pack targets

Upstream `saorsa-labs/saorsa-seal` at `764d7529f691768bb3a44007bb471eed5b60fb73` (the `main` head as fetched 2026-10-15; commit date 2026-02-04; package version 0.1.3; no committed `Cargo.lock`; no `tests/` directory). sha256 prefixes of the inspected files, identical between the `raw.githubusercontent.com` fetch and the fresh WSL clone:

| file | sha256[0..16] |
|---|---|
| src/api.rs | 53bb593ceb9ac32d |
| src/types.rs | 41506bae7aebe6b7 |
| src/aead.rs | 9ad4e20f526c8730 |
| src/envelope.rs | 4283abe6d1161049 |
| src/lib.rs | cd49a8ff4637b60f |
| Cargo.toml | 89b3c45c468802c1 |

The upstream tree is NOT vendored: the pack prescribes a disposable checkout, and the dispatch pins what was read.
