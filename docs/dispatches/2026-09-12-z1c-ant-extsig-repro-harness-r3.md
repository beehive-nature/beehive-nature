# z1.c — r3 final cleanup corrections (Astra review 5648424593)

**Seat:** z1.c (Medium, same session) · **Review:**
[#10 comment 5648424593](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5648424593)
at `ad4a4c2d` (the PR #60 comment) — which also CLOSED the original
physical-path finding (Astra independently reran the real Linux symlink
probe: escape rejected, valid direct scratch accepted). This patch is
confined to cleanup ownership/failure handling and its tests, per the
review. The accepted physical-path fix and the strict lock-refusal control
are preserved untouched.

## 1 · Suite ownership discipline (no more fixed-path markers)

The r2 suite's `z1c-selftest-unrelated-marker.dir` — a fixed path, `mkdir
-p`, overwritten payload, unconditional `rm -rf` — was not ownership
acquisition. Now:

- **Every suite-created path is an exclusive `mktemp` allocation.** The
  owned neighbor is `mktemp -d` inside the isolated base with its own
  payload; the legacy fixture is planted once before any runner invocation.
- **An isolated per-test base** (unique `mktemp` dir, passed to the runner
  invocations as `TMPDIR`) holds all scratch-owning cases, so leftover
  counting sees only this run's allocations — concurrent suite runs never
  collide or pollute each other's counts.
- **A pre-existing legacy marker with content** (`ant-extsig-repro.legacy01`
  + `sentinel.txt`, digest recorded before any run) sits in that base for
  the whole suite. It is name-shaped like runner scratch but was never
  allocated by the runner; every failure-path case and the final suite
  step assert it remains **byte-identical** (the runner removes only the
  exact scratch paths it created).
- The suite's own cleanup (retained scratches, neighbor, legacy after its
  final assertion, the isolated base, WORK) is shape- and
  physically-validated per removal, mirroring the runner's law.

## 2 · The finalizer now checks removal status

`_finalizer` no longer assumes `rm -rf` succeeded. Each removal's exit
status is checked; on failure it prints an honest terminal receipt naming
the **RETAINED owned path** ("removal FAILED — owned scratch RETAINED,
remove manually after inspection") and escalates the exit code —
zero-escalation only: an existing nonzero status (die, or a signal's
129/130/143) is preserved, never overwritten or hidden; a successful run's
0 becomes 1 when its cleanup failed. The same escalation rule now also
governs the validation-doubt and canonical-baseline branches. (Minor
adjacent hardening in the same cleanup path: an empty `TMPDIR` falls back
to `/tmp` before `mktemp`.)

**Regressions (T10, no real permission changes):** a no-op stub `rm`
(exit 1, removes nothing) is prepended to `PATH` for two isolated runs —
- **T10a** (injected staging failure, original status 1): exit stays 1,
  RETAINED-path receipt printed, the scratch is genuinely still on disk,
  neighbors + legacy intact;
- **T10b** (otherwise-successful metadata run): exit escalates 0 → 1, same
  RETAINED-path receipt, exactly one retained scratch in the isolated base.

The stub affects only the finalizer (the runner invokes `rm` nowhere else);
no system permission was touched.

## Wording law adopted

Per the review's close: symlink-escape coverage is attributed to "hosts
that can create true symlinks (e.g. Linux)" — never to CI unless a CI job
actually executes the test. The T5b SKIP message and the README now carry
that attribution.

## Focused results (this host: z1.c laptop, Git Bash, cargo 1.98.1)

```
sh scripts/ant-extsig-repro/selftest.sh
T1a/T1b/T2a/T2b/T2c/T3a/T3b/T4  PASS (unchanged from r2 — refusals, strict
                                    lock-refusal + stub control, orphan
                                    workspace, source drift)
T5a PASS — guard verdicts (1 valid + 6 rejects, incl. nested subpath)
T5b SKIP — no true symlink creatable on this host; exercised on hosts
          that can create them (e.g. Linux)
T7  PASS — staging failure: isolated scratch cleaned, neighbors + legacy intact
T8  PASS — stub-cargo failure: same contract
T8b PASS — TERM mid-cargo: exit 143, scratch released or named
T10a PASS — failed removal on a nonzero run: exit 1 preserved, RETAINED path named
T10b PASS — failed removal on a successful run: exit escalated 0 -> 1
T9  PASS — owned neighbor intact, legacy byte-identical, isolated base empty
T6  PASS — canonical ops/ant-extsig still equals the manifest
selftest: 16 passed, 0 failed, 1 skipped
```

Plus one default-mode success run (real `rm`, metadata-only): ALL PHASES
OK, zero scratch left. No compilation repeated, no production contact, no
harness execution; `ops/` and the root workspace untouched; committed
lock/overlay/source-manifest untouched.

## Files touched (this r3)

`scripts/ant-extsig-repro/run.sh` (finalizer removal-status check +
escalate-only-if-zero; TMPDIR guard), `selftest.sh` (ownership discipline,
isolated base, legacy sentinel, T10, attribution wording), `README.md`
(law text + attribution). Dispatch: this file.
