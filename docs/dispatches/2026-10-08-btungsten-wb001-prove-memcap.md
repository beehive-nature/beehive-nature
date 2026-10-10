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

## CLOSE-OUT (founder order 2026-10-08: finalize and archive; no new work)

- **Merge and CI verified**: PR #370 MERGED at `6872ee690`
  (2026-10-08T06:06:24Z); every workflow on main at that SHA concluded
  success — tests, secret-scan, pages, ant-reach, and the WB002 WASM
  corpus.
- **Classification law, preserved as landed**: OOM and timeout deaths
  are `NOT-PROVEN` classes and can NEVER read as PROVEN. On main the
  runner prints `NOT-PROVEN (memory …)` (two sites: the RTS rc=251 /
  "cryptol: out of memory" branch and the SIGKILL-at-cap branch) and
  `NOT-PROVEN (timeout …)`; PROVEN is printed only for a `Q.E.D.`
  verdict line, and UNKNOWN-VERDICT / external SIGTERM stay red.
- **Standing obligation recorded for future work**: `wireIndexDef` —
  `wire a @ p == byteAt a p` for p < 4626 — the compositional
  comprehension-index step between the PROVEN position-wise zero tail
  (`zeroTailAtPosition`, 1.3s) and the composed/enum forms. It is now
  two-facts hard: it times out (120s class) AND exhausts 6 GiB (rc=251
  class). The named lever: per-block index lemmas (prove the identity
  block-by-block over position ranges), then the field-recovery
  argument toward `wireInjective` (equal wires ⇒ equal length words ⇒
  equal offsets ⇒ equal meaningful bytes ⇒ equal records). Rust-twin +
  SAW EQUIVALENCE remains its own later class.
- **#367**: already MERGED at `31ce0cd52`'s lineage (2026-10-08T08:14:55Z,
  20/20 checks green, AFTER the memcap landed) — the owner already rode
  the capped runner; the rebase-and-rerun notice is moot and no
  notification was needed.
- **Session archive**: this dispatch is the lane's closing record;
  carry-overs live above and in the lane memory. Lane state at archive:
  WB001 executable battery + boundary suite + bridge + 5 universal
  lemmas PROVEN (offsetsOrdered, validImpliesBounded, zeroTailAtPosition
  + the two historical scoped receipts), 1 executed refutation gated,
  wireIndexDef / wireZeroTail / wireInjective honestly open with named
  levers, formal job runner hardened (memory cap, honest classes).

HUMAN INTERACTION: NONE.
