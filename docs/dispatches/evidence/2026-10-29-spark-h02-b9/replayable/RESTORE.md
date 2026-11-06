# RESTORE — deterministic restoration of a replay package

1. Check the package digest against `PACKAGES.SHA256` (concatenate
   the two halves for the named file first).
2. Extract into a FRESH directory (never over an existing workdir):
   `tar -xzf replayable/<name>.tar.gz -C <fresh>/<name>`.
3. Confirm `runs/<session>/frozen-manifest.bin` hashes to the golden
   `manifest.json` digest (`acc9cb10…569c`, see `MANIFEST.SHA256`).
4. Re-verify with the pinned binary (harness `a4e01714`, digest in
   `runs/RUN-LOG.md`):
   `<binary> --verify-only --workdir <fresh>/<name>`
   `--session <session> --order-id demo-task`
   using the extracted original `sessions/<session>.*` files.
5. Capture stdout, stderr and exit code; compare against
   `REPLAY-RESULTS.md`. Any divergence is a finding, not a pass.
