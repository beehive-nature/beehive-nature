#!/usr/bin/env bash
set -euo pipefail
systemd-run --unit=bnrose-delivery-build --collect --service-type=exec \
 -p DynamicUser=yes -p StateDirectory=bnrose-native-validation \
 -p ProtectHome=yes -p ProtectSystem=strict -p NoNewPrivileges=yes \
 -p ExecPaths=/var/lib/bnrose-native-validation -p PrivateNetwork=yes \
 -p BindReadOnlyPaths=/var/tmp/bnrose-delivery-build.sh:/run/bnrose-delivery-build.sh -p BindReadOnlyPaths=/var/tmp/bnrose-delivery-source.tar:/run/bnrose-delivery-source.tar -p MemoryMax=12G -p CPUQuota=200% -p CPUWeight=10 -p Nice=10 \
 --setenv="PATH=$PATH" --setenv="LIBCLANG_PATH=$LIBCLANG_PATH" \
 --setenv="PKG_CONFIG_PATH=${PKG_CONFIG_PATH:-}" \
 --setenv="NIX_LDFLAGS=${NIX_LDFLAGS:-}" --setenv="NIX_CFLAGS_COMPILE=${NIX_CFLAGS_COMPILE:-}" \
 "$(command -v bash)" /run/bnrose-delivery-build.sh