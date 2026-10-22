#!/usr/bin/env bash
set -euo pipefail
arm=${1:?baseline or shadow}; load=${2:?1 or 4}; fault=${3:?steady or churn}; label=${4:?unique label}
[[ "$label" =~ ^[a-zA-Z0-9-]{1,60}$ ]]
root=/var/lib/bnrose-ant-validation
source /var/tmp/ant-observation-runtime-paths.txt
mkdir -p /var/tmp/bnrose-ant-receipts-20261020
test ! -e "/var/tmp/bnrose-ant-receipts-20261020/$label.json"
systemd-run --unit="bnrose-ant-$label" --wait --pipe --collect \
 -p DynamicUser=yes -p StateDirectory=bnrose-ant-validation \
 -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
 -p CapabilityBoundingSet= -p AmbientCapabilities= -p PrivateTmp=yes \
 -p MemoryMax=2G -p RuntimeMaxSec=240 -p Nice=10 -p CPUWeight=10 \
 -p WorkingDirectory="$root/source" -p ExecPaths="$root" \
 --setenv="PATH=/run/current-system/sw/bin:$(dirname "$node"):$(dirname "$chromium")" \
 --setenv="CHROMIUM=$chromium" \
 "$node" "$root/source/tools/ant-bnrose/run-browser.mjs" \
 "$arm" "$load" "$fault" "$root/$label.json" \
 > "/var/tmp/bnrose-ant-receipts-20261020/$label.stdout.log" \
 2> "/var/tmp/bnrose-ant-receipts-20261020/$label.sandbox.log" || status=$?
if [ -f "/var/lib/private/bnrose-ant-validation/$label.json" ]; then
 cp "/var/lib/private/bnrose-ant-validation/$label.json" "/var/tmp/bnrose-ant-receipts-20261020/$label.json"
fi
exit "${status:-0}"
