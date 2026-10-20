#!/usr/bin/env bash
set -euo pipefail
out=/var/tmp/bnrose-delivery-20261020
binary=/var/lib/private/bnrose-native-validation/target/release/examples/bnrose_delivery
{
 date -u; cat /etc/os-release; uname -a; uptime
 sha256sum "$binary" /var/lib/private/bnrose-native-validation/direct-source/examples/bnrose_delivery.rs /var/lib/private/bnrose-native-validation/direct-source/Cargo.lock
} > "$out/preflight.log"
expected=$(sha256sum "$binary" | cut -d ' ' -f 1)
for repeat in 1 2 3; do
 for window in 8 64; do
  for churn in steady churn; do
   arms='baseline shadow'
   if [ "$repeat" = 2 ]; then arms='shadow baseline'; fi
   for arm in $arms; do
    test "$(sha256sum "$binary" | cut -d ' ' -f 1)" = "$expected"
    bash /var/tmp/bnrose-delivery-run.sh "$arm" "$window" "$churn" "r$repeat-w$window-$churn-$arm"
   done
  done
 done
done
{
 date -u; systemctl show x0x -p ActiveState -p NRestarts
 curl --fail --silent --max-time 5 http://127.0.0.1:12700/health
 sha256sum "$binary"
} > "$out/final-health.log"