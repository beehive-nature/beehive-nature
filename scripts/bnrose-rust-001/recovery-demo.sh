#!/bin/sh
# BNROSE-RUST-001 recovery demonstration: the vertical slice's healing leg,
# run as SEPARATE PROCESSES with the original worker gone, recovering from
# the authenticated durable records alone.
#
# Phases (exit codes are the contract; `run` preserves them past the tee):
#   1. run-op --lose-response  → exit 3: dispatched, effect applied, the
#      response never recorded (the WB004 retry failure, non-spending)
#   2. recover                 → exit 0: the SAME operation completed from
#      journal + ledger evidence; receipt verifies under the public key
#   3. the same intent again   → refused (nonce-reuse): a missing response
#      authorized no replacement
#   4. adversarial sibling: the durable evidence removed → recover →
#      exit 4 (UNKNOWN preserved), twice; the replacement refused
#   5. tamper: one journal byte flipped → the supervisor refuses to open

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
BIN=${1:-target/release/bnrose-exec-host}
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) [ -x "$BIN" ] || BIN="$BIN.exe" ;;
esac
OUT=${2:-docs/receipts/bnrose-rust-001/recovery-demo.txt}
: "${BNROSE_EXEC_WASM:=target/wasm32-unknown-unknown/release/bnrose_exec_wasm.wasm}"
export BNROSE_EXEC_WASM

[ -x "$BIN" ] || { echo "binary not found: $BIN (build it first)"; exit 2; }
mkdir -p "$(dirname "$OUT")"
: > "$OUT"

# run <expecting-nonzero-ok> args... : capture the binary's stdout (echo +
# append) and PRESERVE its exit code in RUN_RC (a pipeline would eat it).
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

S=$(mktemp -d)
trap 'rm -rf "$S" "$S2" "$S3"' EXIT
ROOT_HEX=$(printf 'fe%.0s' {1..32})
NOW=1800000000

note "# BNROSE-RUST-001 recovery demonstration"
note "# run: $(date -u '+%Y-%m-%dT%H:%M:%SZ') binary: $BIN wasm: $BNROSE_EXEC_WASM"
note ""
note "## supervisor init"
run init --state "$S" --root-hex "$ROOT_HEX"
"$BIN" make-fixture --index 21 --now "$NOW" --ttl 3600 --out "$S/intent.json"

note ""
note "## phase 1 — run-op --lose-response (the WB004 retry crash point)"
run run-op --state "$S" --intent "$S/intent.json" --clock "$NOW" --worker paranoid --lose-response
note "exit=$RUN_RC (3 = dispatched and effect applied, response lost)"
[ "$RUN_RC" = 3 ] || { echo "phase 1 did not exit 3"; exit 1; }
run status --state "$S"

note ""
note "## phase 2 — a clean replacement process recovers"
run recover --state "$S" --clock $((NOW + 100)) --worker paranoid
note "exit=$RUN_RC (0 = unknowns resolved by ledger evidence)"
[ "$RUN_RC" = 0 ] || { echo "phase 2 did not exit 0"; exit 1; }
run status --state "$S"
PK=$("$BIN" status --state "$S" | grep -o '"receiptPublicKey":"[0-9a-f]*' | cut -d'"' -f4)
OP=$(ls "$S/receipts" | head -1 | sed 's/^op-//; s/\.json$//')
"$BIN" verify-receipt --pk "$PK" --receipt "$S/receipts/op-$OP.json"
note "verify-receipt exit=$? (0 = the recovered receipt verifies under the public key alone)"

note ""
note "## phase 3 — the same intent again: refused (no replacement)"
run run-op --state "$S" --intent "$S/intent.json" --clock "$NOW" --worker paranoid
note "exit=$RUN_RC (1 = admission:nonce-reuse)"
[ "$RUN_RC" = 1 ] || { echo "phase 3 did not refuse"; exit 1; }

note ""
note "## phase 4 — adversarial sibling: durable evidence removed"
S2=$(mktemp -d)
"$BIN" init --state "$S2" --root-hex "$ROOT_HEX" >/dev/null
"$BIN" make-fixture --index 22 --now "$NOW" --ttl 3600 --out "$S2/intent.json"
"$BIN" run-op --state "$S2" --intent "$S2/intent.json" --clock "$NOW" --worker paranoid --lose-response >/dev/null
rm -f "$S2/effects.bin"
for round in 1 2; do
    run recover --state "$S2" --clock $((NOW + 100)) --worker paranoid
    note "round $round exit=$RUN_RC (4 = UNKNOWN preserved)"
    [ "$RUN_RC" = 4 ] || { echo "phase 4 round $round did not preserve unknown"; exit 1; }
done
run run-op --state "$S2" --intent "$S2/intent.json" --clock "$NOW" --worker paranoid
note "replacement exit=$RUN_RC (1 = refused)"
[ "$RUN_RC" = 1 ] || { echo "phase 4 replacement was not refused"; exit 1; }

note ""
note "## phase 5 — one flipped journal byte: the supervisor refuses to open"
S3=$(mktemp -d)
"$BIN" init --state "$S3" --root-hex "$ROOT_HEX" >/dev/null
"$BIN" make-fixture --index 23 --now "$NOW" --ttl 3600 --out "$S3/intent.json"
"$BIN" run-op --state "$S3" --intent "$S3/intent.json" --clock "$NOW" --worker paranoid >/dev/null
node -e '
const fs = require("fs");
const p = process.argv[1];
const b = fs.readFileSync(p);
b[Math.floor(b.length / 2)] ^= 1;
fs.writeFileSync(p, b);
' "$S3/journal.bin"
run status --state "$S3"
note "tampered-status exit=$RUN_RC (1 = chain refusal at load, fail closed)"
[ "$RUN_RC" = 1 ] || { echo "phase 5 did not fail closed"; exit 1; }

note ""
note "## verdict"
note "recovery-demo: PASS — the same operation completed from durable records;"
note "UNKNOWN preserved across restarts with replacements refused; tamper fails closed."
echo
echo "recovery demo receipt written to $OUT"
