#!/bin/bash
# usage: lane.sh audit <label> | update | test
set -u
source "$HOME/.cargo/env"
W=/mnt/c/Users/travi/beehive-nature/.claude/worktrees/goofy-pike-4d5a22
S=/mnt/c/Users/travi/AppData/Local/Temp/claude/C--Users-travi-beehive-nature--claude-worktrees-goofy-pike-4d5a22/5bc13e26-e310-4488-ae0b-7a4e431b091a/scratchpad
cd "$W" || exit 1
case "$1" in
  audit)
    { echo "\$ cargo audit --version"; cargo audit --version
      echo "\$ cargo audit --file Cargo.lock"; cargo audit --file Cargo.lock; echo "exit $?"; } > "$S/audit-$2.txt" 2>&1
    tail -1 "$S/audit-$2.txt" ;;
  update)
    { echo "\$ cargo update -p rustls --precise 0.23.45"; cargo update -p rustls --precise 0.23.45; echo "exit $?"; } > "$S/update.txt" 2>&1
    cat "$S/update.txt" ;;
  test)
    export CARGO_TARGET_DIR="$HOME/rustls-0285-target"
    { echo "\$ CARGO_TARGET_DIR=$CARGO_TARGET_DIR cargo build --locked -p bsigner"
      cargo build --locked -p bsigner; echo "exit $?"
      echo "\$ CARGO_TARGET_DIR=$CARGO_TARGET_DIR cargo test --locked --no-fail-fast -p composition -p wallet-relay -p royalreview -p zano-watcher -p atmirror -p banchor -p bindexer -p adapter-pixellab -p bzdid -p bheraldry"
      cargo test --locked --no-fail-fast -p composition -p wallet-relay -p royalreview -p zano-watcher -p atmirror -p banchor -p bindexer -p adapter-pixellab -p bzdid -p bheraldry; echo "exit $?"; } > "$S/test.txt" 2>&1
    tail -1 "$S/test.txt" ;;
  *) echo "unknown step: $1"; exit 2 ;;
esac
