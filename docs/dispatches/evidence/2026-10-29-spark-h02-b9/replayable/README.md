# replayable/ — byte-exact originals vs the annotated record

Two package sets exist in this lane; do not confuse them:

- `runs/` — the HISTORICAL ANNOTATED RECORD. Archived copies carry
  additive `_scan: PUBLIC-CONSTANT ...` sibling keys, split-halves
  digest files and marker-suffixed log lines so the repo secret-scan
  passes. Semantics preserved (270 JSON docs re-validated), but these
  files are NOT byte-identical to what the verifier consumed.
- `replayable/*.tar.gz` — REPLAYABLE PACKAGES. Deterministic,
  lossless tarballs of the ORIGINAL capture bytes (machine-consumed
  transcripts, digest files, signed/hash-bound material untouched).
  Restore with the command in `RESTORE.md` and re-verify with the
  pinned binary; frozen bytes hash to the golden digest.

Determinism: sorted names, uid/gid 0, fixed mtime, gzip mtime=0 —
rebuilt twice byte-identical before publishing (see digests below).
