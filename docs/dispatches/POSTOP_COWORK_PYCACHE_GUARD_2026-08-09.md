# POST-OP NOTE — COWORK · BYTECODE-CACHE HAZARD HARDENED STRUCTURALLY
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: guard in place, its own control passes, 4/4 suites under it. The two obvious
mechanisms were tried and REJECTED on evidence. The control caught the guard suppressing
the control.**

---

## PRE-OP STATE
Documented-only: a docstring warning that a stale `tests/r6/__pycache__` can shadow a
source file byte-identical to HEAD. Seat 1 ruled that insufficient — **structurally
prevented, not just documented**, mechanism my call, stated here.

## PROCEDURE PERFORMED
Established *why* Python's freshness check failed rather than assuming; rejected two
mechanisms on evidence; built a guarded runner plus a control that reproduces the
dangerous direction deterministically; ran the control against the runner and fixed what
it caught.

## SEATS PRESENT
**Cowork** — diagnosis, mechanism, runner, control, this note. (LAW 8c.)

## FINDINGS

**F1 — THE ROOT CAUSE, established not assumed.** Python validates cached bytecode on
**(source mtime, source size)**. An edit-and-revert of a one-character constant changes
**neither**: the size is identical by construction, and if both writes land inside the
mtime granularity window the recorded mtime matches too. **The stale `.pyc` then validates
as current and the interpreter runs code that is not in the file.** That is why the
original symptom looked impossible — `canon.py` matched HEAD by md5 while the suite
reported `FAIL R1a pin 2`.

**F2 — ⛔ TWO OBVIOUS MECHANISMS REJECTED ON EVIDENCE, not taste.**

| candidate | verdict | why |
|---|---|---|
| `rm -rf __pycache__` | **REJECTED** | Fails on the filesystem that produced the bug — the directory could not be unlinked there (*Operation not permitted*). **A guard that fails on the mount where the hazard lives is not a guard.** |
| `python -B` / `sys.dont_write_bytecode` | **REJECTED** | Stops **writing** bytecode, not **reading** it. Tried against the live failure; did not fix it. |

**F3 — ⭐ MECHANISM CHOSEN: `PYTHONPYCACHEPREFIX` to a FRESH temp dir per run.** It
redirects cache **read and write** away from `__pycache__`. A fresh directory holds no
bytecode, so **every module is compiled from the source on disk.** It needs no delete
permission, mutates nothing in the repo, and is immune to the mtime-granularity case
because it never consults the stale cache at all.

```text
GUARDED RUN — fresh bytecode cache at /tmp/r6-pycache-jqv830tg
  guard engaged : True
    canon.__cached__ -> /tmp/r6-pycache-jqv830tg/.../tests/r6/canon.cpython-310.pyc
```

**F4 — ⭐ THE GUARD HAS ITS OWN CONTROL, and it reproduces the DANGEROUS direction.**
`test_pycache_guard.py` builds, in a throwaway package: **source on disk = BAD, cached
bytecode = GOOD, validation metadata forged current** (same byte length, mtime restored).

```text
  source on disk        : BAD_
  cached bytecode       : GOOD
  UNGUARDED run reports : GOOD   <- stale bytecode wins        (the bug)
  GUARDED   run reports : BAD_   <- compiled from the source    (correct)
```

**This is the direction that matters** — a suite reporting a PASS for code that is not in
the tree. The original incident was the loud, harmless inverse. **Reproduced
deterministically rather than waited for**, by forging the metadata instead of racing the
clock.

**F5 — ⭐ THE CONTROL CAUGHT THE GUARD SUPPRESSING THE CONTROL.** First run under the
runner: `FAIL control: the hazard did NOT reproduce unguarded`. Cause — the control
inherits `PYTHONPYCACHEPREFIX` from the runner, and `py_compile` honours
`sys.pycache_prefix`, so **the setup step wrote its bytecode into the runner's temp prefix
instead of the package's `__pycache__`**. No stale cache existed, so the hazard could not
fire. **The guard silently disarmed the evidence for the guard.** Fixed by clearing
`sys.pycache_prefix` inside the control. Had the control merely asserted "guarded run is
correct," it would have passed throughout and proved nothing.

**F6 — Second-order guard: the runner refuses to report a pass if the guard did not
engage.** It probes `canon.__cached__` in the child and requires it under the temp
prefix. A guard that silently stops taking effect would otherwise restore the hazard while
looking green.

## SPECIMENS
- `tests/r6/run_suite.py` — the entry point. `python tests/r6/run_suite.py`, exit 0 = pass
  **and** guard confirmed engaged. Rejected mechanisms recorded in the docstring with
  their reasons (8s/8t), so nobody re-derives `rm -rf __pycache__`.
- `tests/r6/test_pycache_guard.py` — the 8r control. Self-contained; never touches
  `tests/r6` or the repo.
- Guarded run: **4/4 suites** — `test_canon` 32/32, `test_r6` 93/93, `test_sig` 10/10,
  `expected_values` PASS.

## COMPLICATIONS

**C1 — This hardens the SUITE RUNNER, not the language.** Anyone running
`python tests/r6/test_canon.py` directly still consults `__pycache__` and can still be
fooled. The runner is the entry point; the direct path remains available and unguarded.
**Making the suites refuse to run unguarded was considered and NOT done** — it would break
`python test_canon.py` for every reader, and a guard that makes the artifact harder to use
buys safety with adoption. The docstring warning stays for that path.

**C2 — The control proves the mechanism on THIS interpreter and platform.** CPython's
(mtime, size) validation is an implementation detail, not a language guarantee. Hash-based
`.pyc` invalidation (PEP 552) behaves differently and is not exercised here. **Named, not
claimed.**

**C3 — `tests/r6/__pycache__` still exists on this mount and still cannot be deleted from
the sandbox.** The guard routes around it rather than removing it. That is the point, but
it means the stale bytecode is still sitting there for anyone who runs a suite directly.

**C4 — I caused the original incident**, by mutating `canon.py` for an unrelated control
and reverting it. That is not a reason to discount it: **an edit-and-revert is the most
ordinary thing anyone does in a test directory**, which is exactly why it is worth a guard.

**C5 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **Run `python tests/r6/run_suite.py`.** Exit 0 = 4/4 suites pass **and** the guard was
   confirmed engaged. That is the entry point now.
2. **Mechanism: `PYTHONPYCACHEPREFIX` to a fresh temp dir per run.** `rm -rf __pycache__`
   and `-B` were **tried and rejected on evidence** (F2) — the reasons are in the runner's
   docstring so they are not re-derived.
3. **DO NOT DELETE `test_pycache_guard.py` to make the runner green.** If the hazard stops
   reproducing, the guard's justification is gone and a human should look — the runner
   says so in its own failure message.
4. **Unguarded direct runs are still foolable** (C1), deliberately, to keep the suites
   usable standalone.
5. **Untested, named not claimed:** hash-based `.pyc` invalidation (PEP 552); non-CPython
   interpreters (C2).
