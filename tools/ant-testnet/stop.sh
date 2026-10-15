#!/bin/sh
# stop.sh — stop the test network. THIS DESTROYS ITS STATE: Anvil keeps its chain in memory
# and ant-devnet removes node data on shutdown. Anything to be recovered (an unknown broadcast,
# a paid-but-unfinished upload) must be recovered while the network runs; a new start.sh is a
# new network with a new network_id, not a continuation.
set -u
pids="$(pgrep -x ant-devnet || true)"
[ -n "$pids" ] || { echo "no ant-devnet is running"; exit 0; }
kill $pids 2>/dev/null || true
i=0; while [ $i -lt 10 ] && pgrep -x ant-devnet >/dev/null; do sleep 1; i=$((i+1)); done
pgrep -x ant-devnet >/dev/null && pkill -9 -x ant-devnet
pkill -f '^anvil -p 0$' 2>/dev/null || true   # the devnet's own anvil child, if it outlived its parent
sleep 1
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ':25000$'; then echo "port 25000 is still held" >&2; exit 1; fi
echo "test network stopped; its chain and node state are gone (a new sh start.sh is a new network)"
