#!/bin/bash
# follower-boot.sh — boot the Jungle4 follower for the four boot
# receipts. Single source of truth: the RUNTIME config file (the
# committed jungle4-node.config.ini VERBATIM plus a marked, minimal
# port-override block); NO command-line endpoint flags (the first boot
# attempt carried cmdline+config duplicates for the same keys and died
# in listener setup).
set -e
J4=~/jungle4-zkr
REPO_INI=${REPO_INI:-$(cd "$(dirname "$0")" && pwd)/jungle4-node.config.ini}
RT_PORT_HTTP=${RT_PORT_HTTP:-8899}
RT_PORT_P2P=${RT_PORT_P2P:-9878}

rm -rf "$J4/data" "$J4/config-rt"
mkdir -p "$J4/data" "$J4/config-rt"
cp "$REPO_INI" "$J4/config-rt/config.ini"
cp "$J4/config/genesis.json" "$J4/config-rt/genesis.json"
# in-place port edit (appbase forbids duplicate keys in one file; the
# runtime config keeps ONE occurrence of each key — the delta vs the
# committed file is exactly these values)
sed -i "s|^http-server-address = 127.0.0.1:8888|http-server-address = 127.0.0.1:$RT_PORT_HTTP  # RUNTIME PORT (lab chain holds 8888)|" "$J4/config-rt/config.ini"
sed -i "s|^p2p-listen-endpoint = 127.0.0.1:9876|p2p-listen-endpoint = 127.0.0.1:$RT_PORT_P2P  # RUNTIME PORT (lab chain holds 9876; 9877 transiently held by sibling work)|" "$J4/config-rt/config.ini"
# FINDING (boot #1, 2026-10-08T01:22–01:33): allowed-connection = none
# rejects ALL peer handshakes in Spring v1.2.2 — including responses to
# OUR OWN outbound dials (nodeos sent 'go away: authentication failure'
# to six different operators' peers; TCP egress to all nine peer ports
# proven OPEN; clock skew 5s). The committed config read it as "no
# inbound, outbound still works" — that reading is wrong for Spring.
# The inbound boundary is ALREADY fully enforced by the loopback
# p2p-listen bind (sockets never leave the machine). Amended LOUDLY per
# the config's own law ("a zero-handshake boot is a finding to receipt
# and diagnose, not a config to quietly relax") — posture unchanged:
# loopback-bound HTTP + P2P; the committed file's correction is a
# separate receipted commit.
sed -i "s|^allowed-connection = none|allowed-connection = any  # RUNTIME AMENDMENT (see FINDING): loopback bind enforces the inbound boundary; none rejects ALL handshakes in Spring 1.2.2|" "$J4/config-rt/config.ini"
rm -rf "$J4/data"; mkdir -p "$J4/data"

echo "== runtime config identity:"
sha256sum "$J4/config-rt/config.ini" | tee "$J4/boot-config.sha256"
echo "== committed config identity (repo, for the delta record):"
sha256sum "$REPO_INI"
echo "== genesis:"
sha256sum "$J4/config-rt/genesis.json"
echo "== nodeos binary identity:"
sha256sum "$(command -v nodeos)"
nodeos --version
echo "== booting (snapshot $(stat -c%s "$J4/snapshots/latest-snapshot.bin") bytes)"
exec nodeos --config-dir "$J4/config-rt" --data-dir "$J4/data" \
  --snapshot "$J4/snapshots/latest-snapshot.bin" > "$J4/nodeos.log" 2>&1
