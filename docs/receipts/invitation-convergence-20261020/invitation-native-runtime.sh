#!/usr/bin/env bash
set -euo pipefail
cd /var/lib/invitation-validation
printf 'UTC: '; date -u
printf 'uid: '; id
test "$(id -u)" != 0
printf 'host network namespace: %s\n' "$PARENT_NETNS"
printf 'runtime network namespace: '; readlink /proc/self/ns/net
test "$(readlink /proc/self/ns/net)" != "$PARENT_NETNS"
ip -brief link
test "$(ip -o link show | wc -l)" -eq 1
ip -o link show lo
test -z "$(ip route show default)"
test -z "$(ip -6 route show default)"
ip -4 route show table all
ip -6 route show table all
grep -E '^(Cap(Inh|Prm|Eff|Bnd|Amb)|NoNewPrivs):' /proc/self/status
for field in CapInh CapPrm CapEff CapBnd CapAmb; do
  test "$(awk -v field="$field:" '$1 == field { print $2 }' /proc/self/status)" = 0000000000000000
done
test "$(awk '$1 == "NoNewPrivs:" { print $2 }' /proc/self/status)" = 1
export X0XD_TEST_BINARY=/run/invitation-bin/x0xd
export X0X_TEST_LOG_DIR="/var/lib/invitation-validation/$RUN_LABEL-daemon-logs"
mkdir -p "$X0X_TEST_LOG_DIR"
export RUST_BACKTRACE=1
sha256sum "$X0XD_TEST_BINARY" "/run/invitation-tests/$TEST_BINARY"
if [ "$TEST_SELECTOR" = all-ignored ]; then
  selected=$("/run/invitation-tests/$TEST_BINARY" --list --ignored)
  printf '%s\n' "$selected"
  test "$(printf '%s\n' "$selected" | grep -c ': test$')" -eq 7
  exec "/run/invitation-tests/$TEST_BINARY" --ignored --nocapture --test-threads=1
fi
selected=$("/run/invitation-tests/$TEST_BINARY" "$TEST_SELECTOR" --ignored --exact --list)
printf '%s\n' "$selected"
printf '%s\n' "$selected" | grep -Fx "$TEST_SELECTOR: test"
exec "/run/invitation-tests/$TEST_BINARY" "$TEST_SELECTOR" --ignored --exact --nocapture --test-threads=1
