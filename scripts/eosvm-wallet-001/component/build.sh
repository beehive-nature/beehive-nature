#!/bin/bash
# build.sh — compile zkr_component.cpp to freestanding wasm32 for EOS VM.
# WHERE it runs: WSL (Ubuntu 26.04), system clang targeting wasm32, CDT 4.1.1's
# wasm-ld (extracted deb tree — no system install needed).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WSL_LD="$HOME/eosvm001/springroot/usr/opt/cdt/4.1.1/bin/wasm-ld"
[ -x "$WSL_LD" ] || { echo "missing $WSL_LD (extract Spring/CDT debs first)"; exit 1; }

export PATH="$HOME/.local/bin:$HOME/eosvm001/springroot/usr/opt/cdt/4.1.1/bin:$PATH"

# -mno-bulk-memory + -fno-builtin-*: clang-21 otherwise recognizes our own
# memcpy/memset byte-loops as intrinsics and lowers them to memory.copy/fill
# (7 sites receipted), which eos-vm @ e8b4e8b (the Spring v1.2.2 pin, CDT
# era) rejects as "Illegal instruction".
clang++ --target=wasm32 -O2 -std=c++17 -nostdlib -fno-exceptions -fno-rtti \
  -mno-bulk-memory -fno-builtin-memcpy -fno-builtin-memset -fno-builtin-memcmp -fno-builtin-strlen \
  -I"$HERE" \
  -Wl,--no-entry -Wl,--allow-undefined \
  -Wl,--export=zkr_verify -Wl,--export=zkr_layout -Wl,--export=zkr_last -Wl,--export=zkr_phase1 -Wl,--export=zkr_phase2 -Wl,--export=zkr_scalars -Wl,--export=memory \
  -Wl,--initial-memory=1048576 -Wl,--max-memory=4194304 \
  -Wl,-z,stack-size=32768 \
  -o "$HERE/zkr_component.wasm" "$HERE/zkr_component.cpp"

echo "built: $HERE/zkr_component.wasm"
ls -la "$HERE/zkr_component.wasm"
sha256sum "$HERE/zkr_component.wasm"
