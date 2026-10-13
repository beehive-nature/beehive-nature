#!/bin/bash
# build-contracts.sh — compile this lane's CDT contracts with the extracted
# CDT 4.1.1 (the exact toolchain of the pinned prior-lane artifacts),
# INCLUDING the verbatim zkrcount contract from contracts/zkreceipts/.
# WHERE it runs: WSL.
set -euo pipefail
source "$(dirname "$0")/env.sh"
cd "$LANE/chain"
for c in probe blsprobe; do
  [ -f $c.cpp ] || continue
  cdt-cpp -O3 -o $c.wasm $c.cpp -abigen
  ls -la $c.wasm $c.abi
done
# the REAL deployed artifact source, verbatim (includes ../privacy/field256.hpp)
cd /mnt/c/Users/travi/wt-eosvm001/contracts/zkreceipts
rm -f zkrcount.wasm zkrcount.abi
cdt-cpp -O3 -o zkrcount.wasm zkrcount.cpp -abigen
cp -f zkrcount.wasm zkrcount.abi "$LANE/chain/"
ls -la "$LANE/chain/zkrcount.wasm"
