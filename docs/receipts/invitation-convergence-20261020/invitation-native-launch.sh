#!/usr/bin/env bash
set -euo pipefail
systemd-run --unit=invitation-native-build --collect --service-type=exec \
 -p DynamicUser=yes -p StateDirectory=invitation-validation \
 -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
 -p ExecPaths=/var/lib/invitation-validation -p PrivateTmp=yes \
 -p MemoryMax=16G -p CPUQuota=300% -p CPUWeight=10 -p Nice=10 \
 -p BindReadOnlyPaths=/var/tmp/invitation-validation-20261020:/run/invitation-input \
 --setenv="PATH=$PATH" --setenv="LIBCLANG_PATH=$LIBCLANG_PATH" \
 --setenv="PKG_CONFIG_PATH=${PKG_CONFIG_PATH:-}" \
 --setenv="NIX_LDFLAGS=${NIX_LDFLAGS:-}" --setenv="NIX_CFLAGS_COMPILE=${NIX_CFLAGS_COMPILE:-}" \
 "$(command -v bash)" /run/invitation-input/invitation-native-build.sh
