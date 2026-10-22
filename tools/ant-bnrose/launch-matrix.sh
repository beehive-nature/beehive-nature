#!/usr/bin/env bash
set -euo pipefail
prefix=${1:?unique matrix prefix}
[[ "$prefix" =~ ^[a-zA-Z0-9-]{1,20}$ ]]
# Journal-owned output survives an SSH disconnect. Do not add --pipe or --pty.
systemd-run --unit="bnrose-ant-matrix-$prefix" --collect \
  -p RuntimeMaxSec=2400 --setenv=PATH=/run/current-system/sw/bin \
  /run/current-system/sw/bin/bash \
  /var/lib/private/bnrose-ant-validation/source/tools/ant-bnrose/run-matrix.sh "$prefix"
