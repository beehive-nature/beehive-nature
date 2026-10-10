#!/bin/bash
# zkrself-final.test.sh — the finalizer's OFFLINE verdict-logic
# regressions (review order 2026-10-07 round 3, reproducing the
# reviewer's stub table): the runner must exit 0 ONLY when every
# expected leg ran and passed; missing prerequisites must produce
# exit ≠ 0 with ZERO proof-verification calls; malformed final state
# and wrong build identity must both fail. No chain, no wallet — the
# stub cleos serves fixtures from each scenario's $STUB_DIR.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
STUB=$HERE/stub/cleos.stub.sh
T=${T:-/tmp/zkr-final-test}
rm -rf $T; mkdir -p $T
ROOT=$(node -pe "JSON.parse(require('fs').readFileSync(process.env.HOME+'/plonkport/expected.json')).root.replace(/^0x/,'')")
FROOT=$(node -pe "JSON.parse(require('fs').readFileSync(process.env.HOME+'/plonkport/asym/expected.json')).root.replace(/^0x/,'')")
if [ -z "$ROOT" ] || [ -z "$FROOT" ]; then echo "FATAL: plonkport artifacts absent"; exit 1; fi
PIN=7a86ac34ddf15489a90775a2e0e8f1baa7e5337a268af73e43e41c884af6f40d   # PUBLIC-CONSTANT: zkrcount v1.1 release wasm sha256 — the pin under test (same pin as the finalizer's EXPECTED_HASH)
PASS=0; FAILS=0
ok(){ echo "  PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "  FAIL: $1"; FAILS=$((FAILS+1)); }

mkrows(){ # the control table: the seven claims + fillers to 27 rows
  node - "$ROOT" "$FROOT" <<'NODE'
const [ROOT, FROOT] = process.argv.slice(2);
const rootflip = ROOT.slice(0,63) + (ROOT[63]==='f'?'0':(parseInt(ROOT[63],16)+1).toString(16));
const rows = [];
let seq = 1;
const claim = (root,kind,count,verified)=>rows.push({seq:seq++,root,kind,count,alg:2,
  anchored_at:1791347000,verified_at:verified?1791348000:0});
claim(ROOT,0,20,true);            // 1: the verified row (reverify leg)
claim(ROOT,0,20,false);           // 2: forged-proof target
claim(ROOT,0,21,false);           // 3
claim(rootflip,0,20,false);       // 4
claim(ROOT,1,20,false);           // 5
claim(FROOT,0,19,false);          // 6
claim(FROOT,1,20,false);          // 7
while (rows.length < 27) claim(ROOT,0,20,false);
console.log(JSON.stringify({rows}));
NODE
}

scenario(){ SC=$T/$1; mkdir -p $SC; }
seed(){ # common fixtures: identity, law
  printf 'code hash: %s\n' "$PIN" > $SC/code.txt
  printf '{"rows":[{"max_anchors":27,"alg":2}]}\n' > $SC/law.json
}
run_final(){ # → exit code
  ( cd $T && CLEOS="bash $STUB" RCLEOS="bash $STUB" STUB_DIR=$SC REPO=$HERE \
    EXPECTED_HASH=$PIN bash $HERE/zkrself-final.sh >$SC/out.log 2>&1 )
  echo $?
}

echo "== control: all claims present, correct responses =="
scenario control; mkrows > $SC/table.json; seed
RC=$(run_final); VC=$(cat $SC/verify.count 2>/dev/null || echo 0)
[ "$RC" = 0 ] && ok "control exits 0" || bad "control exit $RC (want 0)"
sed -n '/== LEDGER/,$p' $SC/out.log | tail -13
[ "$VC" -ge 7 ] && ok "control made $VC proof-verification calls (≥7 — every leg ran)" || bad "control made only $VC verify calls"

echo "== missing prerequisites: table full, none of the seven claims present =="
scenario missing
node -e "const r=[];for(let i=0;i<27;i++)r.push({seq:900+i,root:'ab'.repeat(32),kind:0,count:5,alg:2,anchored_at:1,verified_at:0});console.log(JSON.stringify({rows:r}))" > $SC/table.json
seed
RC=$(run_final); VC=$(cat $SC/verify.count 2>/dev/null || echo 0)
[ "$RC" != 0 ] && ok "missing-prereqs exits $RC (nonzero — v2 scored this 0)" || bad "missing-prereqs exited 0 (THE v2 DEFECT still open)"
[ "$VC" = 0 ] && ok "zero proof-verification calls — no leg pretended to run" || bad "$VC verify calls happened without prerequisites"

echo "== malformed final state: valid until the last table read =="
scenario malformed; mkrows > $SC/table.json; seed
printf 'not json at all {{{' > $SC/table.8.json   # discovery reads 1-7, the [4] assertion reads 8th
RC=$(run_final)
[ "$RC" != 0 ] && ok "malformed final state exits $RC (nonzero — v2 reported 9 passed 0 failed)" || bad "malformed final exited 0"

echo "== wrong build identity: zero code hash =="
scenario wrongid; mkrows > $SC/table.json; seed
printf 'code hash: 0000000000000000000000000000000000000000000000000000000000000000\n' > $SC/code.txt   # PUBLIC-CONSTANT: zero-hash test vector (wrong-identity scenario)
RC=$(run_final)
[ "$RC" != 0 ] && ok "zero code hash exits $RC (nonzero — v2's non-empty predicate accepted it)" || bad "zero-hash identity exited 0"

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
