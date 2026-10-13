#!/bin/bash
# build.sh — evb (g++; clang-21 trips on eos-vm@e8b4e8b's deduced-return
# host_function templates — receipted in the lane README) + micro.wasm.
# WHERE it runs: WSL Ubuntu 26.04, against the pinned eos-vm checkout
# ($HOME/eosvm001/eos-vm @ e8b4e8b) and the extracted CDT 4.1.1 wasm-ld
# (via the ~/.local/bin/wasm-ld-21 flag-adapting wrapper — see README).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EV=$HOME/eosvm001/eos-vm
export PATH="$HOME/.local/bin:$HOME/eosvm001/springroot/usr/opt/cdt/4.1.1/bin:$PATH"
SF=$EV/external/softfloat/source/include
g++ -O2 -std=c++20 -o "$HERE/evb" "$HERE/evb.cpp" \
  -I"$EV/include" -I"$SF" -I"$SF/../8086-SSE" \
  -DEOS_VM_SOFTFLOAT -DSOFTFLOAT_FAST_INT64 -DSOFTFLOAT_ROUND_EVEN \
  -Wno-register -pthread $EV/build/external/libsoftfloat.a

clang --target=wasm32 -O2 -nostdlib \
  -Wl,--no-entry -Wl,--allow-undefined \
  -Wl,--export=loop -Wl,--export=kecloop -Wl,--export=memtouch \
  -Wl,--export=dbloop -Wl,--export=grow -Wl,--export=trapdiv -Wl,--export=last \
  -Wl,--export=memory -Wl,--initial-memory=131072 \
  -o "$HERE/micro.wasm" "$HERE/micro.c"

echo "built: $HERE/evb + $HERE/micro.wasm"
