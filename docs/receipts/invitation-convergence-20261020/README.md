# Native invitation convergence evidence

Base: x0x `cfb097504cfe2d2eaf3cdc6176b02585142450aa`.
Candidate: `3956274a07958e8b01da34eacf9fb672148e7048`, PR #5.

The source change is confined to the current invitation protocol assertions
in one test helper shared by the public-open and private-secure scenarios.
No production source or Cargo dependency files differ between these revisions.

- `invitation-native-build.sh` builds the baseline with all features, native
  Rust 1.95.0, the tracked Cargo.lock and development debug symbols disabled.
- `invitation-native-repair.sh` fetches the exact candidate and asserts the
  production source/dependency diff is empty before rebuilding the test.
- The build launchers use a restricted dynamic user and separate state.
- `invitation-native-run-launch.sh` creates a fresh private network and
  restricts privileges before `invitation-native-runtime.sh` admits execution.
  The runtime checks namespace separation, loopback-only links, no default
  routes, non-root identity, empty capability sets and no-new-privileges.
  It pins the baseline selector or asserts seven ignored tests are selected.
  It records both test and daemon hashes and kills owned child processes with
  the transient unit. It never launches a daemon on the host network.
- `original-ci-failure.log` is an excerpt of the October 19 failed timing job.
- `inherited-audit.log` records the separate unchanged seven-advisory failure.
- `native-build.log` retains the setup failures and successful native build.
- `native-baseline.log` reproduces the original missing-roster assertion.
- `native-repair-build.log` records the exact candidate and unchanged daemon.
- `native-repaired.log` records isolation admission and all seven passing
  ignored convergence tests, including both non-creator-admin variants.
- `final-health.log` confirms the temporary units are inactive and the
  existing production node remains healthy with no restarts.

Runtime logs and exact outcomes are recorded in the accompanying dispatch.
Public checksum lines receive a same-line PUBLIC-CONSTANT annotation for
the repository secret scanner. ANSI colour escapes and trailing whitespace
are removed from captured logs; diagnostic text is otherwise retained.
Test-created identities remain private temporary fixture data and are not
published with these receipts.
