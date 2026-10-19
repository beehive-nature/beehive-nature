#!/bin/sh
# health.sh — is the test network up, and is it the network this kit expects? Every line is a
# measured fact; exit 0 only when all pass. Run from inside the guest (WSL) or any Linux host.
set -u
M="${ANT_DEVNET_MANIFEST:-http://127.0.0.1:25000}"
fail=0
ok(){ printf 'ok   %s\n' "$*"; }
bad(){ printf 'FAIL %s\n' "$*"; fail=1; }
b="$(curl -s -m 5 "$M/api/browser-manifest.json" || true)"
d="$(curl -s -m 5 "$M/api/devnet-manifest.json" || true)"
if [ -n "$b" ] && [ -n "$d" ]; then ok "manifest answers at $M"; else bad "manifest does not answer at $M (sh start.sh)"; exit 1; fi
id="$(printf '%s' "$b" | tr -d '\n' | sed -n 's/.*"network_id": *"\([^"]*\)".*/\1/p')"
[ -n "$id" ] && ok "network id $id" || bad "no network_id in the browser manifest"
chain="$(printf '%s' "$b" | tr -d '\n' | sed -n 's/.*"chain_id": *\([0-9]*\).*/\1/p' | head -1)"
[ "$chain" = "31337" ] && ok "manifest chain 31337" || bad "manifest chain is '$chain', not 31337"
rpc="$(printf '%s' "$d" | tr -d '\n' | sed -n 's/.*"rpc_url": *"http:\/\/[^:]*:\([0-9]*\)\/".*/\1/p')"
[ -n "$rpc" ] && ok "test chain rpc port $rpc" || bad "no http rpc_url in the devnet manifest"
cid="$(curl -s -m 5 -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "http://127.0.0.1:${rpc:-0}/" | sed -n 's/.*"result": *"\([^"]*\)".*/\1/p')"
[ "$cid" = "0x7a69" ] && ok "test chain answers eth_chainId 0x7a69 (31337)" || bad "test chain eth_chainId is '$cid', not 0x7a69"
n="$(printf '%s' "$b" | grep -o '"multiaddr"' | wc -l | tr -d ' ')"
[ "$n" -ge 7 ] && ok "$n browser endpoints (an upload needs a close group of 7)" || bad "only $n browser endpoints; need at least 7"
pub="$(printf '%s' "$b" | grep -o '/ip4/[0-9.]*/' | sort -u | grep -vc '^/ip4/\(10\.\|127\.\|172\.\(1[6-9]\|2[0-9]\|3[01]\)\.\|192\.168\.\)' || true)"
[ "$pub" = "0" ] && ok "every endpoint is at a private address" || bad "$pub endpoint address(es) are not private"
pid="$(pgrep -x ant-devnet | head -1)"
if [ -n "$pid" ]; then ok "ant-devnet pid $pid, rss $(awk '/VmRSS/{print $2" "$3}' "/proc/$pid/status" 2>/dev/null)"; else bad "no ant-devnet process"; fi
apid="$(pgrep -f '^anvil -p 0$' | head -1)"
if [ -n "$apid" ]; then ok "anvil pid $apid, rss $(awk '/VmRSS/{print $2" "$3}' "/proc/$apid/status" 2>/dev/null)"; else bad "no anvil child process"; fi
exit $fail
