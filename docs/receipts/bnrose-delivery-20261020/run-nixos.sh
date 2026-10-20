#!/usr/bin/env bash
set -euo pipefail
out=/var/tmp/bnrose-delivery-20261020
mkdir -p "$out"
binary=/var/lib/private/bnrose-native-validation/target/release/examples/bnrose_delivery
mode=${1:?baseline or shadow}
window=${2:?8 or 64}
churn=${3:?steady or churn}
label=${4:?unique run label}
test ! -e "$out/$label.json"
if pgrep -x rustc || pgrep -x cargo; then echo 'Build still running' >&2; exit 1; fi
hostns=$(readlink /proc/self/ns/net)
systemd-run --unit="bnrose-delivery-$label" --wait --pipe \
 -p DynamicUser=yes -p PrivateNetwork=yes -p PrivateTmp=yes \
 -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
 -p CapabilityBoundingSet= -p AmbientCapabilities= \
 -p MemoryMax=512M -p RuntimeMaxSec=180 -p Nice=10 -p CPUWeight=10 \
 -p BindReadOnlyPaths="$binary:/run/bnrose_delivery" -p ExecPaths=/run/bnrose_delivery \
 --setenv="PATH=/run/current-system/sw/bin" --setenv="HOST_NETNS=$hostns" --setenv=BNROSE_ISOLATED=1 --setenv=XDG_CACHE_HOME=/tmp \
 /run/current-system/sw/bin/bash -c '
 set -euo pipefail
 test "$(id -u)" != 0
 test "$(readlink /proc/self/ns/net)" != "$HOST_NETNS"
 test "$(ip -o link show | wc -l)" = 1
 test -z "$(ip route show default)"
 test -z "$(ip -6 route show default)"
 grep -Eq "^CapEff:[[:space:]]+0000000000000000$" /proc/self/status
 grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/self/status
 printf "Isolation admitted: non-root, separate loopback-only namespace, zero effective capabilities, no-new-privileges\n" >&2
 exec /run/bnrose_delivery "$@"
 ' bash "$mode" "$window" "$churn" > "$out/$label.json" 2> "$out/$label.sandbox.log"
systemctl show "bnrose-delivery-$label" -p Result -p ExecMainStatus -p CPUUsageNSec -p MemoryPeak -p IPIngressBytes -p IPEgressBytes > "$out/$label.resources.log"