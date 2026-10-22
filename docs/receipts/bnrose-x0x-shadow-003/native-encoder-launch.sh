#!/usr/bin/env bash
set -euo pipefail
systemd-run --unit=bnrose-native-encoder --collect --service-type=exec \
 -p DynamicUser=yes -p StateDirectory=bnrose-native-validation \
 -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
 -p ExecPaths=/var/lib/bnrose-native-validation -p PrivateTmp=yes -p MemoryMax=16G -p PrivateNetwork=yes -p CPUQuota=200% -p CPUWeight=10 -p Nice=10 \
 -p BindReadOnlyPaths=/var/tmp/bnrose-shadow-20261020:/run/bnrose-input \
 --setenv="PATH=$PATH" --setenv="LIBCLANG_PATH=$LIBCLANG_PATH" \
 --setenv="PKG_CONFIG_PATH=${PKG_CONFIG_PATH:-}" \
 --setenv="NIX_LDFLAGS=${NIX_LDFLAGS:-}" --setenv="NIX_CFLAGS_COMPILE=${NIX_CFLAGS_COMPILE:-}" \
 "$(command -v bash)" /run/bnrose-input/native-encoder.sh
