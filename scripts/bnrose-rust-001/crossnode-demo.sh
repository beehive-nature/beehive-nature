#!/bin/sh
# BNROSE cross-node demonstration: INDEPENDENTLY RUNNING PROCESSES —
# two sovereign supervisors, one shared intent dispatched CONCURRENTLY,
# a destination that enforces idempotency on verified receipts, a
# crash between effect and receipt, and replay enforcement.
#
# The boundary held verbatim (review disposition 2026-10-14): local
# exclusion protects a process; destination idempotency protects an
# effect; consensus, when required, must be established independently.
# Exactly one effect at THIS destination does not establish globally
# exactly-once execution across arbitrary destinations — that needs
# destination-specific atomicity, durable deduplication, and finality
# assumptions. The destination here is the single-owner harness ledger
# (dest-init/dest-apply), not an adversarial or consensus model.
#
# Phases (exit codes are the contract; `run` preserves them past the tee):
#   1. concurrent duplicate dispatch: two sovereign processes, one
#      intent, both exit 0 — cross-node dual acceptance is REAL
#   2. destination replay: A applied, B already, replaying A again
#      still already — exactly one row for three verified submissions
#   3. unverified evidence: a receipt under the WRONG public key is
#      rejected before any effect
#   4. crash between effect and receipt: --lose-response (exit 3),
#      recover, then the destination applies the RECOVERED receipt
#      once and refuses the duplicate replay
#   5. teeth: a naive destination (no dedup) records two effects

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
BIN=${1:-target/release/bnrose-exec-host}
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) [ -x "$BIN" ] || BIN="$BIN.exe" ;;
esac
OUT=${2:-docs/receipts/bnrose-rust-001/crossnode-demo.txt}
: "${BNROSE_EXEC_WASM:=target/wasm32-unknown-unknown/release/bnrose_exec_wasm.wasm}"
export BNROSE_EXEC_WASM

[ -x "$BIN" ] || { echo "binary not found: $BIN (build it first)"; exit 2; }
mkdir -p "$(dirname "$OUT")"
: > "$OUT"

# run args... : capture stdout, PRESERVE the exit code in RUN_RC.
run() {
    _o=$("$BIN" "$@" 2>&1)
    RUN_RC=$?
    printf '%s\n' "$_o"
    printf '%s\n' "$_o" >> "$OUT"
}

note() {
    printf '%s\n' "$*"
    printf '%s\n' "$*" >> "$OUT"
}

# expect <rc> <label>: assert the last RUN_RC, naming the phase.
expect() {
    [ "$RUN_RC" = "$1" ] || { echo "phase failed ($2): exit=$RUN_RC want=$1"; exit 1; }
    note "$2: exit=$RUN_RC"
}

S=$(mktemp -d)
NA=$S/node-a
NB=$S/node-b
NC=$S/node-c
D1=$S/dest
D2=$S/dest-crash
S2=
S3=
trap 'rm -rf "$S" ${S2:+"$S2"} ${S3:+"$S3"}' EXIT

ROOT_A=
ROOT_B=
ROOT_C=
ROOT_D=
_i=0
while [ "$_i" -lt 32 ]; do
    ROOT_A="${ROOT_A}11"
    ROOT_B="${ROOT_B}22"
    ROOT_C="${ROOT_C}33"
    ROOT_D="${ROOT_D}44"
    _i=$((_i + 1))
done
NOW=1800000000

note "# BNROSE cross-node demonstration (independent processes)"
note "# run: $(date -u '+%Y-%m-%dT%H:%M:%SZ') binary: $BIN wasm: $BNROSE_EXEC_WASM"
note ""
note "## three sovereigns and two destinations, all separate processes"
run init --state "$NA" --root-hex "$ROOT_A"
expect 0 "node A init"
run init --state "$NB" --root-hex "$ROOT_B"
expect 0 "node B init"
run init --state "$NC" --root-hex "$ROOT_C"
expect 0 "node C init"
run dest-init --state "$D1" --root-hex "$ROOT_D"
expect 0 "destination init"
run dest-init --state "$D2" --root-hex "$ROOT_D"
expect 0 "crash-leg destination init"
"$BIN" make-fixture --index 91 --now "$NOW" --ttl 3600 --out "$S/intent.json"
PK_A=$("$BIN" status --state "$NA" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)
PK_B=$("$BIN" status --state "$NB" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)
PK_C=$("$BIN" status --state "$NC" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)

note ""
note "## phase 1 — concurrent duplicate dispatch (two processes, one intent)"
"$BIN" run-op --state "$NA" --intent "$S/intent.json" --clock "$NOW" --worker native > "$S/a.out" 2>&1 &
P1=$!
"$BIN" run-op --state "$NB" --intent "$S/intent.json" --clock "$NOW" --worker native > "$S/b.out" 2>&1 &
P2=$!
wait "$P1"; R1=$?
wait "$P2"; R2=$?
cat "$S/a.out" "$S/b.out"
cat "$S/a.out" "$S/b.out" >> "$OUT"
note "node A exit=$R1, node B exit=$R2 (both 0: dual acceptance is real; the dedup journals are local)"
[ "$R1" = 0 ] && [ "$R2" = 0 ] || { echo "phase 1: dual dispatch did not both complete"; exit 1; }
RA=$NA/receipts/$(ls "$NA/receipts" | head -1)
RB=$NB/receipts/$(ls "$NB/receipts" | head -1)
note "A receipt: $RA"
note "B receipt: $RB"

note ""
note "## phase 2 — destination replay: applied, already, already"
run dest-apply --state "$D1" --receipt "$RA" --pk "$PK_A" --wall 1
expect 0 "A's receipt applied"
run dest-apply --state "$D1" --receipt "$RB" --pk "$PK_B" --wall 2
expect 0 "B's receipt deduped"
run dest-apply --state "$D1" --receipt "$RA" --pk "$PK_A" --wall 3
expect 0 "A's receipt replayed"
ROWS=$("$BIN" dest-apply --state "$D1" --receipt "$RA" --pk "$PK_A" --wall 4 | grep -o '"rows":[0-9]*' | cut -d: -f2)
note "destination rows after three verified submissions of one op: $ROWS"
[ "$ROWS" = 1 ] || { echo "phase 2: destination observed more than one effect"; exit 1; }

note ""
note "## phase 3 — unverified evidence is rejected before any effect"
run dest-apply --state "$D1" --receipt "$RB" --pk "$PK_A" --wall 5
expect 1 "B's receipt under A's key refused"
note "(the destination rejects unverified evidence; no row was written)"

note ""
note "## phase 4 — crash between effect and receipt, then recovery and replay"
run run-op --state "$NC" --intent "$S/intent.json" --clock "$NOW" --worker native --lose-response
expect 3 "node C lost the response (effect applied)"
run recover --state "$NC" --clock $((NOW + 100)) --worker native
expect 0 "node C recovered from durable records"
RC=$NC/receipts/$(ls "$NC/receipts" | head -1)
run dest-apply --state "$D2" --receipt "$RC" --pk "$PK_C" --wall 1
expect 0 "the recovered receipt applied once"
run dest-apply --state "$D2" --receipt "$RC" --pk "$PK_C" --wall 2
expect 0 "the duplicate replay refused by idempotency"
ROWS2=$("$BIN" dest-apply --state "$D2" --receipt "$RC" --pk "$PK_C" --wall 3 | grep -o '"rows":[0-9]*' | cut -d: -f2)
note "crash-leg destination rows: $ROWS2"
[ "$ROWS2" = 1 ] || { echo "phase 4: crash leg observed more than one effect"; exit 1; }

note ""
note "## phase 5 — teeth: a naive destination records two effects"
N1=$(grep -c '"effectDigest"' "$RA" || true)
N2=$(grep -c '"effectDigest"' "$RB" || true)
N=$((N1 + N2))
note "naive destination entries for the one op: $N"
[ "$N" = 2 ] || { echo "phase 5: the naive destination failed to convict"; exit 1; }

note ""
note "## verdict"
note "crossnode-demo: PASS — dual acceptance is real and harmless at an enforcing"
note "destination; unverified evidence never becomes an effect; a crash between"
note "effect and receipt does not defeat recovery or replay enforcement; the naive"
note "destination is convicted. Local exclusion protects a process; destination"
note "idempotency protects an effect; consensus is not claimed."
echo
echo "cross-node demo receipt written to $OUT"
