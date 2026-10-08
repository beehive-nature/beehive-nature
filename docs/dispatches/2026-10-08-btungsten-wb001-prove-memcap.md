# 2026-10-08 — WB001 prove memory cap: the runner killer dies inside the script now

zCode seat, branch `zcode/btungsten-prove-memcap-2026-10-08` (base
`7f9bc6e26`). Diagnosis credit: the sibling seat, relayed by the
founder — kill times that MOVE (269s, 289s, 228s — the last INSIDE the
240s budget) are memory exhaustion, not clock; z3 on the
comprehension-heavy obligations grows without bound and takes the
runner host down (exit 143), turning every PR that carries this step
red (most recently #367's formal job: run 37730044412, job
113156865401). Yes — this seat was the bottleneck; this beat removes
the blast radius.

## The fix, tested locally BEFORE push (no CI guess-loop)

The pinned toolchain installed in WSL (sha256-verified against CI's
recorded digest) and the whole runner dress-rehearsed end-to-end
under the cap:

- `ulimit -v 6291456` (6 GiB address space) in a subshell around every
  `timeout … cryptol :prove` call — the death happens INSIDE the
  script, in a classifiable place. The GHC-virtual-reservation trap was
  ruled out first-hand: healthy obligations still prove under the cap
  (offsetsOrdered 1.5s, zeroTailAtPosition 5.3s locally).
- New classification: cryptol's own RTS OOM exit **rc=251 /
  "cryptol: out of memory"** → `NOT-PROVEN (memory — RTS exhausted the
  cap; recorded, never success)` — the same honest open-obligation
  class as a timeout, green by design. rc=137 (SIGKILL at the cap) →
  the same memory class. rc=124 → timeout, unchanged. rc=143/SIGTERM
  stays RED (external, unevidenced) — with the cap it should not
  recur; if it does, red is the right color.

## Local dress rehearsal (WSL, full runner, PROVE_BUDGET_S=90)

```
FORMAL-PROVE-UNIVERSAL validImpliesBounded: PROVEN (Q.E.D.)
FORMAL-PROVE-UNIVERSAL offsetsOrdered:      PROVEN (Q.E.D.)
FORMAL-PROVE-UNIVERSAL zeroTailAtPosition:  PROVEN (Q.E.D.)
FORMAL-PROVE-UNIVERSAL wireIndexDef:        NOT-PROVEN (memory — RTS exhausted the 6291456 KiB cap, rc=251)
FORMAL-PROVE-UNIVERSAL wireZeroTail:        NOT-PROVEN (timeout 90s)
FORMAL-PROVE-UNIVERSAL wireInjective:       NOT-PROVEN (timeout 90s)
runner exit: 0
```

NEW FACT the cap surfaced: the memory-cursed obligation is
`wireIndexDef` (the symbolic `@` into the comprehension-built wire
OOMs at 6 GiB), NOT wireZeroTail (which times out clock-wise). The
comprehension-index step is confirmed as the pathological shape from
both directions — the named lever (per-block index lemmas) now has a
resource argument too, not just a timing one.

## For #367's owner

Merge main after this lands and rerun the failed formal job — the
runner your PR carries will no longer die with the host.

HUMAN INTERACTION: NONE.
