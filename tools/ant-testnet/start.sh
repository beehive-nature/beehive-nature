#!/bin/sh
# start.sh — bring up the local Autonomi TEST network for wallet.html?net=devnet. A NEW RUN.
#
# A ten-node ant-devnet (an upload needs a close group of 7) from WithAutonomi/ant-node v0.22.0
# (commit 008d2ad, built by build.sh), where every node has a WebRTC Direct endpoint, plus a
# local Anvil chain (31337, Foundry v1.8.5) with the test ANT token and payment vault deployed.
# Nothing on it has value.
#
# Every start is a new network: a fresh chain id-less Anvil in memory, fresh nodes, a new
# network_id in the manifest. Nothing survives stop.sh. Recovery tests (the resume paths in
# loop.mjs, e2e/ant-replacement-recovery.mjs) run against a RUNNING network: never restart it
# between a payment and its recovery.
#
# Reachability from a browser on the Windows host (WSL2, NAT networking):
#   - storage nodes: WebRTC Direct over UDP to this WSL address (advertised by --host; the
#     devnet binds 0.0.0.0 for that). The Windows host reaches the WSL address directly; the
#     Hyper-V firewall's default inbound Block keeps the LAN out (evidence.ps1 records it).
#   - manifest service: TCP 0.0.0.0:25000 in the guest, reached as http://127.0.0.1:25000
#     through WSL's localhost forwarding (wslrelay binds 127.0.0.1 only on the host)
#   - Anvil: bound to 127.0.0.1 in the guest (ANVIL_IP_ADDR below), reached the same way; the
#     page maps the published rpc_url's host to 127.0.0.1. Its unlocked dev accounts and
#     balance-setting methods are therefore never on a LAN-facing socket.
#
# Refuses if the pinned binaries are missing or not the pinned versions, or if port 25000 is taken.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${ANT_DEVNET_BIN:-$HOME/ant-testnet/target/release/ant-devnet}"
DATA="${ANT_DEVNET_DATA:-$HOME/ant-testnet/data}"   # lab state, apart from any real client data under ~/.local/share/ant
export PATH="$HOME/.local/bin:$PATH"   # a non-login sh has no ~/.local/bin; ant-devnet spawns anvil by name
ANVIL="$(command -v anvil || true)"
[ -x "$BIN" ] || { echo "ant-devnet not built at $BIN (sh $HERE/build.sh)" >&2; exit 1; }
"$BIN" --version 2>/dev/null | grep -q '0\.22\.0' || { echo "ant-devnet at $BIN is not v0.22.0: $("$BIN" --version 2>&1 | head -1)" >&2; exit 1; }
[ -n "$ANVIL" ] || { echo "anvil not on PATH (Foundry v1.8.5 expected as ~/.local/bin/anvil; sh $HERE/build.sh)" >&2; exit 1; }
"$ANVIL" --version 2>/dev/null | grep -q '1\.8\.5' || { echo "anvil is not Foundry v1.8.5: $("$ANVIL" --version 2>&1 | head -1)" >&2; exit 1; }
# a portable port check: the earlier /dev/tcp probe is a bash-only path that silently reports "free" under sh
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ':25000$'; then echo "port 25000 is already in use: a devnet may already be running (sh $HERE/stop.sh)" >&2; exit 1; fi
HOST="$(ip -4 -o addr show eth0 | awk '{print $4}' | cut -d/ -f1)"
[ -n "$HOST" ] || { echo "no eth0 IPv4 address" >&2; exit 1; }
mkdir -p "$DATA"
echo "test network: nodes advertise $HOST, manifest http://127.0.0.1:25000/api/browser-manifest.json, data $DATA"
export ANVIL_IP_ADDR=127.0.0.1
exec "$BIN" --preset small --host "$HOST" --webrtc-direct --serve-port 25000 --enable-evm --enable-logging --data-dir "$DATA"
