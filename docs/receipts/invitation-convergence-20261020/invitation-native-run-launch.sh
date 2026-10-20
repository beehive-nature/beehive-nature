#!/usr/bin/env bash
set -euo pipefail
run_label=$1
test_selector=$2
test_binary=$(find /var/lib/private/invitation-validation/target/debug/deps -maxdepth 1 -type f -name 'named_group_join_metadata_event-*' -executable -printf '%f\n')
test "$(printf '%s\n' "$test_binary" | wc -l)" -eq 1
test -n "$test_binary"
systemd-run --unit="invitation-$run_label" --collect --service-type=exec \
 -p DynamicUser=yes -p StateDirectory=invitation-validation \
 -p WorkingDirectory=/var/lib/invitation-validation \
 -p PrivateNetwork=yes -p PrivateTmp=yes \
 -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
 -p CapabilityBoundingSet= -p AmbientCapabilities= \
 -p KillMode=control-group -p RuntimeMaxSec=1200 \
 -p MemoryMax=12G -p CPUQuota=300% -p CPUWeight=10 -p Nice=10 \
 -p ExecPaths=/run/invitation-bin -p ExecPaths=/run/invitation-tests \
 -p BindReadOnlyPaths=/var/lib/private/invitation-validation/target/debug:/run/invitation-bin \
 -p BindReadOnlyPaths=/var/lib/private/invitation-validation/target/debug/deps:/run/invitation-tests \
 -p BindReadOnlyPaths=/var/tmp/invitation-validation-20261020:/run/invitation-input \
 --setenv="PATH=$PATH" --setenv="PARENT_NETNS=$(readlink /proc/self/ns/net)" \
 --setenv="RUN_LABEL=$run_label" --setenv="TEST_BINARY=$test_binary" \
 --setenv="TEST_SELECTOR=$test_selector" \
 "$(command -v bash)" /run/invitation-input/invitation-native-runtime.sh
