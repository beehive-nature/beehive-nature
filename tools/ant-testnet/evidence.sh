#!/bin/sh
# evidence.sh — what the running lab exposes, measured from inside the guest. Plain text, one
# labelled section per fact; paste it into the run's receipt. Pair with evidence.ps1 on a
# Windows host (the forwarding and firewall live there, not here).
set -u
M="${ANT_DEVNET_MANIFEST:-http://127.0.0.1:25000}"
BIN="${ANT_DEVNET_BIN:-$HOME/ant-testnet/target/release/ant-devnet}"
export PATH="$HOME/.local/bin:$PATH"   # a non-login sh has no ~/.local/bin
echo "== at"; date -u +%Y-%m-%dT%H:%M:%SZ; hostname
echo "== versions"; "$BIN" --version 2>&1 | head -1; anvil --version 2>&1 | head -2
echo "== network id"; curl -s -m 5 "$M/api/browser-manifest.json" | tr -d '\n' | sed -n 's/.*"network_id": *"\([^"]*\)".*/\1/p'; echo
echo "== processes (pid rss_kb elapsed args)"; ps -eo pid,rss,etime,args | grep -E 'ant-devnet|anvil -p' | grep -v grep | sed 's/^ *//'
echo "== listening sockets owned by the lab (proto local-address process)"; ss -ltnup 2>/dev/null | grep -E 'ant-devnet|anvil' | awk '{print $1, $5, $7}'
echo "== endpoint addresses the manifest advertises (unique)"; curl -s -m 5 "$M/api/browser-manifest.json" | grep -o '/ip4/[0-9.]*/' | sort -u
echo "== guest address"; ip -4 -o addr show eth0 | awk '{print $4}'
echo "== disk under the lab data dir"; du -sh "${ANT_DEVNET_DATA:-$HOME/ant-testnet/data}" 2>/dev/null || echo "(no lab data dir yet)"
echo "== note"; echo "the devnet manifest carries Anvil's well-known dev account key (public test material, no value); the page never reads it, and this manifest port must never be reachable beyond this computer"
