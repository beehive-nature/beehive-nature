#!/bin/bash
# zkrself-final-offline-test.sh — OFFLINE accounting proof for
# zkrself-final.sh v3 (review order 3, 2026-10-07: "prove those changes
# with offline fixtures before using the runner again"). No network, no
# chain, no RAM: a stub cleos replays fixture responses and the FULL
# finalizer runs against them. Guards the v2 defect class — a subshell
# recording failures the parent never sees — by proving that a MISSING
# leg fails the run and a wrong build fails identity, not just that the
# happy path is green.
#
# Cases:
#   1. happy    — every leg discovers, every refusal on its specified
#                 reason, final table asserts → exit 0
#   2. missing  — the asym019 row absent from the table → that leg
#                 FAILS via discovery and the run exits 1 (absence is a
#                 failure, never a skipped green)
#   3. wrongbld — on-chain code hash ≠ pinned wasm sha256 → identity
#                 FAIL, exit 1 (merely non-empty is not a check)
set -u
REPO=${REPO:-$(cd "$(dirname "$0")" && pwd)}
W=${W:-$HOME/plonkport}
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
PASS=0; FAILS=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; FAILS=$((FAILS+1)); }

ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")
FLIP=$(node -pe "const r=process.argv[1].split(''); const c=r[63]; r[63]= c==='f'?'0':(parseInt(c,16)+1).toString(16); r.join('')" "$ROOT")
FROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/asym/expected.json')).root.replace(/^0x/,'')")
# the pinned build: the built release wasm when present in the lab, else
# the pinned constant from zkrself-final.sh (kept marker-free here by
# reading the script's own default — no hex literal in this file)
HASH=${EXPECTED_HASH:-}
[ -n "$HASH" ] || HASH=$(sha256sum "$W/zkr11/zkrcount.wasm" 2>/dev/null | cut -d' ' -f1)
[ -n "$HASH" ] || HASH=$(grep -oE 'EXPECTED_HASH=\$\{EXPECTED_HASH:-[0-9a-f]{64}' "$REPO/zkrself-final.sh" | grep -oE '[0-9a-f]{64}')
[ -n "$HASH" ] || { echo "FATAL: no pinned hash available (lab wasm absent and final.sh default unreadable)"; exit 1; }
WRONG=$(printf '1%.0s' $(seq 1 64))

# the stub cleos: env TABLE (anchors JSON) · CODE_HASH · CAP · VERIFIED_SEQS
cat > "$T/stub-cleos.sh" <<'STUB'
#!/bin/bash
SUB=$1; shift
case "$SUB" in
  wallet) exit 0 ;;
  get)
    # after `shift`: $1=code|table, $2=account|scope, $3=code, $4=table name
    if [ "$1" = code ]; then echo "code hash: $CODE_HASH"; exit 0; fi
    if [ "$4" = law ]; then echo "{\"rows\":[{\"max_anchors\":$CAP,\"alg\":2}],\"more\":false}"; exit 0; fi
    cat "$TABLE"; exit 0 ;;
  push)
    ACT=$3; ARGS=$4
    SEQ=$(node -e "try{console.log(JSON.parse(process.argv[1]).seq)}catch(e){}" "$ARGS")
    if [ "$ACT" = anchor ]; then
      echo "assertion failure with message: anchor table FULL (bounded resource budget)"
      exit 1
    fi
    case " $VERIFIED_SEQS " in *" $SEQ "*)
      echo "assertion failure with message: anchor already verified (one proof per anchor)"; exit 1 ;;
    esac
    echo "assertion failure with message: count proof REJECTED — plonk pairing false"
    exit 1 ;;
esac
exit 0
STUB
chmod +x "$T/stub-cleos.sh"

mktbl(){ # row specs "seq:root:kind:count:verified_at" ... → table JSON on stdout
  node -e '
const rows = [];
for (const a of process.argv.slice(1)) {
  const [seq, root, kind, count, vat] = a.split(":");
  rows.push({ seq: +seq, root, kind: +kind, count: +count, alg: 2, anchored_at: 1791354590, verified_at: +vat });
}
console.log(JSON.stringify({ rows, more: false }, null, 1));' "$@"
}

R=$ROOT; FL=$FLIP; FR=$FROOT
mktbl 101:$R:0:20:1791354598  102:$R:1:20:1791354603  103:$R:0:20:0 \
      104:$R:0:21:0  105:$FL:0:20:0  106:$R:1:20:0 \
      201:$FR:0:19:0  202:$FR:1:20:0 > "$T/table-happy.json"
mktbl 101:$R:0:20:1791354598  102:$R:1:20:1791354603  103:$R:0:20:0 \
      104:$R:0:21:0  105:$FL:0:20:0  106:$R:1:20:0 \
      202:$FR:1:20:0 > "$T/table-missing.json"

runfinal(){ # tablefile stub-codehash pinned-hash cap label wantExit
  local TABLEF=$1 STUBHASH=$2 PINNED=$3 CAPV=$4 LBL=$5 WANT=$6 OUT RC
  export TABLE=$TABLEF CODE_HASH=$STUBHASH CAP=$CAPV VERIFIED_SEQS="101 102"
  OUT=$(CLEOS="bash $T/stub-cleos.sh" RCLEOS="bash $T/stub-cleos.sh" \
        EXPECTED_HASH=$PINNED REPO=$REPO W=$W bash "$REPO/zkrself-final.sh" 2>&1)
  RC=$?
  echo "$OUT" | grep -E "^== (LEDGER|RESULT)|NEVER RAN|FAIL" | sed 's/^/    /'
  if [ "$RC" = "$WANT" ]; then ok "$LBL (exit $RC)"; else bad "$LBL — exit $RC ≠ $WANT"; fi
}

echo "== case 1: happy (all legs discover, all refusals on reason, final asserts) =="
runfinal "$T/table-happy.json"  "$HASH"  "$HASH"  8 "happy-path green" 0
echo "== case 2: asym019 row MISSING (absence must fail, never skip green) =="
runfinal "$T/table-missing.json" "$HASH"  "$HASH"  7 "missing-row red" 1
echo "== case 3: wrong build identity (non-empty wrong hash must fail) =="
runfinal "$T/table-happy.json"  "$WRONG" "$HASH"  8 "wrong-build red" 1

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
