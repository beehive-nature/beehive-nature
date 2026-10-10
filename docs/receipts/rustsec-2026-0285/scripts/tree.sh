#!/bin/bash
# usage: tree.sh <label>   -- records cargo tree -i rustls for the workspace
set -u
source "$HOME/.cargo/env"
W=/mnt/c/Users/travi/beehive-nature/.claude/worktrees/goofy-pike-4d5a22
S=/mnt/c/Users/travi/AppData/Local/Temp/claude/C--Users-travi-beehive-nature--claude-worktrees-goofy-pike-4d5a22/5bc13e26-e310-4488-ae0b-7a4e431b091a/scratchpad
cd "$W" || exit 1
cargo tree --locked --workspace -i rustls > "$S/tree-$1.txt" 2>&1
echo "cargo tree --locked --workspace -i rustls exited $?"
cargo tree --locked --workspace -e normal -i rustls > "$S/tree-normal-$1.txt" 2>&1
echo "cargo tree --locked --workspace -e normal -i rustls exited $?"
