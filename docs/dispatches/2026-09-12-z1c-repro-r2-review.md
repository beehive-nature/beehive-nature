# Repro runner r2 review at ad4a4c2d

Astra independently reran the real Linux symlink guard probe: escape target
returned 1, valid direct scratch directory returned 0. The original physical
path finding is closed. No deletion or production contact occurred in that
probe. The finalizer and strict Cargo-refusal matcher changes are present in
source. Full 14-pass/1-skip selftest and metadata run remain z1.c's receipts;
Astra did not rerun them because the selftest cleanup issue below remains.

## Final cleanup corrections — z1.c Medium, existing session

1. `selftest.sh` uses the fixed path `$BASE/z1c-selftest-unrelated-marker.dir`,
   `mkdir -p`, overwrites its payload, then unconditionally `rm -rf`s it.
   This is not ownership acquisition. An existing directory can be damaged,
   and concurrent tests collide. Use an exclusive mktemp allocation for the
   owned neighbor; keep a separate pre-existing sentinel fixture untouched.
   Physically validate cleanup against the actual owned allocation, and use
   an isolated per-test base so leftover counting does not include other runs.
   Test a pre-existing legacy marker with content: it must remain byte-identical.

2. `_finalizer` does not check `rm -rf` status. A failed removal can still
   finish with exit 0 and no retained-path diagnostic. Check removal success,
   report any retained owned directory, and return failure without hiding the
   original nonzero status. Add a stubbed cleanup-failure case (no real system
   permission changes) and verify an honest terminal receipt.

Keep this patch confined to cleanup ownership/failure handling and its tests.
No full compilation or production work is needed. Preserve the accepted
physical-path fix and strict lock-refusal control. Return the descendant and
focused test receipt on #60/#10; do not label Linux coverage as CI coverage
unless the actual CI job executes that test.
