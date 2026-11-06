# rehearsal-kit — disposable copies for tamper-case construction

`golden-copy-manifest.json` and `golden-copy-EXPECTED.json` are
byte-identical copies of the frozen `manifest.json` / `EXPECTED.json`
(SHA-256 `acc9cb10…569c`, verified at staging). Tamper HERE, never in
the golden files: copy one of these to a scratch name, apply the R1–R7
tamper from `EXPECTED-REFUSALS.md`, and feed the scratch copy to the
run. The golden fixture stays byte-frozen as the harness advances.
