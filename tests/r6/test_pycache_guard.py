#!/usr/bin/env python3
"""NEGATIVE CONTROL for the bytecode-cache guard (LAW 8r).

Reproduces THE DANGEROUS DIRECTION of the hazard, end to end, in a throwaway directory:

    source on disk = BAD        cached bytecode = GOOD        metadata = forged current

An unguarded interpreter validates `.pyc` freshness on (source mtime, source size). If a
file is edited and reverted inside the mtime granularity window at the same byte length --
which is exactly what an edit-and-revert of a one-character constant does -- the stale
bytecode still validates. The interpreter then runs code THAT IS NOT IN THE FILE.

  UNGUARDED run  -> reports GOOD  (the bug: a PASS for code not on disk)
  GUARDED   run  -> reports BAD   (correct: compiled from the source that is there)

This file MUST keep reproducing. If it stops, `run_suite.py` fails loudly. DO NOT DELETE
IT TO MAKE THE RUNNER GREEN -- its entire job is to exhibit what the guard prevents, and
without it "guarded run passed" is indistinguishable from "guard does nothing."

Self-contained: uses a temp package, never touches tests/r6 or the repo.
"""
import os, sys, subprocess, tempfile, pathlib, shutil, py_compile, importlib.util

GOOD = 'VALUE = "GOOD"\n'
BAD  = 'VALUE = "BAD_"\n'          # SAME BYTE LENGTH as GOOD -- that is the point
PROBE = "import probe_mod, sys; sys.stdout.write(probe_mod.VALUE)\n"


def _run(pkgdir, env_extra=None):
    env = dict(os.environ)
    env.pop("PYTHONPYCACHEPREFIX", None)
    env.update(env_extra or {})
    r = subprocess.run([sys.executable, "-c", PROBE], cwd=pkgdir, env=env,
                       capture_output=True, text=True)
    return r.stdout.strip()


def main():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="pycache-control-"))
    cache_prefix = pathlib.Path(tempfile.mkdtemp(prefix="pycache-control-fresh-"))
    # THE CONTROL MUST NOT INHERIT THE GUARD IT IS TESTING. run_suite.py sets
    # PYTHONPYCACHEPREFIX, which this process inherits -- and py_compile /
    # cache_from_source honour sys.pycache_prefix. Left alone, the setup step writes its
    # bytecode into the runner's temp prefix instead of the package's __pycache__, the
    # "unguarded" child finds no stale cache, and the hazard silently fails to reproduce.
    # Observed on first run: the guard suppressed the very control that justifies it.
    sys.pycache_prefix = None
    try:
        src = tmp / "probe_mod.py"

        # 1. GOOD source -> compile -> bytecode now holds GOOD
        src.write_text(GOOD)
        py_compile.compile(str(src), doraise=True)
        pyc = pathlib.Path(importlib.util.cache_from_source(str(src)))
        assert pyc.exists(), "control setup failed: no bytecode produced"
        good_stat = src.stat()

        # 2. Swap in BAD source at the SAME SIZE, and restore the SAME mtime.
        #    This is the edit-and-revert-inside-the-granularity-window case, made
        #    deterministic rather than waited for.
        src.write_text(BAD)
        assert src.stat().st_size == good_stat.st_size, "control invalid: sizes differ"
        os.utime(src, (good_stat.st_atime, good_stat.st_mtime))

        unguarded = _run(tmp)
        guarded = _run(tmp, {"PYTHONPYCACHEPREFIX": str(cache_prefix)})

        print(f"  source on disk        : BAD_")
        print(f"  cached bytecode       : GOOD")
        print(f"  UNGUARDED run reports : {unguarded}   <- stale bytecode wins" if unguarded == "GOOD"
              else f"  UNGUARDED run reports : {unguarded}")
        print(f"  GUARDED   run reports : {guarded}   <- compiled from the source on disk"
              if guarded == "BAD_" else f"  GUARDED   run reports : {guarded}")

        fails = 0
        if unguarded != "GOOD":
            print("  FAIL control: the hazard did NOT reproduce unguarded "
                  f"(got {unguarded!r}). The guard's justification is unproven.")
            fails += 1
        if guarded != "BAD_":
            print(f"  FAIL: the guard did not defeat the stale cache (got {guarded!r}).")
            fails += 1
        print(f"  pycache guard control: {'PASS' if not fails else 'FAIL'}")
        return fails
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.rmtree(cache_prefix, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
