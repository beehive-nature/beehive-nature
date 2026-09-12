#!/usr/bin/env bash
# autonomi-observe.sh — allowlisted, NONSECRET, READ-ONLY fence observations.
# Prints only the fields named here. No writes, no restarts, no service or
# network changes. Addresses are redacted/truncated by default (rewards
# address -> 0xREDACTED, chunk addr -> first 16 hex).
# Run on the box:  bash autonomi-observe.sh   (or: ssh oracle bash -s < this)
set -euo pipefail

NODE_BIN="/mnt/ant-store/data/node-2/ant-node"
REG="$HOME/.local/share/ant/node_registry.json"
REL="$HOME/.local/share/ant/upgrades/releases.json"

echo "== processes (rewards redacted) =="
ps aux | grep -E '[a]nt-node|[a]ntd' | sed -E 's/0x[0-9a-fA-F]{40}/0xREDACTED/g'

echo "== versions =="
"$NODE_BIN" --version
"$HOME/.local/bin/ant" --version

echo "== artifact digests =="
sha256sum "$NODE_BIN" "$HOME/.local/share/ant/bin/ant-node-0.18.1" \
          "$HOME/.local/bin/ant" "$HOME/ant-lane/antd" 2>/dev/null || true

echo "== daemon registry (nonsecret fields only) =="
jq '{nodes: (.nodes | map_values({version, upgrade_channel, binary_path, data_dir, evm_network}))}' "$REG" \
  || sed -E 's/"rewards_address": *"[0-9a-fA-Fx]+"/"rewards_address": "0xREDACTED"/' "$REG"

echo "== upgrade-monitor view =="
jq '{fetched_at_epoch_secs,
     newest: (.releases[0] | {tag_name, prerelease}),
     latest_stable: ([.releases[] | select(.prerelease | not)][0] | {tag_name})}' "$REL"

echo "== today's upgrade + PUT-refusal signals =="
LOG="/mnt/ant-store/logs/node-2/logs/ant-node.$(date +%F).log"
grep -E 'upgrade|Rejecting PUT' "$LOG" 2>/dev/null | tail -8 \
  | sed -E 's/addr=[0-9a-f]{16}[0-9a-f]*/addr=TRUNCATED/g'

echo "== replication participation (today's totals) =="
awk '/ingress_dropped=0 received=/ {for(i=1;i<=NF;i++) if($i ~ /^received=/) {split($i,a,"="); s+=a[2]; n++}} END {printf "first_audit ingress received: %d across %d summaries\n", s, n}' "$LOG" 2>/dev/null || true

echo "== gateway health =="
curl -s -m 3 http://172.18.0.1:8082/health; echo

echo "== disk floors =="
df -h / /mnt/ant-store | tail -2
