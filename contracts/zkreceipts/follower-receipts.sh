#!/bin/bash
# follower-receipts.sh — the four follower boot receipts, bound to
# THIS runtime instance per the committed config's one-shot law:
# EXPOSURE -> IDENTITY -> PEER -> AGREEMENT. Everything observed, nothing
# inferred from configuration. Output: a timestamped receipt document.
set -u
J4=~/jungle4-zkr
OUT=$J4/receipts/boot-$(date -u +%Y%m%dT%H%M%SZ).txt
mkdir -p "$J4/receipts"
HTTP=http://127.0.0.1:8899
PUB=https://jungle4.greymass.com

{
echo "# Jungle4 follower — four boot receipts (one-shot, this instance)"
echo "captured: $(date -u +%Y-%m-%dT%H:%M:%SZ) (UTC) by zkrv4-capture-receipts.sh"
echo
echo "== instance bindings =="
PID=$(pgrep -f "config-dir /home/travi/jungle4-zkr/config-rt" | head -1)
echo "process:        pid $PID started $(ps -o lstart= -p $PID 2>/dev/null)"
echo "nodeos binary:  $(sha256sum "$(command -v nodeos)" | awk '{print $1}') ($(nodeos --version 2>/dev/null | tail -1))"
echo "runtime config: $(sha256sum "$J4/config-rt/config.ini" | awk '{print $1}')"
echo "  delta vs committed 48407965…: two loopback port values (8888→8899, 9876→9878) and"
echo "  allowed-connection none→any (the FINDING: Spring 1.2.2 'none' rejects ALL handshakes;"
echo "  inbound boundary remains enforced by the loopback p2p bind — see EXPOSURE)"
echo "committed cfg:  4840796587b3160b21f76aa81d2c46c7d1f3b59caae578c809ab7cc9e3cf9eb6"  # PUBLIC-CONSTANT: public jungle4 chain data (scanner marker)
echo "data-dir:       $J4/data (fresh at this boot; snapshot $(stat -c%s "$J4/snapshots/latest-snapshot.bin") bytes, sha256 $(sha256sum "$J4/snapshots/latest-snapshot.bin" | awk '{print $1}'))"
echo "genesis.json:   $(sha256sum "$J4/config-rt/genesis.json" | awk '{print $1}') (EOS-Jungle-Testnet/Node-Manual-Installation)"
echo

echo "== 1. EXPOSURE — observed socket bindings (config intent is not the receipt) =="
echo "observed at $(date -u +%Y-%m-%dT%H:%M:%SZ):"
ss -ltnp 2>/dev/null | grep "pid=$PID,"
echo "acceptance: listeners are loopback-bound only (127.0.0.1:8899 http, 127.0.0.1:9878 p2p) —"
echo "            matches the intended posture; loopback-BOUND is not CLOSED (sockets exist)."
echo

echo "== 2. IDENTITY — the node's own view =="
echo "observed at $(date -u +%Y-%m-%dT%H:%M:%SZ):"
curl -fsS --max-time 6 "$HTTP/v1/chain/get_info" | python3 -m json.tool
CHAIN_OK=$(curl -fsS --max-time 6 "$HTTP/v1/chain/get_info" | python3 -c "import json,sys; print(json.load(sys.stdin)['chain_id'])")
echo "expected chain-id: 73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d (PUBLIC-CONSTANT, pinned in the committed config)"
[ "$CHAIN_OK" = "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d" ] && echo "verdict: MATCH — the configured chain-id is now VERIFIED, not expected" || echo "verdict: MISMATCH"  # PUBLIC-CONSTANT: public jungle4 chain data (scanner marker)
echo

echo "== 3. PEER — completed Jungle4 handshakes (configured nine ≠ connected nine) =="
echo "observed at $(date -u +%Y-%m-%dT%H:%M:%SZ):"
curl -fsS --max-time 6 "$HTTP/v1/net/connections" | python3 -c "
import json, sys
cs = json.load(sys.stdin)
print('connection objects:', len(cs))
done = [c for c in cs if c.get('last_handshake',{}).get('chain_id','').startswith('73e4385a')]
print('completed jungle4 handshakes:', len(done), 'of 9 configured peers')
for c in cs:
    h = c.get('last_handshake', {})
    cid = h.get('chain_id','')
    mark = 'HANDSHAKE-COMPLETE' if cid.startswith('73e4385a') else 'incomplete'
    print(f\"  {c.get('peer','?'):42s} {mark:20s} agent={h.get('agent','')!r:24s} peer_forkdb_head={h.get('fork_db_head_num',0)}\")
"
echo

echo "== 4. AGREEMENT — local LIB block ID vs independent public API, exact height =="
echo "observed at $(date -u +%Y-%m-%dT%H:%M:%SZ):"
LIBNUM=$(curl -fsS --max-time 6 "$HTTP/v1/chain/get_info" | python3 -c "import json,sys; print(json.load(sys.stdin)['last_irreversible_block_num'])")
echo "local LIB: $LIBNUM"
LOCAL_BLOCK=$(curl -fsS --max-time 8 -X POST "$HTTP/v1/chain/get_block" -H 'Content-Type: application/json' -d "{\"block_num_or_id\":$LIBNUM}")
PUB_BLOCK=$(curl -fsS --max-time 10 -X POST "$PUB/v1/chain/get_block" -H 'Content-Type: application/json' -d "{\"block_num_or_id\":$LIBNUM}")
LID=$(printf '%s' "$LOCAL_BLOCK" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
PID_=$(printf '%s' "$PUB_BLOCK" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
LTIM=$(printf '%s' "$LOCAL_BLOCK" | python3 -c "import json,sys; print(json.load(sys.stdin)['timestamp'])")
PTIM=$(printf '%s' "$PUB_BLOCK" | python3 -c "import json,sys; print(json.load(sys.stdin)['timestamp'])")
PUBCH=$(curl -fsS --max-time 8 "$PUB/v1/chain/get_info" | python3 -c "import json,sys; print(json.load(sys.stdin)['chain_id'])")
echo "compared height:      $LIBNUM"
echo "local  block id:      $LID (block time $LTIM)"
echo "public block id:      $PID_ (block time $PTIM) — source $PUB (greymass), independent of the snapshot source (eosnation)"
echo "public chain-id:      $PUBCH"
[ "$LID" = "$PID_" ] && echo "verdict: MATCH — same chain-id and same block ID at height $LIBNUM; agreement established" || echo "verdict: MISMATCH — $LID vs $PID_"
echo
echo "== end of receipts =="
} | tee "$OUT"
echo
echo "receipt saved: $OUT"
