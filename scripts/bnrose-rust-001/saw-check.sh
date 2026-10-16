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
#   tooth refuted        CONTROL: the mutation was caught — green
#   tooth inconclusive   RED (independent review 2026-10-16: a solver
#                        timeout, syntax error, or missing artifact is
#                        NOT a counterexample — an explicit refutation
#                        result is required; unrecognized failures are
#                        rejected)
#
# The linked MIR is verified against the EXACT source and toolchain
# identity before reuse (independent review 2026-10-16): a stamp of the
# harness + law sources and the pinned saw-build toolchain is compared,
# and any mismatch forces a deterministic rebuild — a stale artifact can
# never certify changed Rust.
#
# usage: saw-check.sh <path-to-saw>   (from the repo root, with the
#        mir-json toolchain on PATH and SAW_RUST_LIBRARY_PATH set)
#        saw-check.sh --selftest      (classify fabricated logs; no SAW
#                                      needed — the teeth-classifier
#                                      regression)
set -eu

DIR=scripts/bnrose-rust-001/saw
MIR=target/saw-bnrose/bnrose_replacement_law.linked-mir.json
STAMP=target/saw-bnrose/.mir-stamp
TOOLCHAIN=nightly-2026-03-21

say() { printf '%s\n' "$*"; }

# classify_log <log> — prints PROVEN | REFUTED | INCONCLUSIVE.
# The ONLY green paths are an explicit success or an explicit
# refutation; anything else (timeout, crash, empty, syntax error) is
# INCONCLUSIVE and the caller must treat it as RED.
classify_log() {
  if grep -q 'Proof succeeded' "$1" 2>/dev/null; then
    printf 'PROVEN\n'
  elif grep -qi 'counterexample\|Proof failed' "$1" 2>/dev/null; then
    printf 'REFUTED\n'
  else
    printf 'INCONCLUSIVE\n'
  fi
}

if [ "${1:-}" = "--selftest" ]; then
  T=$(mktemp -d)
  trap 'rm -rf "$T"' EXIT
  printf '...\nProof succeeded\n' > "$T/ok.log"
  printf '...\nProof failed, counterexample found\n' > "$T/refuted.log"
  : > "$T/empty.log"
  printf '...\nsaw: internal error\n' > "$T/crash.log"
  [ "$(classify_log "$T/ok.log")" = PROVEN ]        || { say "selftest: ok.log misclassified"; exit 1; }
  [ "$(classify_log "$T/refuted.log")" = REFUTED ]  || { say "selftest: refuted.log misclassified"; exit 1; }
  [ "$(classify_log "$T/empty.log")" = INCONCLUSIVE ] || { say "selftest: empty.log (timeout shape) misclassified"; exit 1; }
  [ "$(classify_log "$T/crash.log")" = INCONCLUSIVE ] || { say "selftest: crash.log misclassified"; exit 1; }
  say "saw-check selftest: GREEN (classifier requires explicit verdicts; tool failures are never counterexamples)"
  exit 0
fi

SAW="${1:?usage: saw-check.sh <path-to-saw> | --selftest}"
_sdir=$(dirname "$SAW")   # the bundled solvers live beside the saw binary
export PATH="$_sdir:$PATH"

say "== bnrose saw: toolchain =="
"$SAW" --version

# The stamp binds the artifact to the EXACT sources + toolchain: hash of
# every input the linked MIR is compiled from, plus the pinned nightly
# identity. Mismatch or absence ⇒ rebuild (deterministic).
compute_stamp() {
  {
    for f in scripts/bnrose-rust-001/saw-harness/Cargo.toml \
             scripts/bnrose-rust-001/saw-harness/src/lib.rs \
             crates/bnrose-replacement-law/Cargo.toml \
             crates/bnrose-replacement-law/src/lib.rs \
             Cargo.lock; do
      printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"
    done
    rustc "+$TOOLCHAIN" --version 2>/dev/null || printf 'toolchain %s (rustc unreadable)\n' "$TOOLCHAIN"
  } | sha256sum | cut -d' ' -f1
}

STAMP_NOW=$(compute_stamp)
if [ -s "$MIR" ] && [ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$STAMP_NOW" ]; then
  say "linked MIR: $(wc -c < "$MIR") bytes (stamp matches sources+$TOOLCHAIN)"
else
  if [ -s "$MIR" ]; then
    say "stale linked MIR (stamp mismatch) — rebuilding deterministically"
  else
    say "== building the linked MIR (cargo saw-build, harness at pinned nightly) =="
  fi
  ( cd scripts/bnrose-rust-001/saw-harness \
      && RUSTUP_TOOLCHAIN=$TOOLCHAIN CARGO_TARGET_DIR=../../../target/saw-bnrose cargo saw-build ) \
    || { say "SAW-BNROSE: FAIL — cargo saw-build"; exit 1; }
  _found=$(find target/saw-bnrose -name "bnrose_saw_harness-*.linked-mir.json" 2>/dev/null | head -1)
  [ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BNROSE: FAIL — no linked MIR produced"; exit 1; }
  cp "$_found" "$MIR"
  printf '%s\n' "$STAMP_NOW" > "$STAMP"
  say "linked MIR: $(wc -c < "$MIR") bytes (stamp recorded)"
fi

run_saw() { # <script> <log> — one process, its own clock
  ( cd "$DIR" && timeout 600 "$SAW" "$(basename "$1")" ) > "$2" 2>&1 || true
}

OUT="${RUNNER_TEMP:-/tmp}/bnrose-saw"
rm -rf "$OUT" && mkdir -p "$OUT"

for proof in attempt admissible; do
  run_saw "$DIR/$proof.saw" "$OUT/$proof.log"
  _class=$(classify_log "$OUT/$proof.log")
  if [ "$_class" = PROVEN ]; then
    say "PROVEN    $proof — $(grep -m1 'PROVEN' "$OUT/$proof.log" || true)"
  elif [ "$_class" = REFUTED ]; then
    say "REFUTED   $proof — the compiled code and the law differ:" >&2
    tail -12 "$OUT/$proof.log" >&2
    exit 1
  else
    say "RED       $proof (no verdict — timeout or crash):" >&2
    tail -12 "$OUT/$proof.log" >&2
    exit 1
  fi
done

for tooth in attempt-teeth admissible-teeth; do
  run_saw "$DIR/$tooth.saw" "$OUT/$tooth.log"
  _class=$(classify_log "$OUT/$tooth.log")
  if [ "$_class" = PROVEN ]; then
    say "CONTROL $tooth: FAIL — the mutated spec VERIFIED; the proof has no teeth" >&2
    tail -8 "$OUT/$tooth.log" >&2
    exit 1
  elif [ "$_class" = REFUTED ]; then
    say "CONTROL $tooth: refuted as required — the correspondence has teeth"
  else
    # Independent review 2026-10-16: the old script accepted ANY
    # non-success here — a solver timeout, syntax error, or missing
    # artifact passed as a "caught mutation". Only an explicit
    # refutation counts.
    say "CONTROL $tooth: RED — no explicit refutation (timeout or crash is not a counterexample):" >&2
    tail -12 "$OUT/$tooth.log" >&2
    exit 1
  fi
done

say "saw correspondence: GREEN (compiled replacement core == the twin's terms; 2 proofs + 2 teeth, every verdict explicit)"
say "boundary: the slice-consuming scans (step_entity_attempt, step_has_row_among) stay grid-bound — dynamic-length inputs are outside SAW's symbolic shape; no reference model was substituted"
