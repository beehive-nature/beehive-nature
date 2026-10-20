# Native BNRoSe comparison receipts

Five executions of the existing native NixOS release binary at x0x
`85633f6a6dfea44e62a0cad778aa429275fc4604`.

- `preflight.log`: OS, executable checksum, shared-host process snapshot.
- `run.sh`: executed measurement and sandbox procedure.
- `run-*.json`: raw paired latency observations and local scaling results.
- `run-*.sandbox.log`: isolation and execution receipts.
- `final-health.log`: production node health after measurement.
- `analyze.mjs`: validates raw observation counts and reported quantiles,
  then recomputes aggregate results. Run `node analyze.mjs` in this directory.
- `summary.json`: derived statistics and limitations.

Public executable checksums are annotated PUBLIC-CONSTANT. No keys are included.
See the [dispatch](../../dispatches/2026-10-20-bnrose-native-comparison-ci-closeout.md)
for methodology, result interpretation and boundaries. This is a local
verification workload, not a direct peer delivery or global capacity test.
