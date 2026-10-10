#!/bin/bash
# usage: provenance.sh <out-dir>   -- captures, AFTER the runs, the facts the
# stage 1 and 2 receipts state without a file of their own. Every section
# prints the time it was captured; nothing here was captured at run time.
set -u
source "$HOME/.cargo/env"
O="$1"
{
  echo "\$ date -u"; date -u
  echo "\$ cargo --version; rustc --version; cargo audit --version"
  cargo --version; rustc --version; cargo audit --version
  echo "\$ ls -l --time-style=full-iso ~/.cargo/bin/cargo-audit"
  ls -l --time-style=full-iso "$HOME/.cargo/bin/cargo-audit"
} > "$O/env.txt" 2>&1
{
  echo "\$ date -u"; date -u
  echo "\$ git -C ~/.cargo/advisory-db reflog --date=iso"
  git -C "$HOME/.cargo/advisory-db" reflog --date=iso
  echo "\$ git -C ~/.cargo/advisory-db log -1 --format='%H %cI %s'"
  git -C "$HOME/.cargo/advisory-db" log -1 --format='%H %cI %s'
} > "$O/advisory-db-reflog.txt" 2>&1
{
  echo "\$ date -u"; date -u
  for c in rustls rustls-webpki; do
    echo "\$ curl -s https://crates.io/api/v1/crates/$c/versions?per_page=100 | python3 (print num, created_at, yanked for 0.23.x / 0.103.x, newest first) | head -8"
    curl -s -A "beehive-nature receipts" "https://crates.io/api/v1/crates/$c/versions?per_page=100" \
      | python3 -c 'import sys,json,re
for v in json.load(sys.stdin)["versions"]:
    if re.match(r"0\.(23|103)\.", v["num"]): print(v["num"], v["created_at"], v["yanked"], sep="\t")' | head -8
  done
  echo "\$ sed -n '/^\[dependencies.webpki\]/,/^\$/p' ~/.cargo/registry/src/*/rustls-0.23.45/Cargo.toml"
  sed -n '/^\[dependencies.webpki\]/,/^$/p' "$HOME"/.cargo/registry/src/*/rustls-0.23.45/Cargo.toml
} > "$O/crates-io.txt" 2>&1
tail -3 "$O/env.txt"; tail -3 "$O/advisory-db-reflog.txt"; cat "$O/crates-io.txt"
