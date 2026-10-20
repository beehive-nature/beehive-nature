#!/usr/bin/env bash
set -euo pipefail
systemd-run --unit=bnrose-native-smoke --wait --pipe --collect \
  -p DynamicUser=yes -p PrivateNetwork=yes \
  -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
  -p MemoryMax=256M -p Nice=10 -p CPUWeight=10 \
  -p BindReadOnlyPaths=/var/lib/private/bnrose-native-validation/target/release/examples:/run/bnrose-native \
  -p ExecPaths=/run/bnrose-native \
  /run/current-system/sw/bin/bash -c 'exec /run/bnrose-native/bnrose_shadow'
