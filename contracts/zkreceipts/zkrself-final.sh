#!/bin/bash
# zkrself-final.sh v4 — the FINALIZER, review order 2026-10-07 round 4.
# v3's repairs (parent-owned accounting, required-leg ledger, EXACT
# build identity, asserted final state) were accepted; three further
# failure modes reproduced in the pinned v3 and are closed here, each
# offline-proven by zkrself-final-v4-offline-test.sh BEFORE this
# runner's next live use:
#   · THE IDENTITY GATE — v3 recorded `identity FAIL` and then pushed
#     anyway (7 verify + 1 anchor calls against an unidentified build;
#     wallet access even preceded the test). v4: read-only identity
#     validation completes BEFORE any wallet access or action push;
#     failed, absent or unreadable identity ends the run nonzero with
#     ZERO action calls. The regression asserts the CALL COUNT, not the
#     eventual exit code.
#   · STATUS PROPAGATION — v3's expect_refuse() captured RC and never
#     used it: a command that exits 0 while printing the refusal text
#     scored green, and a final-table read that exits 17 while emitting
#     a valid body passed through the pipeline (the shell takes the
#     LAST command's status). v4: a refusal is nonzero command status
#     PLUS the contract's own message; every state-bearing read must
#     itself succeed before its body can establish anything. No blanket
#     set -e — the classifications and diagnostics are kept.
#   · RUN-LOCAL STATE — v3 kept /tmp/zkr-disc.log, /tmp/zkr-final-spec.json
#     and /tmp/zkr-find.err at FIXED paths: another finalizer's startup
#     truncation could wipe the discovery record mid-run, the spec
#     became [], and the helper graded a bare row count green — final-
#     state verification turned into a check of nothing. v4: a private
#     per-run mktemp dir, the assertion spec built from the PARENT-OWNED
#     discovery record (a shell variable — no file to truncate), one
#     checked write with read-back, and MANDATORY coverage: the spec
#     must carry exactly the claims discovery recorded this run; an
#     empty record fails the final leg instead of shrinking the work.
# v3's laws all stand: parent-owned accounting (discovery NEVER records
# inside a subshell), the required-leg ledger (absence is a failure),
# EXACT build identity, asserted final state. Reconciles STANDING
# anchors (no deployment — shell logic is not a reason to buy another
# deploy). Positives for these claims were receipted by zkrself-run.sh.
U=${U:-https://jungle4.greymass.com}
RURL=${RURL:-https://jungle4.api.eosnation.io}
# REPO = the directory CONTAINING the helpers (final-find.mjs,
# final_table_assert.mjs). NOTE: the v2 form `${REPO:-base}/contracts/
# zkreceipts` appended the suffix even when REPO was pre-set — a doubled
# path that unloaded every helper (found by the offline regressions).
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature/contracts/zkreceipts}
# W is env-honored (v3 hardcoded ~/plonkport, silently ignoring the
# offline tests' W= override — they only worked where a real lab lived)
W=${W:-$HOME/plonkport}
A=${A:-zkrtst111111}
CLEOS=${CLEOS:-"/usr/bin/cleos -u $U"}
RCLEOS=${RCLEOS:-"/usr/bin/cleos -u $RURL"}
# PUBLIC-CONSTANT: zkrcount v1.1 release wasm sha256 (zkrcount.cpp @ this lane, deployed on zkrtst111111 2026-10-07)
EXPECTED_HASH=${EXPECTED_HASH:-7a86ac34ddf15489a90775a2e0e8f1baa7e5337a268af73e43e41c884af6f40d}  # PUBLIC-CONSTANT: zkrcount v1.1 release wasm sha256
PASS=0; FAILS=0; RESULTS=""
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; echo "----- output (first 4 lines) -----"; echo "$2" | head -4; echo "--------------------------------"; FAILS=$((FAILS+1)); }
record(){ RESULTS="$RESULTS
$1 $2"; [ "$2" = PASS ] || FAILS=$((FAILS+1)); }
LEGS="identity forged count21 rootflip kind1 reverify asym019 asym120 exhaust final"

# v4 law 3: private per-run state. No fixed /tmp/zkr-* path exists in
# this script — another run's startup truncation has nothing to find.
RUNTMP=$(mktemp -d "${TMPDIR:-/tmp}/zkr-final.XXXXXXXX") || { echo "FATAL: no private run dir"; exit 1; }
DISC_LOG=$RUNTMP/disc.log          # receipt MIRROR of the parent-owned record
SPEC=$RUNTMP/final-spec.json
FIND_ERR=$RUNTMP/find.err
: > "$DISC_LOG"
# the parent-owned discovery record — the source of truth for the final
# assertion spec. A shell variable cannot be truncated by another process.
DISC_CLAIMS=""
DISC_SEQS=""
DISC_N=0
echo "run-local state: $RUNTMP"

finish(){ # print the ledger, then exit with the run verdict
  echo "== LEDGER =="
  local L LINE MISSING=0
  for L in $LEGS; do
    LINE=$(printf '%s\n' "$RESULTS" | grep "^$L " | head -1)
    case "${LINE#* }" in
      PASS) echo "  $L: PASS" ;;
      FAIL) echo "  $L: FAIL" ;;
      *)    echo "  $L: NEVER RAN — absence is a failure (the v2 defect, closed)"; MISSING=$((MISSING+1)); FAILS=$((FAILS+1)) ;;
    esac
  done
  echo "== RESULT: $PASS passed, $FAILS failed (incl. $MISSING never-ran) =="
  if [ $FAILS -eq 0 ]; then rm -rf "$RUNTMP" 2>/dev/null; exit 0; fi
  echo "run dir kept for diagnosis: $RUNTMP"
  exit 1
}

push_raw(){ OUT=$($CLEOS push action $A "$1" "$2" -p $A 2>&1); RC=$?; }
expect_refuse(){ # label action json exact-message → status only (parent records)
  local LBL=$1 ACT=$2 ARGS=$3 MSG=$4
  push_raw "$ACT" "$ARGS"
  # v4 law 2: a refusal is a CONTRACT rejection — nonzero command
  # status AND the contract's own message. A clean exit 0 printing
  # error-like text is an anomaly, never a green refusal (offline
  # mutation: every action exit 0 + refusal text once scored all legs
  # PASS and the run exited 0).
  if echo "$OUT" | grep -q "executed transaction:"; then bad "$LBL — UNEXPECTEDLY EXECUTED"; echo "$OUT" | head -3; return 1; fi
  if [ "$RC" -eq 0 ]; then bad "$LBL — command exited 0; a refusal must be a nonzero status (clean exit + error text = anomaly)"; echo "$OUT" | head -3; return 1; fi
  if echo "$OUT" | grep -qF "$MSG"; then ok "$LBL — refused (rc=$RC): $MSG"; return 0; fi
  bad "$LBL — wrong/absent reason (expected: $MSG; rc=$RC)"; echo "$OUT" | head -3; return 1
}
# discovery, subshell-safe AND status-gated: stdout `seq N` only;
# diagnostics to stderr; rc 0 found · 1 no-match · 2 inconclusive.
# NEVER records failures. A read whose COMMAND failed can never
# establish state (v4 law 2) — the raw read and its parse are separate,
# and only a successful read's body reaches the parser.
find_anchor(){ # root kind count [unverified|verified]
  local I RES RAW PRC
  for I in 1 2 3 4 5 6; do
    RAW=$($RCLEOS get table $A $A anchors -l 1000 2>>"$FIND_ERR"); PRC=$?
    if [ $PRC -ne 0 ]; then
      echo "find_anchor($1,$2,$3): READ-FAILED rc=$PRC attempt $I of 6 — a failed command's body cannot establish state" >&2
      sleep 4; continue
    fi
    RES=$(printf '%s' "$RAW" | node $REPO/final-find.mjs "$1" "$2" "$3" "${4:-unverified}")
    case "$RES" in
      "seq "*) echo "seq ${RES#seq } (attempt $I)" >&2; echo "${RES#seq }"; return 0 ;;
      NONE)    echo "find_anchor($1,$2,$3,${4:-unverified}): no standing row matches" >&2; return 1 ;;
      *)      echo "find_anchor($1,$2,$3): READ-ERROR attempt $I of 6" >&2 ;;
    esac
    sleep 4
  done
  echo "find_anchor($1,$2,$3): INCONCLUSIVE after 6 attempts" >&2
  return 2
}
discover(){ # leg-id root kind count [class] → sets SEQ; records on failure
  local R CLAIM
  if R=$(find_anchor "$2" "$3" "$4" "${5:-unverified}" 2>>"$FIND_ERR"); then
    SEQ=${R%% *}; echo "  [$1] prerequisite: seq $SEQ"
    CLAIM=$(node -e "console.log(JSON.stringify({seq:+process.argv[1],root:process.argv[2],kind:+process.argv[3],count:+process.argv[4],verified:process.argv[5]==='verified'?'nonzero':'zero'}))" "$SEQ" "$2" "$3" "$4" "${5:-unverified}") \
      || { record "$1" FAIL; echo "  [$1] claim-encode failed"; return 1; }
    DISC_CLAIMS="$DISC_CLAIMS
$CLAIM"
    DISC_SEQS="$DISC_SEQS $SEQ"
    DISC_N=$((DISC_N+1))
    printf '%s\n' "$CLAIM" >> "$DISC_LOG" 2>/dev/null \
      || echo "  [$1] WARNING: discovery-receipt mirror write failed (parent record unaffected)" >&2
    return 0
  fi
  record "$1" FAIL; echo "  [$1] discovery failed: $(tail -1 "$FIND_ERR" 2>/dev/null)"
  return 1
}
read_cap(){ # → stdout: the cap · rc 0 ok · 1 failed (reason on stdout)
  local RAW PRC CAPV
  RAW=$($RCLEOS get table $A $A law 2>"$RUNTMP/law.err"); PRC=$?
  if [ $PRC -ne 0 ]; then echo "law-table read FAILED rc=$PRC — a failed read cannot establish the cap"; return 1; fi
  CAPV=$(printf '%s' "$RAW" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).rows[0].max_anchors)}catch(e){console.log('?')}})")
  if [ -n "$CAPV" ] && [ "$CAPV" != "?" ]; then echo "$CAPV"; return 0; fi
  echo "law-table unreadable (no max_anchors in a successful read)"
  return 1
}

ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")
ROOTFLIP=$(node -pe "const r='$ROOT'.split(''); const c=r[63]; r[63]= c==='f'?'0':(parseInt(c,16)+1).toString(16); r.join('')")
FROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/asym/expected.json')).root.replace(/^0x/,'')")
P_DEAD=$(node -pe "require('$W/calldata_dead.json').proof_hex")
P_FORG=$(node -pe "require('$W/calldata_forged.json').proof_hex")
FA_DEAD=$(node -pe "require('$W/asym/calldata_dead.json').proof_hex")
FA_LIVE=$(node -pe "require('$W/asym/calldata_live.json').proof_hex")
vargs(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],proof:process.argv[2]}))" "$@"; }
aargs(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],root:process.argv[2],kind:+process.argv[3],count:+process.argv[4]}))" "$@"; }
PAIR="count proof REJECTED — plonk pairing false"

echo "== [0] build identity (EXACT equality — pinned release wasm; THE GATE) =="
# v4 law 1: identity is read-only and completes BEFORE any wallet access
# or action push. Failed, absent or unreadable identity ends the run
# nonzero with ZERO action calls — a red ledger after pushing to a wrong
# build cannot un-push (offline-proven: v3 recorded identity FAIL then
# made 7 verify + 1 anchor calls against the unidentified build, with
# wallet operations before the test even ran).
IDRAW=$($RCLEOS get code $A 2>"$RUNTMP/getcode.err"); IDRC=$?
CH=""
[ $IDRC -eq 0 ] && CH=$(printf '%s\n' "$IDRAW" | head -1 | grep -oE '[a-f0-9]{64}')
if [ $IDRC -eq 0 ] && [ -n "$CH" ] && [ "$CH" = "$EXPECTED_HASH" ]; then
  ok "on-chain code hash == pinned wasm sha256 (${CH:0:16}…, this exact build)"; record identity PASS
else
  if [ $IDRC -ne 0 ]; then
    bad "build identity: get code FAILED rc=$IDRC — unreadable identity never admits actions" ""
  elif [ -z "$CH" ]; then
    bad "build identity: no code hash readable on-chain (absent is not a check)" ""
  else
    bad "build identity: on-chain '$CH' ≠ pinned '$EXPECTED_HASH' — wrong build or no code" ""
  fi
  record identity FAIL
  finish
fi
# only an IDENTIFIED build gets the wallet (v3 unlocked it first)
BNRZK_PW=$(cat /tmp/nd/bnrzk.pw 2>/dev/null)
ZKRTST_KEY=$(awk 'NR==1{print $1}' /tmp/nd/zkrtst.key 2>/dev/null)
$CLEOS wallet unlock --name bnrzk --password "$BNRZK_PW" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key "$ZKRTST_KEY" >/dev/null 2>&1 || true

echo "== [1] negative legs against standing anchors (discovered, parent-owned) =="
if discover forged "$ROOT" 0 20; then
  expect_refuse "forged proof (eval_zw+1) @seq $SEQ" verify "$(vargs $SEQ "$P_FORG")" "$PAIR" && record forged PASS || record forged FAIL
fi
if discover count21 "$ROOT" 0 21; then
  expect_refuse "real dead proof vs count=21 @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR" && record count21 PASS || record count21 FAIL
fi
if discover rootflip "$ROOTFLIP" 0 20; then
  expect_refuse "real dead proof vs mutated root @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR" && record rootflip PASS || record rootflip FAIL
fi
if discover kind1 "$ROOT" 1 20; then
  expect_refuse "real DEAD proof vs kind=1 @seq $SEQ" verify "$(vargs $SEQ "$P_DEAD")" "$PAIR" && record kind1 PASS || record kind1 FAIL
fi
if discover reverify "$ROOT" 0 20 verified; then
  expect_refuse "re-verify @seq $SEQ (already verified)" verify "$(vargs $SEQ "$P_DEAD")" "anchor already verified (one proof per anchor)" && record reverify PASS || record reverify FAIL
fi
echo "== [2] asym REVERSED claims (the selector law, on-chain) =="
if discover asym019 "$FROOT" 0 19; then
  expect_refuse "valid asym-dead proof vs REVERSED (0,19) @seq $SEQ" verify "$(vargs $SEQ "$FA_DEAD")" "$PAIR" && record asym019 PASS || record asym019 FAIL
fi
if discover asym120 "$FROOT" 1 20; then
  expect_refuse "valid asym-live proof vs REVERSED (1,20) @seq $SEQ" verify "$(vargs $SEQ "$FA_LIVE")" "$PAIR" && record asym120 PASS || record asym120 FAIL
fi
echo "== [3] exhaustion — the bounded budget refuses in the open =="
if CAP=$(read_cap); then
  expect_refuse "anchor beyond cap (table full)" anchor "$(aargs 4294967295 "$ROOT" 0 20)" "anchor table FULL (bounded resource budget)" && record exhaust PASS || record exhaust FAIL
else
  bad "exhaust — $CAP"; record exhaust FAIL
fi

echo "== [4] final state (ASSERTED — mandatory coverage, run-local spec) =="
FCAP=""
if CAP=$(read_cap); then FCAP=$CAP; else bad "final — $CAP"; record final FAIL; fi
# v4 law 3: the spec is built from the PARENT-OWNED discovery record,
# written ONCE to the private run dir, read back, and coverage-checked
# against the parent's own count — an empty or short record FAILS rather
# than shrinking the promised verification work to a bare row count
# (offline-proven: v3's truncated discovery log yielded spec [] and a
# green "total rows == cap" grade with no claim inspected at all).
if [ -z "$FCAP" ]; then
  :
elif [ $DISC_N -eq 0 ]; then
  bad "final — the discovery record is EMPTY: grading on row count alone would be a check of nothing" ""
  record final FAIL
else
  # one checked write: the parent record becomes a proper JSON ARRAY on
  # disk; the coverage step below reads it BACK — a failed or truncated
  # write cannot pass as construction
  printf '%s\n' "$DISC_CLAIMS" | sed '/^$/d' | node -e "
let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  const spec = s.split('\n').filter(Boolean).map(l => JSON.parse(l));
  require('fs').writeFileSync(process.argv[1], JSON.stringify(spec, null, 1));
});" "$SPEC"
  if COV=$(node -e '
const fs = require("fs");
const [specPath, wantSeqs, wantN] = process.argv.slice(1);
let spec;
try { spec = JSON.parse(fs.readFileSync(specPath, "utf8")); }
catch (e) { console.log("spec unreadable/malformed after write: " + e.message); process.exit(1); }
if (!Array.isArray(spec)) { console.log("spec is not an array"); process.exit(1); }
const want = wantSeqs.split(/\s+/).filter(Boolean).map(Number);
const got = spec.map(s => (s && typeof s.seq === "number") ? s.seq : undefined);
const sortNums = a => [...a].sort((x, y) => x - y).join(",");
if (got.some(s => s === undefined) || got.length !== Number(wantN) || sortNums(got) !== sortNums(want)) {
  console.log("coverage mismatch: spec file carries " + got.length + " claims; discovery recorded " + wantN);
  process.exit(1);
}
console.log("coverage: " + got.length + " claims — exactly what discovery recorded this run");' \
      "$SPEC" "$DISC_SEQS" "$DISC_N"); then
    echo "  $COV"
    FRAW=$($RCLEOS get table $A $A anchors -l 1000 2>"$RUNTMP/final-read.err"); FRC=$?
    if [ $FRC -ne 0 ]; then
      bad "final — table read FAILED rc=$FRC: a body emitted by a failed command cannot establish state" ""
      record final FAIL
    elif printf '%s' "$FRAW" | node $REPO/final_table_assert.mjs "$SPEC" "$FCAP"; then
      record final PASS
    else
      record final FAIL
    fi
  else
    bad "final — $COV"; record final FAIL
  fi
fi

finish
