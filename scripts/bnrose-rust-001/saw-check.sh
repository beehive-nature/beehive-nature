#!/bin/sh
# saw-check.sh — the BNROSE-SAW-001 correspondence leg: the compiled Rust
# core (crates/bnrose-replacement-law, linked through the standalone
# saw-harness per the estate's pq02-sponge pattern) proven equal to the
# Cryptol twin's terms, with teeth that MUST fail.
#
# The harness build proves the RELEASE semantics (overflow-checks off in
# its profiles — the shipped build has no overflow checks; the u8 wrap
# corner at 255 is a pinned fact of attempt8, not an accident of a debug
# panic).
#
# Classes (the correspondence is a CHECK, not a ladder rung — silence is
# failure, never a recorded state):
#   proof verifies       PROVEN
#   proof fails          REFUTED: red (the compiled code and the law differ)
#   timeout / oom        RED, reason named
#   tooth verifies       RED (a mutated spec was accepted — no teeth)
#   tooth fails          CONTROL: the mutation was caught — green
#
# usage: saw-check.sh <path-to-saw>   (from the repo root, with the
#        mir-json toolchain on PATH and SAW_RUST_LIBRARY_PATH set; the
#        linked MIR is (re)built here when target/saw-bnrose/ lacks it:
#          RUSTUP_TOOLCHAIN=nightly-2026-03-21 CARGO_TARGET_DIR=target/saw-bnrose \
#            cargo saw-build --manifest-path scripts/bnrose-rust-001/saw-harness/Cargo.toml)
set -eu

SAW="${1:?usage: saw-check.sh <path-to-saw>}"
DIR=scripts/bnrose-rust-001/saw
MIR=target/saw-bnrose/bnrose_replacement_law.linked-mir.json

say() { printf '%s\n' "$*"; }
_sdir=$(dirname "$SAW")   # the bundled solvers live beside the saw binary
export PATH="$_sdir:$PATH"

say "== bnrose saw: toolchain =="
"$SAW" --version

if [ ! -s "$MIR" ]; then
  say "== building the linked MIR (cargo saw-build, harness at pinned nightly) =="
  ( cd scripts/bnrose-rust-001/saw-harness \
      && RUSTUP_TOOLCHAIN=nightly-2026-03-21 CARGO_TARGET_DIR=../../../target/saw-bnrose cargo saw-build ) \
    || { say "SAW-BNROSE: FAIL — cargo saw-build"; exit 1; }
  _found=$(find target/saw-bnrose -name "bnrose_saw_harness-*.linked-mir.json" -newer scripts/bnrose-rust-001/saw-harness/Cargo.toml 2>/dev/null | head -1)
  [ -n "$_found" ] || _found=$(ls -t $(find target/saw-bnrose -name "bnrose_saw_harness-*.linked-mir.json" 2>/dev/null) 2>/dev/null | head -1)
  [ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BNROSE: FAIL — no linked MIR produced"; exit 1; }
  cp "$_found" "$MIR"
fi
say "linked MIR: $(wc -c < "$MIR") bytes"

run_saw() { # <script> <log> — one process, its own clock
  ( cd "$DIR" && timeout 600 "$SAW" "$(basename "$1")" ) > "$2" 2>&1 || true
}

check_proven() { # <name> <log>
  if grep -q 'Proof succeeded' "$2"; then
    say "PROVEN    $1 — $(grep -m1 'PROVEN' "$2" || true)"
  elif grep -qi 'counterexample\|Proof failed' "$2"; then
    say "REFUTED   $1 — the compiled code and the law differ:" >&2
    tail -12 "$2" >&2
    exit 1
  else
    say "RED       $1 (no verdict — timeout or crash):" >&2
    tail -12 "$2" >&2
    exit 1
  fi
}

OUT="${RUNNER_TEMP:-/tmp}/bnrose-saw"
rm -rf "$OUT" && mkdir -p "$OUT"

run_saw "$DIR/attempt.saw" "$OUT/attempt.log"
check_proven "attempt" "$OUT/attempt.log"
run_saw "$DIR/admissible.saw" "$OUT/admissible.log"
check_proven "admissible" "$OUT/admissible.log"

for tooth in attempt-teeth admissible-teeth; do
  run_saw "$DIR/$tooth.saw" "$OUT/$tooth.log"
  if grep -q 'Proof succeeded' "$OUT/$tooth.log"; then
    say "CONTROL $tooth: FAIL — the mutated spec VERIFIED; the proof has no teeth" >&2
    tail -8 "$OUT/$tooth.log" >&2
    exit 1
  fi
  say "CONTROL $tooth: refuted as required — the correspondence has teeth"
done

say "saw correspondence: GREEN (compiled replacement core == the twin's terms; 2 proofs + 2 teeth)"
say "boundary: the slice-consuming scans (step_entity_attempt, step_has_row_among) stay grid-bound — dynamic-length inputs are outside SAW's symbolic shape; no reference model was substituted"
