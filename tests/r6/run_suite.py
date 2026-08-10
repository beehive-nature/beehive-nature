#!/usr/bin/env python3
"""GUARDED SUITE RUNNER — the entry point. Run this, not the suites directly.

    python tests/r6/run_suite.py      # exit 0 = all pass, guard confirmed engaged

WHY THIS EXISTS (earned 2026-08-09). A stale `tests/r6/__pycache__` shadowed a source
file that was BYTE-IDENTICAL TO HEAD: canon.py matched HEAD by md5 and test_canon still
reported `FAIL R1a pin 2`, because Python imported bytecode compiled from an edited
version. That direction is loud and harmless. **The dangerous direction is the inverse —
a suite PASSING against bytecode that is not the code in the repo.** A conformance suite
that can report a pass for code that is not in the tree is not a conformance suite.

MECHANISM CHOSEN, and why not the obvious ones:

  * `rm -rf __pycache__`     REJECTED. It is the obvious fix and it does not work where
                             it is needed most: on the mount where this was found, the
                             directory could not be unlinked (Operation not permitted).
                             A guard that fails on the filesystem that produced the bug
                             is not a guard.
  * `python -B` / `sys.dont_write_bytecode`
                             REJECTED. Stops WRITING bytecode, not READING it. This was
                             tried against the live failure and did not fix it.
  * PYTHONPYCACHEPREFIX to a FRESH temp dir per run          <-- CHOSEN.
                             Redirects both cache READ and WRITE away from
                             `__pycache__`. A fresh directory holds no bytecode, so
                             every module is compiled from the source on disk. Needs no
                             delete permission, mutates nothing in the repo, and is
                             immune to the mtime-granularity case that caused this:
                             an edit-and-revert that lands in the same mtime second at
                             the same file size leaves Python's (mtime, size) validation
                             believing stale bytecode is current.

THE GUARD HAS ITS OWN CONTROL, because an unverified guard is just an assertion:
  * `_confirm_guard_engaged()` imports canon in the child env and requires `__cached__`
    to resolve UNDER the temp prefix. If it still points into `tests/r6/__pycache__`,
    the runner REFUSES TO REPORT A PASS — a guard that silently disengages would restore
    the exact hazard while looking green.
  * `test_pycache_guard.py` reproduces the dangerous direction end to end: source BAD,
    cached bytecode GOOD, validation metadata forged to look current. Unguarded run
    PASSES (the bug). Guarded run FAILS (correct). It is a required-to-reproduce control
    per 8r — if it stops reproducing, this runner fails.
"""
import os, sys, subprocess, tempfile, pathlib, shutil

HERE = pathlib.Path(__file__).resolve().parent
SUITES = ["test_canon.py", "test_r6.py", "test_sig.py", "expected_values.py"]
CONTROL = "test_pycache_guard.py"


def _guarded_env(prefix):
    env = dict(os.environ)
    env["PYTHONPYCACHEPREFIX"] = str(prefix)
    return env


def _confirm_guard_engaged(env, prefix):
    """Control on the guard itself: canon's bytecode must resolve under the temp prefix."""
    probe = "import canon,sys; sys.stdout.write(canon.__cached__ or '')"
    r = subprocess.run([sys.executable, "-c", probe], cwd=HERE, env=env,
                       capture_output=True, text=True)
    cached = r.stdout.strip()
    engaged = bool(cached) and str(prefix) in cached
    print(f"  guard engaged : {engaged}")
    print(f"    canon.__cached__ -> {cached or '(none)'}")
    if not engaged:
        print("  REFUSING TO REPORT A PASS: PYTHONPYCACHEPREFIX did not take effect, so")
        print("  the suites may have run against bytecode in tests/r6/__pycache__.")
    return engaged


def main():
    prefix = pathlib.Path(tempfile.mkdtemp(prefix="r6-pycache-"))
    env = _guarded_env(prefix)
    print(f"GUARDED RUN — fresh bytecode cache at {prefix}")
    try:
        if not _confirm_guard_engaged(env, prefix):
            return 2

        print("\n-- hazard control (must reproduce, per 8r) --")
        ctl = subprocess.run([sys.executable, CONTROL], cwd=HERE, env=env,
                             capture_output=True, text=True)
        sys.stdout.write(ctl.stdout)
        if ctl.returncode != 0:
            sys.stdout.write(ctl.stderr)
            print("  FAIL: the pycache hazard no longer reproduces. Do NOT delete the")
            print("  control to make this pass — the guard's justification is gone and")
            print("  that needs a human to look at it.")
            return 1

        print("\n-- suites --")
        failed = []
        for s in SUITES:
            r = subprocess.run([sys.executable, s], cwd=HERE, env=env,
                               capture_output=True, text=True)
            print(f"  {s:24s} exit={r.returncode}")
            if r.returncode != 0:
                failed.append(s)
                sys.stdout.write(r.stdout + r.stderr)
        print(f"\nRUNNER: {len(SUITES) - len(failed)}/{len(SUITES)} suites passed"
              f"{'' if not failed else '  FAILED: ' + ', '.join(failed)}")
        return 1 if failed else 0
    finally:
        shutil.rmtree(prefix, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
