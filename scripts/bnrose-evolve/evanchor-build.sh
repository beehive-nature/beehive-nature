#!/bin/bash
# Build the evanchor carrier contract with CDT and write the build receipt:
# the command, the toolchain, the compiler's own output, and the wasm/abi
# digests (sha256, base64: the estate keeps 32-byte digests out of hex).
# Builds only. Deploying is a signed act in the estate's signer lanes.
#
# Usage: bash scripts/bnrose-evolve/evanchor-build.sh   (cdt-cpp on PATH)
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
O=$(mktemp -d)
trap 'rm -rf "$O"' EXIT
R=$ROOT/docs/receipts/bnrose-evolve/evanchor-build-local.txt
cd "$ROOT"
{
  echo '$ cdt-cpp -abigen -o $O/evanchor.wasm contracts/evanchor/evanchor.cpp'
  echo "# $(cdt-cpp --version 2>&1 | head -1); $(uname -srm); $(date -u +%FT%TZ)"
  cdt-cpp -abigen -o "$O/evanchor.wasm" contracts/evanchor/evanchor.cpp 2>&1
  echo "exit=$?"
  echo '$ cd $O; for f in evanchor.wasm evanchor.abi; do echo "$f sha256:$(openssl dgst -sha256 -binary $f | base64)"; done; wc -c evanchor.wasm evanchor.abi'
  cd "$O"
  for f in evanchor.wasm evanchor.abi; do echo "$f sha256:$(openssl dgst -sha256 -binary $f | base64)"; done
  wc -c evanchor.wasm evanchor.abi
  echo '$ cat evanchor.abi'
  cat evanchor.abi
} > "$R"
cat "$R"
