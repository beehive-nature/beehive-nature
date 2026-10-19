#!/bin/sh
# sampled-agreement-check.sh — the mechanically checked Rust↔Cryptol
# SAMPLED-AGREEMENT GRID (founder order 2026-10-14: "Add the mechanically
# checked Rust/Cryptol sampled-agreement grid. Test the named saturation
# corner and ensure the counterexample controls remain effective. Treat
# sampled agreement as an intermediate gate, not equivalent to full SAW
# implementation correspondence.")
#
# How the comparison is mechanical: the Rust half (the bnrose-grid-agreement
# binary) computes every field through the REAL single definitions the run
# path uses (step_entity_attempt, replacement_attempt, step_has_row_among,
# replacement_admissible) over the canonical grid.list, with discrimination
# noise the scans must filter; grid-gen.py embeds THOSE lines as literals in
# a generated Cryptol module (bit-reversing the masks: Cryptol sequences
# index from the most significant element, the Rust names attempt a as
# 1<<a); Cryptol then :proves per-cell agreement between its own definitions
# and the Rust literals. No output-text comparison, no judgment by eye:
# Q.E.D. = every sampled cell agrees; a counterexample names the index of
# the first disagreeing cell (mapped back to its grid line below);
# timeout/memory death = NOT-AGREED(open) — recorded and RED here, because
# sampled agreement is a CHECK, not a ladder rung: silence is failure.
#
# The comparator's own teeth: the perturbation control flips cell 0's gate
# literal — :prove MUST counterexample at index 0 exactly.
#
# usage: sampled-agreement-check.sh <path-to-cryptol> <path-to-bnrose-grid-agreement>
set -eu

CRYPTOL="${1:?usage: sampled-agreement-check.sh <cryptol> <grid-bin>}"
GRIDBIN="${2:?usage: sampled-agreement-check.sh <cryptol> <grid-bin>}"
DIR=scripts/bnrose-rust-001/cryptol
GRID="$DIR/grid.list"
MEM_CAP_KIB="${MEM_CAP_KIB:-6291456}"
BUDGET_SECS="${BUDGET_SECS:-300}"
OUT="${RUNNER_TEMP:-/tmp}/bnrose-sampled-agreement"
rm -rf "$OUT" && mkdir -p "$OUT"

say() { printf '%s\n' "$*"; }
_cdir=$(dirname "$CRYPTOL")

# ---- 1. the Rust half ------------------------------------------------------
"$GRIDBIN" "$GRID" > "$OUT/rust.json"
CELLS=$(grep -c . "$OUT/rust.json")
GRIDLINES=$(grep -cve '^[[:space:]]*$' -e '^#' "$GRID")
say "== sampled agreement: $CELLS cells from $GRIDLINES grid lines x both policy flags =="

# input echo: the executed inputs must be exactly grid.list x (false,true)
python3 - "$OUT/rust.json" "$GRID" <<'PY'
import json, sys
rust = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
grid = [tuple(l.split()) for l in open(sys.argv[2]) if l.strip() and not l.lstrip().startswith('#')]
want = [(r.lower(), w.lower()) for (r, w) in grid for _ in (False, True)]
got = [(c['recs'].lower(), c['rows'].lower()) for c in rust]
if len(got) != len(want):
    print(f"INPUT-DRIFT: rust ran {len(got)} cells, grid.list implies {len(want)}", file=sys.stderr)
    sys.exit(1)
for i, (g, w) in enumerate(zip(got, want)):
    if g != w:
        print(f"INPUT-DRIFT at cell {i}: rust ran {g}, grid.list says {w}", file=sys.stderr)
        sys.exit(1)
PY
say "input echo: the Rust half executed exactly grid.list x both flags"

# ---- 2. the Cryptol half (grid-gen.py: Rust literals + the proof) ----------
python3 scripts/bnrose-rust-001/grid-gen.py "$OUT/rust.json" "$OUT/GridRun.cry" 0

run_prove() { # <file> <command> <log>
  ( ulimit -v "$MEM_CAP_KIB"; export PATH="$_cdir:$PATH" CRYPTOLPATH="$DIR"; exec /usr/bin/time -f '%M' -o "$3.peak" \
      timeout "$BUDGET_SECS" "$CRYPTOL" -c ":load $1" -c ":set prover=yices" -c "$2" ) > "$3" 2>&1 || true
}

run_prove "$OUT/GridRun.cry" ":prove gridCellAgrees" "$OUT/agree.log"
if grep -q 'Q.E.D.' "$OUT/agree.log"; then
  say "AGREED   all $CELLS sampled cells (per-cell :prove over the [9] index space, Q.E.D., peak $(cat "$OUT/agree.log.peak" 2>/dev/null || echo '?') KiB)"
else
  say "DISAGREED or OPEN — the halves differ, or the check could not run:" >&2
  grep -B1 -A3 -i 'counterexample' "$OUT/agree.log" >&2 || tail -5 "$OUT/agree.log" >&2
  CIX=$(grep -oE 'gridCellAgrees +0x[0-9A-Fa-f]+' "$OUT/agree.log" | grep -oE '0x[0-9A-Fa-f]+' | head -1)
  if [ -n "${CIX:-}" ]; then
    IX=$(printf '%d' "$CIX" 2>/dev/null || echo -1)
    [ "$IX" -lt 0 ] || { say "first disagreeing cell (index $IX): $(sed -n "$((IX + 1))p" "$OUT/rust.json")" >&2; }
  fi
  exit 1
fi
run_prove "$OUT/GridRun.cry" ":prove gridAllCellsAgree" "$OUT/agree-all.log"
grep -q 'Q.E.D.' "$OUT/agree-all.log" && say "AGREED   (composed: and over all $CELLS cells, Q.E.D.)" || { say "DISAGREED (composed)" >&2; tail -5 "$OUT/agree-all.log" >&2; exit 1; }

# ---- 3. the comparator's teeth: the flipped cell must refute AT INDEX 0 ----
python3 scripts/bnrose-rust-001/grid-gen.py "$OUT/rust.json" "$OUT/GridBad.cry" 1
run_prove "$OUT/GridBad.cry" ":prove gridCellAgrees" "$OUT/control.log"
if grep -qi 'counterexample' "$OUT/control.log" && grep -q 'gridCellAgrees 0x000 = False' "$OUT/control.log"; then
  say "CONTROL flipped-gate: counterexample at index 0 — the comparator has teeth"
else
  say "CONTROL flipped-gate: FAIL — the flipped cell 0 must refute at index 0" >&2
  tail -5 "$OUT/control.log" >&2
  exit 1
fi

say "sampled agreement: GREEN over $CELLS mechanically compared cells + 1 perturbation control (an intermediate gate — NOT SAW implementation correspondence)"
