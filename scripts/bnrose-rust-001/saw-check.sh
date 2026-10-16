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

# classify_log <log> <rc> — prints PROVEN | REFUTED | INCONCLUSIVE.
# The ONLY green paths are an explicit success or an explicit
# refutation; anything else (timeout, crash, empty, syntax error) is
# INCONCLUSIVE and the caller must treat it as RED.
#
# Mixed-result logs are INCONCLUSIVE (independent review round 2,
# 2026-10-16): a verdict line followed by a tool error means the
# process died outside the prover's control — the verdict is not
# trustworthy, whichever direction it points. Error indicators anywhere
# in the log veto PROVEN and REFUTED alike; and PROVEN additionally
# requires the process exit status to be 0 (a "success" verdict from a
# crashed process is not a success).
classify_log() {
  _log="$1"; _rc="${2:-0}"
  if grep -qi 'internal error\|^Error:\|error:\s\|Panic\|panicked\|stack overflow\|out of memory' "$_log" 2>/dev/null; then
    printf 'INCONCLUSIVE\n'
  elif grep -q 'Proof succeeded' "$_log" 2>/dev/null; then
    if [ "$_rc" = 0 ]; then printf 'PROVEN\n'; else printf 'INCONCLUSIVE\n'; fi
  elif grep -qi 'counterexample\|Proof failed' "$_log" 2>/dev/null; then
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
  printf '...\nProof succeeded\nsaw: internal error\n' > "$T/ok-then-error.log"
  printf '...\nProof failed\nsaw: internal error\n' > "$T/refuted-then-error.log"
  printf '...\nProof succeeded\n' > "$T/ok-bad-rc.log"
  [ "$(classify_log "$T/ok.log" 0)" = PROVEN ]        || { say "selftest: ok.log misclassified"; exit 1; }
  [ "$(classify_log "$T/refuted.log" 1)" = REFUTED ]  || { say "selftest: refuted.log misclassified"; exit 1; }
  [ "$(classify_log "$T/empty.log" 124)" = INCONCLUSIVE ] || { say "selftest: empty.log (timeout shape) misclassified"; exit 1; }
  [ "$(classify_log "$T/crash.log" 1)" = INCONCLUSIVE ] || { say "selftest: crash.log misclassified"; exit 1; }
  [ "$(classify_log "$T/ok-then-error.log" 0)" = INCONCLUSIVE ] || { say "selftest: mixed ok-then-error misclassified"; exit 1; }
  [ "$(classify_log "$T/refuted-then-error.log" 1)" = INCONCLUSIVE ] || { say "selftest: mixed refuted-then-error misclassified (a negative control must not pass on a crashed process)"; exit 1; }
  [ "$(classify_log "$T/ok-bad-rc.log" 1)" = INCONCLUSIVE ] || { say "selftest: success-verdict-with-nonzero-rc misclassified"; exit 1; }
  say "saw-check selftest: GREEN (explicit verdicts only; mixed results and crashed processes are never green, in either direction)"
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
  # Artifact selection is UNIQUELY identified (independent review round
  # 2): every stale linked-MIR candidate is removed BEFORE the rebuild,
  # so the post-build find can match exactly one file — the one this
  # build just produced — or the run refuses to continue.
  rm -f target/saw-bnrose/bnrose_saw_harness-*.linked-mir.json "$MIR"
  ( cd scripts/bnrose-rust-001/saw-harness \
      && RUSTUP_TOOLCHAIN=$TOOLCHAIN CARGO_TARGET_DIR=../../../target/saw-bnrose cargo saw-build ) \
    || { say "SAW-BNROSE: FAIL — cargo saw-build"; exit 1; }
  _n=$(find target/saw-bnrose -name "bnrose_saw_harness-*.linked-mir.json" 2>/dev/null | wc -l | tr -d ' ')
  [ "$_n" = 1 ] || { say "SAW-BNROSE: FAIL — expected exactly 1 fresh linked MIR, found $_n; refusing an ambiguous selection" >&2; exit 1; }
  _found=$(find target/saw-bnrose -name "bnrose_saw_harness-*.linked-mir.json" 2>/dev/null)
  [ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BNROSE: FAIL — no linked MIR produced"; exit 1; }
  cp "$_found" "$MIR"
  printf '%s\n' "$STAMP_NOW" > "$STAMP"
  say "linked MIR: $(wc -c < "$MIR") bytes (stamp recorded; sole fresh artifact)"
fi

run_saw() { # <script> <log> <rcfile> — one process, its own clock; the
  # exit status is RETAINED (review round 2): the classifier needs it to
  # reject success verdicts from crashed processes.
  ( cd "$DIR" && timeout 600 "$SAW" "$(basename "$1")" ) > "$2" 2>&1
  printf '%s\n' "$?" > "$3"
}

OUT="${RUNNER_TEMP:-/tmp}/bnrose-saw"
rm -rf "$OUT" && mkdir -p "$OUT"

for proof in attempt admissible; do
  run_saw "$DIR/$proof.saw" "$OUT/$proof.log" "$OUT/$proof.rc"
  _class=$(classify_log "$OUT/$proof.log" "$(cat "$OUT/$proof.rc")")
  if [ "$_class" = PROVEN ]; then
    say "PROVEN    $proof — $(grep -m1 'PROVEN' "$OUT/$proof.log" || true)"
  elif [ "$_class" = REFUTED ]; then
    say "REFUTED   $proof — the compiled code and the law differ:" >&2
    tail -12 "$OUT/$proof.log" >&2
    exit 1
  else
    say "RED       $proof (no clean verdict — timeout, crash, or mixed result; rc=$(cat "$OUT/$proof.rc")):" >&2
    tail -12 "$OUT/$proof.log" >&2
    exit 1
  fi
done

for tooth in attempt-teeth admissible-teeth; do
  run_saw "$DIR/$tooth.saw" "$OUT/$tooth.log" "$OUT/$tooth.rc"
  _class=$(classify_log "$OUT/$tooth.log" "$(cat "$OUT/$tooth.rc")")
  if [ "$_class" = PROVEN ]; then
    say "CONTROL $tooth: FAIL — the mutated spec VERIFIED; the proof has no teeth" >&2
    tail -8 "$OUT/$tooth.log" >&2
    exit 1
  elif [ "$_class" = REFUTED ]; then
    say "CONTROL $tooth: refuted as required — the correspondence has teeth"
  else
    # Independent review round 1: a solver timeout, syntax error, or
    # missing artifact is not a caught mutation. Round 2: a refutation
    # followed by a tool error is not one either — only a CLEAN,
    # terminal, explicit refutation counts.
    say "CONTROL $tooth: RED — no clean explicit refutation (timeout, crash, or mixed result; rc=$(cat "$OUT/$tooth.rc")):" >&2
    tail -12 "$OUT/$tooth.log" >&2
    exit 1
  fi
done

say "saw correspondence: GREEN (compiled replacement core == the twin's terms; 2 proofs + 2 teeth, every verdict explicit, clean, and terminal)"
say "boundary: the slice-consuming scans (step_entity_attempt, step_has_row_among) stay grid-bound — dynamic-length inputs are outside SAW's symbolic shape; no reference model was substituted"
