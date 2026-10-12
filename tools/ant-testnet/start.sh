#!/bin/sh
# start.sh — bring up the local Autonomi TEST network for wallet.html?net=devnet.
#
# A ten-node ant-devnet (an upload needs a close group of 7) (WithAutonomi/ant-node v0.22.0, --features test-utils) where
# every node has a WebRTC Direct endpoint, plus a local Anvil chain (31337) with the
# test ANT token and payment vault deployed. Nothing on it has value.
#
# Reachability from a browser on the Windows host (WSL2, NAT networking):
#   - storage nodes: WebRTC Direct over UDP to this WSL address (advertised by --host)
#   - manifest service: TCP 0.0.0.0:25000, reached as http://127.0.0.1:25000 through
#     WSL's localhost forwarding (loopback, so an https page may read it)
#   - Anvil: ANVIL_IP_ADDR=0.0.0.0, reached the same way; the page maps the published
#     rpc_url's host to 127.0.0.1
#
# Refuses if the binary or anvil is missing, or if port 25000 is already taken.
set -eu
BIN="${ANT_DEVNET_BIN:-$HOME/ant-testnet/target/release/ant-devnet}"
ANVIL="$(command -v anvil || true)"
[ -x "$BIN" ] || { echo "ant-devnet not built at $BIN" >&2; exit 1; }
[ -n "$ANVIL" ] || { echo "anvil not on PATH (Foundry v1.8.5 expected in ~/.local/bin)" >&2; exit 1; }
if (exec 3<>/dev/tcp/127.0.0.1/25000) 2>/dev/null; then echo "port 25000 is already in use: a devnet may already be running" >&2; exit 1; fi
HOST="$(ip -4 -o addr show eth0 | awk '{print $4}' | cut -d/ -f1)"
[ -n "$HOST" ] || { echo "no eth0 IPv4 address" >&2; exit 1; }
echo "test network: nodes advertise $HOST, manifest http://127.0.0.1:25000/api/browser-manifest.json"
export ANVIL_IP_ADDR=0.0.0.0
exec "$BIN" --preset small --host "$HOST" --webrtc-direct --serve-port 25000 --enable-evm --enable-logging
