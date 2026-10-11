#!/bin/sh
# Receipt run 2 for docs/audits/swanky-popsicle-rb01: rebuild and rerun every
# reproduction from the exact source bytes that will be committed, and keep the
# raw output of each command. Executed by Seat 3 (Claude Code) on the founder's
# build box, inside WSL. Saved logs replace $HOME with ~ (and nothing else).
set -u
SRC=/mnt/c/Users/travi/beehive-nature/.claude/worktrees/competent-bun-591d05/docs/audits/swanky-popsicle-rb01/repro
BUILD="$HOME/rb01-upstream/build"
OUT="$HOME/rb01-upstream/receipts-run2"
export CARGO_TARGET_DIR="$HOME/rb01-upstream/target"
. "$HOME/.cargo/env"

[ -d "$OUT" ] && { echo "refusing: $OUT exists"; exit 1; }
mkdir -p "$OUT/logs"
SUMMARY="$OUT/summary.tsv"
printf 'step\tcommand\texit\tseconds\tlog\n' > "$SUMMARY"

clean() { sed "s#$HOME#~#g"; }

# run STEP TIMEOUT_S COMMAND... : run one command, keep stdout+stderr, record exit and wall time
run() {
  step="$1"; shift; limit="$1"; shift
  log="logs/$step.log"
  start=$(date +%s.%N)
  ( cd "$BUILD" && timeout "$limit" "$@" ) > "$OUT/$log.raw" 2>&1
  code=$?
  end=$(date +%s.%N)
  clean < "$OUT/$log.raw" > "$OUT/$log"; rm "$OUT/$log.raw"
  secs=$(awk "BEGIN{printf \"%.3f\", $end - $start}")
  printf '%s\t%s\t%s\t%s\t%s\n' "$step" "$(echo "$*" | clean)" "$code" "$secs" "$log" >> "$SUMMARY"
}

{
  echo "date_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host: $(uname -srm)"
  echo "rustc: $(cd "$BUILD" && rustc --version)"
  echo "cargo: $(cd "$BUILD" && cargo --version)"
  echo "swanky build worktree HEAD: $(git -C "$BUILD" rev-parse HEAD)"
  git -C "$HOME/rb01-upstream/swanky" fetch -q origin
  echo "swanky origin/dev at run time: $(git -C "$HOME/rb01-upstream/swanky" rev-parse origin/dev) ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
  echo "swanky origin branches: $(git -C "$HOME/rb01-upstream/swanky" branch -r | tr -s ' \n' ' ')"
  echo "rust-toolchain file: $(cat "$BUILD/rust-toolchain")"
  echo "cargo config rustflags:"; sed -n '/rustflags/,/]/p' "$BUILD/.cargo/config.toml"
} > "$OUT/environment.txt" 2>&1

# The exact source bytes, copied into the pinned tree as examples.
for f in "$SRC"/*.rs; do
  b=$(basename "$f")
  tr -d '\r' < "$f" > "$BUILD/edge/popsicle/examples/$b"
done
( cd "$SRC" && sha256sum *.rs ) > "$OUT/source-sha256.txt"
( cd "$BUILD/edge/popsicle/examples" && for f in "$SRC"/*.rs; do b=$(basename "$f"); sha256sum "$b"; done ) > "$OUT/source-sha256-lf-as-built.txt"
git -C "$BUILD" status --porcelain > "$OUT/build-tree-status.txt"

EX="--example repro_set_sizes --example repro_repeated_points --example repro_evaluator_inputs --example repro_input_encoding --example probe_spin"
run 00-build-release 1800 cargo build --locked --release -p popsicle $EX
run 01-build-debug 1800 cargo build --locked -p popsicle --example repro_repeated_points

R="$CARGO_TARGET_DIR/release/examples"
D="$CARGO_TARGET_DIR/debug/examples"
run 10-set-sizes 1800 "$R/repro_set_sizes"
run 20-repeated-psi-release 120 "$R/repro_repeated_points" psi
run 21-repeated-kmprt-release 120 "$R/repro_repeated_points" kmprt
run 22-repeated-kmprt-debug 300 "$D/repro_repeated_points" kmprt
run 23-repeated-psi-debug 300 "$D/repro_repeated_points" psi
for c in dup2 dup3 dup4 empty-a; do
  run "30-evaluator-$c" 120 "$R/repro_evaluator_inputs" "$c"
done
run 31-evaluator-empty-b 120 env RUST_BACKTRACE=1 "$R/repro_evaluator_inputs" empty-b
run 32-evaluator-empty-both 120 env RUST_BACKTRACE=1 "$R/repro_evaluator_inputs" empty-both
run 40-input-encoding 120 "$R/repro_input_encoding"
run 50-probe-garbler-repeat 60 "$R/probe_spin" garbler-repeat
run 51-probe-evaluator-repeat4 60 "$R/probe_spin" evaluator-repeat4

( cd "$OUT" && sha256sum environment.txt summary.tsv source-sha256.txt source-sha256-lf-as-built.txt build-tree-status.txt logs/*.log ) > "$OUT/SHA256SUMS"
echo "done: $OUT"
cat "$SUMMARY"
