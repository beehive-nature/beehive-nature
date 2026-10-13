#!/usr/bin/env bash
# replace.sh — the replacement test outside GitHub Actions: no GitHub, no Docker, no network beyond
# 127.0.0.1. Edges are keys-door processes; rails and hostile peers are small python servers.
#
#   replace.sh CHAIN_DIR KEYS_DOOR_BIN BSIGNER_BIN
#
# CHAIN_DIR holds r1, r2, r3 and r3x (release.mjs prepare + sign-test, one throwaway signer whose
# id is in CHAIN_DIR/id; r3x is a second valid seq 3 after r2), and CHAIN_DIR/genesis (r1's sha3).
# Trust pins (genesis sha3 + signer id) are written into each edge's config from CHAIN_DIR, never
# taken from a peer.
#
#   1. edge A: inbox r1,r2 + a mock ANT door → seq 2
#   2. edge B: empty, peers=[A] only → seq 2
#   3. edge A, its state and the ANT door destroyed; edge C: empty, peers=[B] only → seq 2, bytes = record
#   4. edge B restarted with its peer gone → serves seq 2 from its own state
#   5. hostile peers against a fresh edge with the right pins: missing history, forged successor,
#      truncated pack, two peers on conflicting branches; and a fresh edge with a wrong genesis pin
#   6. edge B's floor file corrupted, then restarted
set -uo pipefail
CHAIN=$1 KD=$2 BS=$3
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
RELEASE="$ROOT/tools/keychain-release/release.mjs"
W=$(mktemp -d /tmp/keys-replace.XXXXXX)
ID=$(cat "$CHAIN/id") GENESIS=$(cat "$CHAIN/genesis")
PIDS=()
fails=0
pass() { printf 'PASS %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; fails=$((fails + 1)); }
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; wait 2>/dev/null; }
trap cleanup EXIT

py() { python3 "$W/helper.py" "$@"; }
cat >"$W/helper.py" <<'PY'
import base64, hashlib, http.server, json, os, sys, threading, time, urllib.request, urllib.error
cmd = sys.argv[1]
def get(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, e.read()
    except Exception as e: return 0, str(e).encode()
if cmd == "serve":            # serve DIR on PORT: GET /<path> -> DIR/<path with / -> %>, else 404
    port, d = int(sys.argv[2]), sys.argv[3]
    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            f = os.path.join(d, self.path.lstrip("/").replace("/", "%"))
            if not os.path.isfile(f): self.send_response(404); self.end_headers(); return
            b = open(f, "rb").read(); self.send_response(200)
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
elif cmd == "status":         # status PORT -> HTTP status of GET / (0 when nothing answers)
    print(get(f"http://127.0.0.1:{sys.argv[2]}/")[0])
elif cmd == "health":         # health PORT -> one JSON line or "down"
    s, b = get(f"http://127.0.0.1:{sys.argv[2]}/health"); print(b.decode() if s else "down")
elif cmd == "wait":           # wait PORT SEQ SECS
    port, seq, secs = sys.argv[2], int(sys.argv[3]), float(sys.argv[4]); end = time.time() + secs
    while time.time() < end:
        s, b = get(f"http://127.0.0.1:{port}/health")
        if s and json.loads(b).get("seq") == seq: print(b.decode()); sys.exit(0)
        time.sleep(1)
    s, b = get(f"http://127.0.0.1:{port}/health"); print(b.decode() if s else "down"); sys.exit(1)
elif cmd == "bytes":          # bytes PORT RECORD: every file the record names, served = recorded sha256
    port, rec = sys.argv[2], json.load(open(sys.argv[3]))
    bad = []
    for f in rec["files"]:
        s, b = get(f"http://127.0.0.1:{port}/{f['path']}")
        h = base64.urlsafe_b64encode(hashlib.sha256(b).digest()).rstrip(b"=").decode()
        if s != 200 or h != f["sha256"] or len(b) != f["size"]: bad.append(f"{f['path']} {s} {h}")
    print("ok" if not bad else "; ".join(bad)); sys.exit(1 if bad else 0)
elif cmd == "antbody":        # antbody PACK OUT: antd's {"data": base64}
    json.dump({"data": base64.b64encode(open(sys.argv[2], "rb").read()).decode()}, open(sys.argv[3], "w"))
elif cmd == "forge":          # forge ENVELOPE OUT: flip one signature character
    e = json.load(open(sys.argv[2])); s = e["sig"]["sig"]
    e["sig"]["sig"] = ("B" if s[10] != "B" else "C").join([s[:10], s[11:]]); json.dump(e, open(sys.argv[3], "w"), separators=(",", ":"))
PY

port=18300
serve() {  # serve DIR, and require it to answer before going on (a peer that never bound proves nothing)
  local d=$1; port=$((port + 1)); py serve "$port" "$d" & PIDS+=($!); SERVED=$port
  for _ in $(seq 50); do [[ $(py status "$port") != 0 ]] && return 0; sleep 0.1; done
  fail "control: the server for $d never answered on $port"
}
door() {  # door NAME PEERS_TOML ANT_TOML [GENESIS] -> starts keys-door, sets DOOR_PORT/HEALTH_PORT
  local n=$1 peers=$2 ants=$3 gen=${4:-$GENESIS}
  local lp=$((port + 1)) hp=$((port + 2)); port=$((port + 2))
  mkdir -p "$W/$n/state" "$W/$n/inbox"
  cat >"$W/$n/edge.toml" <<EOF
origin = "https://keys.skaists.dev"
rp_id = "keys.skaists.dev"
genesis_sha3 = "$gen"
genesis_signers = ["$ID"]
min_seq = 1
state_dir = "$W/$n/state"
inbox_dir = "$W/$n/inbox"
listen = "127.0.0.1:$lp"
health_listen = "127.0.0.1:$hp"
bsigner_path = "$BS"
poll_secs = 5
ant_doors = $ants
arweave_gateways = []
arweave_owners = []
peers = $peers
EOF
  "$KD" serve --config "$W/$n/edge.toml" >"$W/$n/log" 2>&1 & PIDS+=($!)
  eval "${n}_PID=$!; ${n}_PORT=$lp; ${n}_HEALTH=$hp"
}
peerdir() {  # peerdir NAME r1 r2 ... : a static peer serving these envelopes and the last one's pack
  local d="$W/peer-$1"; shift; mkdir -p "$d"; local i=1 last
  for r in "$@"; do cp "$CHAIN/$r/envelope.json" "$d/.well-known%bnr-keychain%release%$i"; last=$r; i=$((i + 1)); done
  cp "$CHAIN/$last/envelope.json" "$d/.well-known%bnr-keychain%release"
  cp "$CHAIN/$last/pack.bin" "$d/.well-known%bnr-keychain%pack"
  PEERDIR=$d
}

echo "== versions"; "$KD" --version; "$BS" version; node --version; python3 --version
echo "== trust pins (from CHAIN_DIR, not from any peer): genesis $GENESIS, signer $ID"

echo "== 1. edge A from its inbox and a mock ANT door"
mkdir -p "$W/ant"; ADDR=$(sha256sum "$CHAIN/r2/pack.bin" | cut -c1-64)
py antbody "$CHAIN/r2/pack.bin" "$W/ant/v1%data%public%$ADDR"
serve "$W/ant"; ANT=$SERVED; ANT_PID=${PIDS[-1]}
for r in r1 r2; do node "$RELEASE" envelope --record "$CHAIN/$r/record.json" --sig "$CHAIN/$r/record.json.relsig.json" --hint-ant "$ADDR" --out "$W/$r.env.json" >/dev/null; done
door A '[]' "[\"http://127.0.0.1:$ANT\"]"
cp "$W/r1.env.json" "$W/A/inbox/001.json"; cp "$W/r2.env.json" "$W/A/inbox/002.json"
h=$(py wait "$A_HEALTH" 2 60) && pass "1. edge A serves seq 2: $h" || fail "1. edge A: $h"

echo "== 2. edge B: empty state, empty inbox, no rail, peers = [A] only"
door B "[\"http://127.0.0.1:$A_PORT\"]" '[]'
h=$(py wait "$B_HEALTH" 2 60) && pass "2. edge B reached seq 2 from its peer: $h" || fail "2. edge B: $h"

echo "== 3. edge A, its state and the ANT door destroyed; edge C from edge B alone"
kill "$A_PID" "$ANT_PID"; wait "$A_PID" "$ANT_PID" 2>/dev/null; rm -rf "$W/A" "$W/ant"
[[ $(py health "$A_HEALTH") == down ]] && pass "3. edge A is gone (health down, state deleted)" || fail "3. edge A still answers"
door C "[\"http://127.0.0.1:$B_PORT\"]" '[]'
h=$(py wait "$C_HEALTH" 2 60) && pass "3. edge C recovered seq 2 from surviving peer B: $h" || fail "3. edge C: $h"
b=$(py bytes "$C_PORT" "$CHAIN/r2/record.json") && pass "3. edge C serves every file at the record's size and sha256" || fail "3. edge C bytes: $b"

echo "== 4. edge B restarted with its peer gone"
kill "$B_PID"; wait "$B_PID" 2>/dev/null
"$KD" serve --config "$W/B/edge.toml" >>"$W/B/log" 2>&1 & PIDS+=($!); B_PID=$!
h=$(py wait "$B_HEALTH" 2 20) && pass "4. edge B serves seq 2 from its own state after restart: $h" || fail "4. edge B restart: $h"

echo "== 5. hostile peers against fresh edges holding the right pins"
peerdir missing r1 r2; rm "$PEERDIR/.well-known%bnr-keychain%release%1"; serve "$PEERDIR"
door H1 "[\"http://127.0.0.1:$SERVED\"]" '[]'
peerdir forged r1 r2; py forge "$CHAIN/r2/envelope.json" "$PEERDIR/.well-known%bnr-keychain%release%2"
cp "$PEERDIR/.well-known%bnr-keychain%release%2" "$PEERDIR/.well-known%bnr-keychain%release"; serve "$PEERDIR"
door H2 "[\"http://127.0.0.1:$SERVED\"]" '[]'
peerdir trunc r1 r2; head -c 300000 "$CHAIN/r2/pack.bin" >"$PEERDIR/.well-known%bnr-keychain%pack"; serve "$PEERDIR"
door H3 "[\"http://127.0.0.1:$SERVED\"]" '[]'
peerdir left r1 r2 r3; serve "$PEERDIR"; L=$SERVED
peerdir right r1 r2 r3x; serve "$PEERDIR"; Rr=$SERVED
door H4 "[\"http://127.0.0.1:$L\",\"http://127.0.0.1:$Rr\"]" '[]'
door H5 "[\"http://127.0.0.1:$B_PORT\"]" '[]' "$(cat "$CHAIN/r2.prep.json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["sha3"])')"
sleep 40
seq_of() { py health "$1" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("seq"))
except Exception: print("down")'; }
# every hostile verdict below needs the edge up: a dead edge serves nothing for the wrong reason
for n in H1 H2 H3 H4 H5; do v=${n}_HEALTH; [[ $(seq_of "${!v}") != down ]] || fail "5. control: edge $n is not running, its verdict would be vacuous"; done
[[ $(seq_of "$H1_HEALTH") == None ]] && pass "5. missing history (no release/1): nothing served" || fail "5. missing history served something"
[[ $(seq_of "$H2_HEALTH") == 1 ]] && pass "5. forged seq 2: refused; the honest seq 1 below it is served" || fail "5. forged seq 2: edge at $(seq_of "$H2_HEALTH")"
[[ $(seq_of "$H3_HEALTH") == None ]] && pass "5. truncated pack: nothing served" || fail "5. truncated pack served"
h4=$(py health "$H4_HEALTH")
[[ $(seq_of "$H4_HEALTH") == 2 ]] && grep -q "\"equivocation\":{" <<<"$h4" && pass "5. two peers on conflicting seq-3 branches: neither chosen, seq 2 served, the fork reported ($h4)" || fail "5. conflict: $h4"
[[ $(seq_of "$H5_HEALTH") == None ]] && pass "5. wrong genesis pin (r2's sha3): nothing served from an honest peer" || fail "5. wrong genesis pin served"

echo "== 6. edge B's floor file corrupted, then restarted"
kill "$B_PID"; wait "$B_PID" 2>/dev/null; printf 'not-a-number\n' >"$W/B/state/floor"
"$KD" serve --config "$W/B/edge.toml" >>"$W/B/log" 2>&1 & PIDS+=($!); B_PID=$!
sleep 8; h=$(py health "$B_HEALTH"); echo "edge B: $h"
grep -q floor <<<"$h" && pass "6. an unreadable floor is reported, not reset to 0" || fail "6. corrupt floor not reported: $h"
[[ $(cat "$W/B/state/floor") == not-a-number ]] && pass "6. the floor file is left as found" || fail "6. the floor file was rewritten"

echo "== summary: $fails failed"; echo "logs: $W"
exit $((fails > 0))
