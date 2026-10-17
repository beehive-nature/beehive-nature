#!/bin/sh
# The netpart gate's capability control (review refinement, 2026-10-15):
# prove drops are REAL with a POSITIVE BASELINE — a connection MUST
# succeed before the DROP, MUST fail with a TIMEOUT specifically (a
# refusal or any other failure proves nothing), and MUST succeed again
# after the rule is removed. Anything else fails closed.
set -u
PORT=${1:-7099}
ip link set lo up 2>/dev/null || { echo "FAIL CLOSED: cannot bring up loopback (no NET_ADMIN)"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "FAIL CLOSED: python3 missing for the probe"; exit 1; }
command -v iptables >/dev/null 2>&1 || { echo "FAIL CLOSED: iptables missing"; exit 1; }

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
kill -0 "$SRV" 2>/dev/null || { echo "FAIL CLOSED: control server did not start"; exit 1; }

# probe exit codes: 0 connected; 2 TIMEOUT; 3 refused/other.
probe() {
    python3 - "$PORT" <<'PYEOF'
import socket, sys
p = int(sys.argv[1])
try:
    socket.create_connection(("127.0.0.1", p), timeout=3).close()
    raise SystemExit(0)
except socket.timeout:
    raise SystemExit(2)
except OSError:
    raise SystemExit(3)
PYEOF
}

probe >/dev/null 2>&1
RC=$?
[ "$RC" = 0 ] || { echo "FAIL CLOSED: baseline connection failed (rc=$RC) - the server is not listening, so a later failure would prove nothing"; exit 1; }

iptables -A OUTPUT -p tcp --dport "$PORT" -j DROP 2>/dev/null || { echo "FAIL CLOSED: cannot insert the DROP rule"; exit 1; }
probe >/dev/null 2>&1
RC=$?
if [ "$RC" = 0 ]; then
    echo "FAIL CLOSED: the DROP rule did not drop - packets are flowing; refusing unproven partitions"
    exit 1
fi
[ "$RC" = 2 ] || { echo "FAIL CLOSED: the during-drop probe failed with rc=$RC (refused/other), not a TIMEOUT - that is not drop evidence"; exit 1; }

iptables -D OUTPUT -p tcp --dport "$PORT" -j DROP 2>/dev/null || { echo "FAIL CLOSED: cannot remove the DROP rule"; exit 1; }
probe >/dev/null 2>&1
RC=$?
[ "$RC" = 0 ] || { echo "FAIL CLOSED: connection still failing (rc=$RC) after rule removal - the drop was not the cause"; exit 1; }

echo "control: baseline connect OK; DROP => TIMEOUT specifically; heal connect OK - packets were genuinely dropped"
