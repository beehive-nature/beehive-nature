#!/usr/bin/env bash
set -euo pipefail
# Serial trials: paired arms share the same workload, host and time window.
# Reverse arm order in the middle repeat. Never overwrite an existing receipt.
prefix=${1:?unique matrix prefix}
[[ "$prefix" =~ ^[a-zA-Z0-9-]{1,20}$ ]]
runner=/var/lib/private/bnrose-ant-validation/source/tools/ant-bnrose/run-nixos.sh
failures=0
for repeat in 1 2 3; do
  arms="baseline shadow"
  if [ "$repeat" = 2 ]; then arms="shadow baseline"; fi
  for load in 1 4; do
    for fault in steady churn; do
      for arm in $arms; do
        label="$prefix-r$repeat-$arm-$load-$fault"
        printf '%s START %s\n' "$(date -u +%FT%TZ)" "$label"
        status=0
        bash "$runner" "$arm" "$load" "$fault" "$label" || status=$?
        printf '%s END %s exit=%s\n' "$(date -u +%FT%TZ)" "$label" "$status"
        if [ "$status" != 0 ]; then failures=$((failures+1)); fi
      done
    done
  done
done
printf 'Launcher failures: %s\n' "$failures"
test "$failures" = 0
