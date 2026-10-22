#!/usr/bin/env bash
set -euo pipefail
root=/var/tmp/bnrose-shadow-20261020
arm=${1:?before or after}
run=${2:?unique run number}
case "$arm" in before|after|tests|controls) ;; *) exit 2;; esac
args=()
if test "$arm" = tests; then args=(bnrose_shadow::tests:: --test-threads=1); fi
case "$run" in *[!0-9]*|'') exit 2;; esac
out="$root/$arm-$run.json"
test ! -e "$out"
test "$(. /etc/os-release; echo "$ID")" = nixos
loader=/nix/store/pqyiidz5mi73wv5f91d48s9plcqyj5bz-glibc-2.44-57/lib/ld-linux-x86-64.so.2
libs=/nix/store/7a2cjhcgzyym5zaz6m4fksw47qvm150w-gcc-16.2.0-lib/lib:/nix/store/pqyiidz5mi73wv5f91d48s9plcqyj5bz-glibc-2.44-57/lib
date --utc --iso-8601=seconds > "$root/$arm-$run.start.txt"
sha256sum "$root/$arm" > "$root/$arm-$run.binary-sha256.txt"
systemd-run --wait --pipe --collect --unit="bnrose-shadow-$arm-$run" \
  -p DynamicUser=yes -p PrivateNetwork=yes -p ProtectHome=yes \
  -p ProtectSystem=strict -p NoNewPrivileges=yes -p MemoryMax=256M \
  -p Nice=10 -p CPUWeight=10 \
  -p "BindReadOnlyPaths=$root:/run/bnrose-shadow-input" \
  "$loader" --library-path "$libs" "/run/bnrose-shadow-input/$arm" "${args[@]}" > "$out" 2> "$root/$arm-$run.sandbox.log"
date --utc --iso-8601=seconds > "$root/$arm-$run.end.txt"
