#!/bin/bash
# usage: integ.sh recheck | tree | audit | test <crate>...
# Runs against the merged candidate in the worktree. main.lock = origin/main's Cargo.lock,
# written beside this script by the caller (Windows git), never edited here.
set -u
source "$HOME/.cargo/env"
W=/mnt/c/Users/travi/beehive-nature/.claude/worktrees/goofy-pike-4d5a22
S=/mnt/c/Users/travi/AppData/Local/Temp/claude/C--Users-travi-beehive-nature--claude-worktrees-goofy-pike-4d5a22/5bc13e26-e310-4488-ae0b-7a4e431b091a/scratchpad
I="$S/integrated"
mkdir -p "$I"
cd "$W" || exit 1
case "$1" in
  recheck)
    cp Cargo.lock "$I/merged.lock"
    cp "$S/main.lock" Cargo.lock
    { echo "\$ cargo update -p rustls --precise 0.23.45   # on origin/main's Cargo.lock"
      cargo update -p rustls --precise 0.23.45; echo "exit $?"
      echo "\$ cmp Cargo.lock merged.lock"
      cmp Cargo.lock "$I/merged.lock" && echo "identical"; echo "exit $?"; } > "$I/recheck.txt" 2>&1
    cp "$I/merged.lock" Cargo.lock
    cat "$I/recheck.txt" ;;
  tree)
    { echo "\$ cargo tree --locked --workspace -i rustls"; cargo tree --locked --workspace -i rustls; echo "exit $?"; } > "$I/tree.txt" 2>&1
    { echo "\$ cargo tree --locked --workspace -e normal -i rustls"; cargo tree --locked --workspace -e normal -i rustls; echo "exit $?"; } > "$I/tree-normal.txt" 2>&1
    tail -1 "$I/tree.txt"; tail -1 "$I/tree-normal.txt" ;;
  audit)
    D="$HOME/.cargo/advisory-db"
    {
      echo "\$ cargo audit --version"; cargo audit --version
      echo "\$ ls ~/.cargo/audit.toml $W/.cargo/audit.toml   # audit configuration files"
      ls "$HOME/.cargo/audit.toml" "$W/.cargo/audit.toml" 2>&1
    } > "$I/audit-meta.txt" 2>&1
    { echo "\$ cargo audit --file main.lock   # origin/main's Cargo.lock; this run fetches the database"
      cargo audit --file "$S/main.lock"; echo "exit $?"; } > "$I/audit-main.txt" 2>&1
    { echo "\$ git -C ~/.cargo/advisory-db log -1 --format='%H %cI %s'   # after the fetching run"
      git -C "$D" log -1 --format='%H %cI %s'; } >> "$I/audit-meta.txt" 2>&1
    { echo "\$ cargo audit --no-fetch --file Cargo.lock   # merged candidate"
      cargo audit --no-fetch --file Cargo.lock; echo "exit $?"; } > "$I/audit-merged.txt" 2>&1
    echo "\$ git -C ~/.cargo/advisory-db log -1 --format='%H'   # after both audits" >> "$I/audit-meta.txt"
    git -C "$D" log -1 --format='%H' >> "$I/audit-meta.txt" 2>&1
    cat "$I/audit-meta.txt"; tail -1 "$I/audit-main.txt"; tail -1 "$I/audit-merged.txt" ;;
  test)
    shift
    export CARGO_TARGET_DIR="$HOME/rustls-0285-target"
    P=""; for c in "$@"; do P="$P -p $c"; done
    { echo "\$ CARGO_TARGET_DIR=$CARGO_TARGET_DIR cargo build --locked -p bsigner"
      cargo build --locked -p bsigner; echo "exit $?"
      echo "\$ CARGO_TARGET_DIR=$CARGO_TARGET_DIR cargo test --locked --no-fail-fast$P"
      cargo test --locked --no-fail-fast $P; echo "exit $?"; } > "$I/test.txt" 2>&1
    tail -1 "$I/test.txt" ;;
  *) echo "unknown step: $1"; exit 2 ;;
esac
