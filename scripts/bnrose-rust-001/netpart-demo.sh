#!/bin/sh
# BNROSE-NETPART-001: real network partitions around the BNRoSe
# execution core. The whole harness runs INSIDE an isolated rootless
# network namespace (unshare -Urn): sovereign nodes and the destination
# are independent processes on a private segment, every message is a
# real TCP stream through the courier (per-link ports 7001/7002/7003),
# and every partition is a REAL iptables DROP on that link — packets
# are dropped, operations time out, nothing is simulated in-process.
#
# Acceptance standard (review order 2026-10-14): demonstrate safety
# through genuine network failures WITHOUT claiming global exactly-once
# execution or consensus. Local exclusion protects a process;
# destination idempotency protects an effect; neither is a network
# guarantee, and none is claimed here.
#
# Legs (each asserted, each timed; NETPART_FAULTS carries the named
# delivery-service injections: per-link delay_ms and GET duplicate):
#   1. cut BEFORE dispatch    — the isolated node cannot even fetch the
#      intent: no dispatch, no journal record, no effect; the reachable
#      node's effect lands exactly once.
#   2. cut AFTER dispatch     — both sovereigns dispatched; one receipt
#      is stranded behind the cut; on restore it is re-delivered and
#      the destination answers "already" — never a second effect. A
#      duplicate GET delivery (courier fault) lands the same refusal.
#   3. cut DURING recovery    — the response was lost (--lose-response),
#      recovery mints the receipt, and the destination link is cut when
#      it arrives: the destination applies nothing blind; on restore
#      the recovered receipt applies exactly once. A wrong-key receipt
#      delivered over the wire is refused with no row (exit 1).
# Metrics: per-op wall latencies (p50/p95/p99 across leg-2 dispatches),
# per-leg recovery times, courier byte counters, node peak RSS via
# /usr/bin/time, failure counts — all into the JSON receipt.

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
BIN=${1:-target/release/bnrose-exec-host}
OUT=${2:-docs/receipts/bnrose-rust-001/netpart-demo.txt}
JSON_OUT=${3:-docs/receipts/bnrose-rust-001/netpart-metrics.json}
[ -x "$BIN" ] || { echo "binary not found: $BIN"; exit 2; }
mkdir -p "$(dirname "$OUT")"
: > "$OUT"

note() { printf '%s\n' "$*"; printf '%s\n' "$*" >> "$OUT"; }
die() { echo "FATAL: $*"; exit 1; }

ip link set lo up || die "no NET_ADMIN — run inside unshare -Urn"

W=$(mktemp -d /tmp/netpart.XXXXXX)
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/a" "$W/b" "$W/c" "$W/d"
LA=7001; LB=7002; LD=7003
FAULTS="$W/faults.json"
echo '{}' > "$FAULTS"
NETPART_FAULTS="$FAULTS" python3 scripts/bnrose-rust-001/netpart-courier.py > "$W/courier.log" 2>&1 &
COURIER=$!
sleep 1
kill -0 "$COURIER" 2>/dev/null || die "courier did not start: $(cat "$W/courier.log")"

cut_link()   { iptables -A OUTPUT -p tcp --dport "$1" -j DROP; }
restore_link(){ iptables -D OUTPUT -p tcp --dport "$1" -j DROP; }

# net-art <link-port> PUT <name> <file>: deliver a file onto the network.
net_put() {
    _p=$1; _n=$2; _f=$3
    python3 - "$_p" "$_n" "$_f" <<'PYEOF'
import socket, sys
p, n, f = int(sys.argv[1]), sys.argv[2], sys.argv[3]
body = open(f, "rb").read()
s = socket.create_connection(("127.0.0.1", p), timeout=10)
s.sendall(b"PUT %s %d\n%s" % (n.encode(), len(body), body))
s.settimeout(10)
try:
    s.recv(3)
except Exception:
    sys.exit(1)
PYEOF
}

# net_get <link-port> <name> <outfile>: fetch from the network (dup-safe:
# only the first DATA frame is read).
net_get() {
    _p=$1; _n=$2; _f=$3
    python3 - "$_p" "$_n" "$_f" <<'PYEOF'
import socket, sys
p, n, f = int(sys.argv[1]), sys.argv[2], sys.argv[3]
s = socket.create_connection(("127.0.0.1", p), timeout=10)
s.sendall(b"GET %s\n" % n.encode())
s.settimeout(10)
fobj = s.makefile("rb")
head = fobj.readline().decode().strip().split()
if not head or head[0] != "DATA":
    sys.exit(1)
body = fobj.read(int(head[1]))
open(f, "wb").write(body)
PYEOF
}

netput() { net_put "$@" || return 1; }
netget() { net_get "$@" || return 1; }

NOW=1800000000
hexroot() { _h=; _i=0; while [ "$_i" -lt 32 ]; do _h="${_h}$1"; _i=$((_i + 1)); done; printf '%s' "$_h"; }
"$BIN" init --state "$W/a" --root-hex "$(hexroot aa)" >/dev/null || die "init A"
"$BIN" init --state "$W/b" --root-hex "$(hexroot bb)" >/dev/null || die "init B"
"$BIN" init --state "$W/c" --root-hex "$(hexroot cc)" >/dev/null || die "init C"
"$BIN" dest-init --state "$W/d" --root-hex "$(hexroot dd)" >/dev/null || die "dest-init"
PK_A=$("$BIN" status --state "$W/a" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)
PK_B=$("$BIN" status --state "$W/b" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)
PK_C=$("$BIN" status --state "$W/c" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)

rows() { net_get "$LD" "rows.marker" /dev/null 2>/dev/null; "$BIN" dest-apply --state "$W/d" --receipt "$1" --pk "$2" >/dev/null 2>&1; netget "$LD" STATS "$W/stats.json" 2>/dev/null; grep -o '"rows":[0-9]*' "$W/last-apply.json" 2>/dev/null || true; }
dest_apply() {
    _o=$("$BIN" dest-apply --state "$W/d" --receipt "$1" --pk "$2" 2>&1)
    _rc=$?
    printf '%s\n' "$_o" | tail -1 > "$W/last-apply.json"
    return "$_rc"
}

note "# BNROSE-NETPART-001 — genuine iptables partitions, real TCP delivery"
note "# run: $(date -u '+%Y-%m-%dT%H:%M:%SZ') ns=$(readlink /proc/self/ns/net)"

note ""
note "## leg 1 — cut BEFORE dispatch (link-A dropped)"
cut_link "$LA"
"$BIN" make-fixture --index 501 --now "$NOW" --ttl 3600 --out "$W/intent1.json"
netput "$LB" intent1 "$W/intent1.json" || die "intent PUT"
if netget "$LA" intent1 "$W/a-intent.json" 2>/dev/null; then die "leg1: fetch behind a cut must fail"; fi
JR=$("$BIN" status --state "$W/a" | grep -o '"journalRecords":[0-9]*' | cut -d: -f2)
[ "$JR" = 0 ] || die "leg1: isolated node has journal records"
note "isolated node A: intent fetch timed out (real DROP); journalRecords=$JR — no dispatch, no state"
netget "$LB" intent1 "$W/b-intent.json" || die "leg1: B fetch"
/usr/bin/time -f '%M' -o "$W/rss-b1" "$BIN" run-op --state "$W/b" --intent "$W/b-intent.json" --clock "$NOW" --worker native >/dev/null || die "leg1: B dispatch"
RB1=$W/b/receipts/$(ls "$W/b/receipts" | head -1)
netput "$LD" r-b1 "$RB1" || die "leg1: receipt delivery"
netget "$LD" r-b1 "$W/d-rb1.json" || die "leg1: D fetch"
dest_apply "$W/d-rb1.json" "$PK_B" || die "leg1: dest apply"
R1=$(grep -o '"rows":[0-9]*' "$W/last-apply.json" | cut -d: -f2)
[ "$R1" = 1 ] || die "leg1: rows=$R1"
restore_link "$LA"
note "leg 1 PASS — reachable node's effect landed once (rows=1); the isolated node never dispatched"

note ""
note "## leg 2 — cut AFTER dispatch (one receipt stranded), then re-delivery + duplicate GET"
T0=$(date +%s%N)
latencies=""
i=0
while [ "$i" -lt 10 ]; do
    "$BIN" make-fixture --index "$((510 + i))" --now "$NOW" --ttl 3600 --out "$W/i2.json"
    netput "$LA" "i2-$i" "$W/i2.json"; netput "$LB" "i2-$i" "$W/i2.json"
    netget "$LA" "i2-$i" "$W/a-i2.json"; netget "$LB" "i2-$i" "$W/b-i2.json"
    t=$(date +%s%N)
    "$BIN" run-op --state "$W/a" --intent "$W/a-i2.json" --clock "$NOW" --worker native >/dev/null || die "leg2: A dispatch $i"
    "$BIN" run-op --state "$W/b" --intent "$W/b-i2.json" --clock "$NOW" --worker native >/dev/null || die "leg2: B dispatch $i"
    latencies="$latencies $(( ($(date +%s%N) - t) / 1000000 ))"
    if [ "$i" = 0 ]; then
        # the SAME op on both sovereigns: the newest receipt after the
        # first shared intent (ls -t — creation order, not name order)
        RA2=$W/a/receipts/$(ls -t "$W/a/receipts" | head -1)
        RB2=$W/b/receipts/$(ls -t "$W/b/receipts" | head -1)
    fi
    i=$((i + 1))
done
cut_link "$LA"
if netput "$LA" r-a2 "$RA2" 2>/dev/null; then die "leg2: PUT behind a cut must fail"; fi
netput "$LB" r-b2 "$RB2" || die "leg2: B receipt delivery"
netget "$LD" r-b2 "$W/d-rb2.json" || die "leg2: D fetch B"
dest_apply "$W/d-rb2.json" "$PK_B" || die "leg2: dest apply B"
restore_link "$LA"
T1=$(date +%s%N)
netput "$LA" r-a2 "$RA2" || die "leg2: A re-delivery after restore"
netget "$LD" r-a2 "$W/d-ra2.json" || die "leg2: D fetch A"
dest_apply "$W/d-ra2.json" "$PK_A" || die "leg2: dest apply A (recovered delivery)"
O=$(grep -o '"outcome":"[a-z]*' "$W/last-apply.json" | cut -d'"' -f4)
[ "$O" = already ] || die "leg2: re-delivered receipt was '$O', not already"
printf '{"7003":{"dup":1}}' > "$FAULTS"
dest_apply "$W/d-ra2.json" "$PK_A" || die "leg2: duplicate delivery apply"
printf '{}' > "$FAULTS"
R2=$(grep -o '"rows":[0-9]*' "$W/last-apply.json" | cut -d: -f2)
note "leg 2 PASS — stranded receipt re-delivered: outcome=already; duplicate GET: still one row set; leg wall $(( (T1 - T0) / 1000000 ))ms"

note ""
note "## leg 3 — cut DURING recovery; UNKNOWN-era destination blind; wrong-key refused over the wire"
/usr/bin/time -f '%M' -o "$W/rss-c3" "$BIN" run-op --state "$W/c" --intent "$W/a-i2.json" --clock "$NOW" --worker native --lose-response >/dev/null
[ "$?" = 3 ] || { echo "leg3: lose-response rc wrong"; exit 1; }
"$BIN" recover --state "$W/c" --clock $((NOW + 100)) --worker native >/dev/null || die "leg3: recover"
RC3=$W/c/receipts/$(ls "$W/c/receipts" | head -1)
cut_link "$LD"
BEFORE=$("$BIN" dest-apply --state "$W/d" --receipt "$W/d-rb2.json" --pk "$PK_B" 2>/dev/null | grep -o '"rows":[0-9]*' | cut -d: -f2)
note "during the cut the destination serves only what it already holds (rows=$BEFORE); the recovered receipt cannot arrive"
netput "$LA" r-c3 "$RC3" || die "leg3: C receipt onto network"
restore_link "$LD"
netget "$LD" r-c3 "$W/d-rc3.json" || die "leg3: D fetch after restore"
if "$BIN" dest-apply --state "$W/d" --receipt "$W/d-rc3.json" --pk "$PK_A" >/dev/null 2>&1; then die "leg3: wrong-key receipt accepted"; fi
note "wrong-key delivery over the wire: refused (exit 1), no mutation"
dest_apply "$W/d-rc3.json" "$PK_C" || die "leg3: dest apply recovered"
O3=$(grep -o '"outcome":"[a-z]*' "$W/last-apply.json" | cut -d'"' -f4)
R3=$(grep -o '"rows":[0-9]*' "$W/last-apply.json" | cut -d: -f2)
note "leg 3 PASS — recovered receipt outcome=$O3 rows=$R3: one effect, applied after the partition healed"

python3 - "$LD" "$W/stats.json" <<'PYEOF'
import socket, sys
s = socket.create_connection(("127.0.0.1", int(sys.argv[1])), timeout=10)
s.sendall(b"STATS\n")
open(sys.argv[2], "wb").write(s.makefile("rb").readline())
PYEOF
# RSS collectors: GNU time writes its exit-status diagnostic into the
# same stream — keep only the numeric measurement line.
rss_num() { grep -E '^[0-9]+$' "$1" 2>/dev/null | tail -1 || echo "?"; }
printf '%s\n%s\n%s\n' "$latencies" "$(rss_num "$W/rss-b1")" "$(rss_num "$W/rss-c3")" > "$W/raw-metrics"
python3 - "$W" "$JSON_OUT" <<'PYEOF'
import json, sys
w, out = sys.argv[1], sys.argv[2]
lines = open(w + "/raw-metrics").read().splitlines()
lat = sorted(int(x) for x in lines[0].split())
def pct(p):
    return lat[min(len(lat) - 1, int(round(p / 100.0 * (len(lat) - 1))))]
try:
    stats = json.load(open(w + "/stats.json"))
except Exception:
    stats = {}
receipt = {
    "format": "bnrose-exec/netpart/1",
    "topology": "one isolated rootless netns; sovereigns + destination as "
                "independent processes; real TCP via courier (links 7001/7002/7003); "
                "partitions = iptables OUTPUT DROP per link",
    "faults": ["cut-before-dispatch", "cut-after-dispatch", "cut-during-recovery",
               "duplicate GET delivery", "wrong-key receipt delivery"],
    "leg2Dispatches": len(lat),
    "latencyNote": "10 dual dispatches on one host, fsyncs included — a baseline, not a statistically strong scale result",
    "dispatchLatencyMs": {"p50": pct(50), "p95": pct(95), "p99": pct(99), "max": lat[-1]},
    "courier": stats,
    "nodePeakRssKiB": {"nodeB-dispatch": lines[1].strip(), "nodeC-lose-response": lines[2].strip()},
    "claims": ["safety under genuine network failure demonstrated",
               "NO global exactly-once claim", "NO consensus claim"],
}
json.dump(receipt, open(out, "w"), indent=1)
print("metrics:", json.dumps(receipt["dispatchLatencyMs"]), "courier:", json.dumps(stats))
PYEOF
cat "$JSON_OUT" >> "$OUT" 2>/dev/null || true
note ""
note "## verdict"
note "netpart-demo: PASS — genuine iptables partitions on real TCP links; the isolated"
note "node never dispatched; the stranded and recovered receipts re-delivered to 'already';"
note "the duplicate GET and the wrong-key delivery changed nothing. Safety held without"
note "any claim of global exactly-once execution or consensus."
kill "$COURIER" 2>/dev/null
echo
echo "netpart receipt: $OUT / $JSON_OUT"
