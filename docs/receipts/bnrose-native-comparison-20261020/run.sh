#!/usr/bin/env bash
set -euo pipefail
receipt=/var/tmp/bnrose-native-comparison-20261020
test ! -e "$receipt"
mkdir -m 700 "$receipt"
binary=/var/lib/private/bnrose-native-validation/target/release/examples/bnrose_shadow
test "$(sha256sum "$binary" | cut -d ' ' -f 1)" = 092ba2c4c2e4441de8530bf4d37f66e776dc5bfd1fee46af6279483c18222778 # PUBLIC-CONSTANT
if pgrep -x rustc || pgrep -x cargo; then
  echo "Refusing measurement while a Rust build is active" >&2
  exit 1
fi
{
  date -u
  cat /etc/os-release
  uname -a
  sha256sum "$binary"
  uptime
  ps -eo comm,pcpu,rss --sort=-pcpu | head -n 10
} > "$receipt/preflight.log"
for run in 1 2 3 4 5; do
  systemd-run --unit="bnrose-native-comparison-$run" --wait --pipe --collect \
    -p DynamicUser=yes -p PrivateNetwork=yes \
    -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
    -p CapabilityBoundingSet= -p AmbientCapabilities= \
    -p MemoryMax=256M -p RuntimeMaxSec=120 -p Nice=10 -p CPUWeight=10 \
    -p BindReadOnlyPaths=/var/lib/private/bnrose-native-validation/target/release/examples:/run/bnrose-native \
    -p ExecPaths=/run/bnrose-native \
    /run/current-system/sw/bin/bash -c 'exec /run/bnrose-native/bnrose_shadow' \
    > "$receipt/run-$run.json" 2> "$receipt/run-$run.sandbox.log"
done
{
  date -u
  systemctl show x0x -p ActiveState -p NRestarts
  curl --fail --silent --max-time 5 http://127.0.0.1:12700/health
} > "$receipt/final-health.log"
