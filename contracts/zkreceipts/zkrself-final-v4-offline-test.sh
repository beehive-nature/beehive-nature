#!/bin/bash
# zkrself-final-v4-offline-test.sh — OFFLINE counterexample battery for
# zkrself-final.sh (review round 4, 2026-10-07: "three additional
# failure modes reproduce in the pinned v3"). SELF-CONTAINED: the lab
# stand-in ($W with synthetic roots and calldata hex) is synthesized
# here, so this battery runs wherever bash + node run — no plonkport, no
# cleos, no wallet, no chain. Call counts are stubbed CLI invocations,
# never transactions.
#
# The three reviewer counterexamples, each flipped from v3-red to v4-green:
#   1. identity gate — a wrong/absent build hash must end the run with
#      ZERO action calls (v3 recorded identity FAIL and pushed anyway:
#      7 verify + 1 anchor against an unidentified build). The assertion
#      is the CALL COUNT, not the eventual exit code.
#   2. status propagation — (a) a refusal needs nonzero command status
#      PLUS the contract's own message: a stub that exits 0 while
#      printing the refusal text must fail every refusal leg (v3 scored
#      all ten green); (b) a read whose command fails cannot establish
#      state: a final-table read that exits 17 while emitting a valid
#      body must fail the final leg (v3's pipeline took node's status).
#   3. run-local state — no fixed /tmp/zkr-* paths (another run's
#      startup truncation cannot wipe this run's discovery record), and
#      the final assertion spec carries MANDATORY coverage: an empty
#      discovery record fails the final leg instead of shrinking the
#      verification work to a bare row count (v3: "total rows: 27 == cap
#      27" with spec [] scored PASS).
# Controls preserved from the earlier rounds: happy path green with all
# legs, the committed fixture battery still passes, and the shared
# helper refuses an empty/unreadable spec even on a perfect table.
set -u
REPO=${REPO:-$(cd "$(dirname "$0")" && pwd)}
T=$(mktemp -d)
KEEP=${KEEP:-0}; [ "$KEEP" = 1 ] || trap 'rm -rf "$T"' EXIT
PASS=0; FAILS=0
ok(){ echo "  PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "  FAIL: $1"; FAILS=$((FAILS+1)); }

# ── the lab stand-in: synthetic roots and calldata (content arbitrary —
# the stub never validates proofs; only the ROOTS must match the table)
WL=$T/lab
mkdir -p "$WL/asym"
ROOT=$(node -pe "'ab'.repeat(32)")
FROOT=$(node -pe "'cd'.repeat(32)")
FLIP=$(node -pe "const r=process.argv[1].split('');const c=r[63];r[63]=c==='f'?'0':(parseInt(c,16)+1).toString(16);r.join('')" "$ROOT")
node -e "console.log(JSON.stringify({root:'0x'+process.argv[1]}))" "$ROOT"  > "$WL/expected.json"
node -e "console.log(JSON.stringify({root:'0x'+process.argv[1]}))" "$FROOT" > "$WL/asym/expected.json"
for F in calldata_dead calldata_forged; do
  node -e "console.log(JSON.stringify({proof_hex:'00ff'.repeat(8)}))" > "$WL/$F.json"
done
for F in calldata_dead calldata_live; do
  node -e "console.log(JSON.stringify({proof_hex:'00ff'.repeat(8)}))" > "$WL/asym/$F.json"
done

# the pinned hash — read from the finalizer's own default (no hex
# literal in this file; same pin as the finalizer under test)
PIN=$(grep -oE 'EXPECTED_HASH=\$\{EXPECTED_HASH:-[0-9a-f]{64}' "$REPO/zkrself-final.sh" | grep -oE '[0-9a-f]{64}')
[ -n "$PIN" ] || { echo "FATAL: pin unreadable from finalizer"; exit 1; }
WRONG=$(printf '1%.0s' $(seq 1 64))

# ── the stub cleos: fixtures + mutation knobs (all offline)
#   CODE_HASH / CAP / VERIFIED_SEQS / TABLE — the world
#   ACTIONS_EXIT_ZERO=1 — every push prints its refusal text but exits 0
#   FINAL_READ_RC=N    — the FINAL anchors read emits the valid body but
#                        exits N (the reviewer's exit-17 mutation)
cat > "$T/stub-cleos.sh" <<'STUB'
#!/bin/bash
SUB=$1; shift
SD=$STUB_DIR
bump(){ local C; C=$(cat "$SD/$1" 2>/dev/null || echo 0); echo $((C+1)) > "$SD/$1"; }
case "$SUB" in
  wallet) exit 0 ;;
  get)
    if [ "$1" = code ]; then echo "code hash: $CODE_HASH"; exit 0; fi
    if [ "$4" = law ]; then
      echo "{\"rows\":[{\"max_anchors\":$CAP,\"alg\":2}],\"more\":false}"; exit 0; fi
    bump anchors.reads
    C=$(cat "$SD/anchors.reads")
    if [ -n "${FINAL_READ_RC:-}" ] && [ "$C" = "${FINAL_READ_AT:-8}" ]; then
      cat "$TABLE"; exit "$FINAL_READ_RC"; fi
    [ -f "$SD/table.$C.json" ] && { cat "$SD/table.$C.json"; exit 0; }
    cat "$TABLE"; exit 0 ;;
  push)
    ACT=$3; ARGS=$4
    case "$ACT" in verify) bump verify.count ;; anchor) bump anchor.count ;; esac
    bump actions.count
    OUT_RC=1; [ -n "${ACTIONS_EXIT_ZERO:-}" ] && OUT_RC=0
    SEQ=$(node -e "try{console.log(JSON.parse(process.argv[1]).seq)}catch(e){}" "$ARGS")
    if [ "$ACT" = anchor ]; then
      echo "assertion failure with message: anchor table FULL (bounded resource budget)"; exit $OUT_RC; fi
    case " $VERIFIED_SEQS " in *" $SEQ "*)
      echo "assertion failure with message: anchor already verified (one proof per anchor)"; exit $OUT_RC ;; esac
    echo "assertion failure with message: count proof REJECTED — plonk pairing false"
    exit $OUT_RC ;;
  *) echo "stub: unhandled $SUB" >&2; exit 1 ;;
esac
STUB

# ── the world: the seven standing claims + fillers to exactly 27 rows
export ROOT FLIP FROOT
mktbl(){ # n-claims|n-fillers outfile  (node -e hands user args from argv[1])
  node -e '
const [claims, fillers, out] = process.argv.slice(1);
const R = process.env.ROOT, F = process.env.FLIP, A = process.env.FROOT;
const rows = []; let seq = 1;
const claim = (root, kind, count, vat) => rows.push({seq: seq++, root, kind, count, alg: 2, anchored_at: 1791347000, verified_at: vat});
if (claims === "7") {
  claim(R, 0, 20, 1791348000);   // 1  reverify target (verified)
  claim(R, 0, 20, 0);            // 2  forged target
  claim(R, 0, 21, 0);            // 3  count21
  claim(F, 0, 20, 0);            // 4  rootflip
  claim(R, 1, 20, 0);            // 5  kind1
  claim(A, 0, 19, 0);            // 6  asym019
  claim(A, 1, 20, 0);            // 7  asym120
}
while (rows.length < Number(fillers)) claim("ef".repeat(32), 0, 20, 0);
require("fs").writeFileSync(out, JSON.stringify({rows, more: false}));' "$@"
}
mktbl 7 27 "$T/table-claims.json"
mktbl 0 27 "$T/table-noclaims.json"

# CLEOS/RCLEOS point at the stub for every scenario (the finalizer
# honors the env override; W must be env-honored too — v3 hardcoded
# W=~/plonkport, silently ignoring the committed offline test's W=).
# HOME is overridden as well so that v3's hardcoded ~/plonkport and v4's
# honored $W resolve to the SAME synthetic lab — the battery must not
# depend on whichever real lab happens to live on the host.
export CLEOS="bash $T/stub-cleos.sh"
export RCLEOS="bash $T/stub-cleos.sh"
mkdir -p "$WL-home"
ln -s "$WL" "$WL-home/plonkport"

runfinal(){ # scenario-dir tablefile codehash [knobs...] → OUT, RC
  SC=$1; TBL=$2; CH=$3; shift 3
  mkdir -p "$SC"
  # env(1) so expanded VAR=val knob words are real assignments (a bare
  # "$@" prefix would try to EXECUTE 'ACTIONS_EXIT_ZERO=1' as a command)
  OUT=$(env STUB_DIR=$SC TABLE=$TBL CODE_HASH=$CH CAP=27 VERIFIED_SEQS="1" \
        REPO=$REPO W=$WL HOME=$WL-home EXPECTED_HASH=$PIN "$@" \
        bash "$REPO/zkrself-final.sh" 2>&1); RC=$?
  [ -z "${DEBUG_OUT:-}" ] || printf '%s\n' "$OUT" | sed 's/^/    | /'
}

cnt(){ cat "$1/$2" 2>/dev/null || echo 0; }
ledger(){ printf '%s\n' "$OUT" | sed -n '/== LEDGER ==/,$p' | grep -E "^  ($1): " | head -1; }

echo "== control: all seven claims standing, correct refusals, asserted final =="
runfinal "$T/s-control" "$T/table-claims.json" "$PIN"
[ "$RC" = 0 ] && ok "control exits 0" || bad "control exit $RC (want 0)"
[ "$(ledger final)" = "  final: PASS" ] && ok "final leg PASS (asserted, not printed)" || bad "final leg not green: $(ledger final)"
[ "$(cnt $T/s-control verify.count)" = 7 ] && ok "7 verify calls (every leg ran)" || bad "verify calls = $(cnt $T/s-control verify.count) (want 7)"
[ "$(cnt $T/s-control actions.count)" = 8 ] && ok "8 action calls total (7 verify + 1 anchor)" || bad "action calls = $(cnt $T/s-control actions.count) (want 8)"

echo "== cx1a: WRONG build hash — the gate must hold with ZERO action calls =="
runfinal "$T/s-idwrong" "$T/table-claims.json" "$WRONG"
[ "$RC" != 0 ] && ok "wrong-build exits $RC (nonzero)" || bad "wrong-build exited 0"
[ "$(cnt $T/s-idwrong actions.count)" = 0 ] && ok "ZERO action calls after failed identity (call-count assertion)" || bad "actions after failed identity = $(cnt $T/s-idwrong actions.count) — v3 defect live"
[ "$(cnt $T/s-idwrong verify.count)" = 0 ] && ok "zero verify calls" || bad "verify calls = $(cnt $T/s-idwrong verify.count)"
[ "$(ledger identity)" = "  identity: FAIL" ] && ok "identity FAIL recorded" || bad "identity verdict: $(ledger identity)"

echo "== cx1b: ABSENT build hash (zero/empty) — same gate =="
runfinal "$T/s-idabsent" "$T/table-claims.json" ""
[ "$RC" != 0 ] && ok "absent-identity exits $RC (nonzero)" || bad "absent-identity exited 0"
[ "$(cnt $T/s-idabsent actions.count)" = 0 ] && ok "ZERO action calls (unreadable identity never admits actions)" || bad "actions = $(cnt $T/s-idabsent actions.count) after unreadable identity"

echo "== cx2a: every action EXITS 0 while printing the refusal text =="
runfinal "$T/s-exit0" "$T/table-claims.json" "$PIN" ACTIONS_EXIT_ZERO=1
[ "$RC" != 0 ] && ok "exit-0 refusals fail the run (status is part of the contract)" || bad "run stayed green while every action exited 0 — v3 defect live"
[ "$(cnt $T/s-exit0 verify.count)" = 7 ] && ok "the 7 pushes did happen (the verdict changed, not the calls)" || bad "verify calls = $(cnt $T/s-exit0 verify.count)"
[ "$(ledger forged)" = "  forged: FAIL" ] && ok "forged leg FAIL (clean exit ≠ refusal)" || bad "forged verdict: $(ledger forged)"
[ "$(ledger exhaust)" = "  exhaust: FAIL" ] && ok "exhaust leg FAIL (clean exit ≠ refusal)" || bad "exhaust verdict: $(ledger exhaust)"

echo "== cx2b: final-table read EXITS 17 while emitting a valid body =="
runfinal "$T/s-read17" "$T/table-claims.json" "$PIN" FINAL_READ_RC=17
[ "$RC" != 0 ] && ok "failed final read fails the run" || bad "run stayed green on a failed read — v3 defect live"
[ "$(ledger final)" = "  final: FAIL" ] && ok "final leg FAIL (a failed command's body cannot establish state)" || bad "final verdict: $(ledger final)"

echo "== cx3a: EMPTY discovery record — a row count alone is a check of nothing =="
runfinal "$T/s-noclaims" "$T/table-noclaims.json" "$PIN"
[ "$RC" != 0 ] && ok "no-claims run exits nonzero" || bad "no-claims run exited 0"
[ "$(ledger final)" = "  final: FAIL" ] && ok "final leg FAIL — empty coverage refused (v3 graded spec[] PASS on row count)" || bad "final verdict on empty coverage: $(ledger final) — v3 defect live"

echo "== cx3b: the legacy shared paths are dead — sentinels survive a full run =="
for P in /tmp/zkr-disc.log /tmp/zkr-final-spec.json /tmp/zkr-find.err; do
  printf 'sentinel-%s-untouched\n' "$(basename "$P")" > "$P"
done
runfinal "$T/s-sentinel" "$T/table-claims.json" "$PIN"
S_OK=1
for P in /tmp/zkr-disc.log /tmp/zkr-final-spec.json /tmp/zkr-find.err; do
  grep -q "sentinel-$(basename "$P")-untouched" "$P" || { S_OK=0; bad "$P was touched by the finalizer"; }
done
[ $S_OK = 1 ] && ok "all three legacy /tmp sentinels byte-identical after a green run"
if grep -v '^[[:space:]]*#' "$REPO/zkrself-final.sh" | grep -qE '/tmp/zkr-(disc\.log|final-spec\.json|find\.err)'; then
  bad "finalizer code still references fixed /tmp/zkr-* paths (comments naming the dead paths are allowed; executable use is not)"
else
  ok "finalizer code carries no fixed /tmp/zkr-* path use"
fi

echo "== helper: final_table_assert.mjs refuses empty/unreadable coverage =="
printf '[]' > "$T/spec-empty.json"
printf 'not json {{{' > "$T/spec-bad.json"
node "$REPO/final_table_assert.mjs" "$T/spec-empty.json" 27 < "$T/table-claims.json" >/dev/null 2>&1
[ $? != 0 ] && ok "empty spec → nonzero (perfect table cannot pass a check of nothing)" || bad "empty spec exited 0 on a valid table — v3 defect live"
node "$REPO/final_table_assert.mjs" "$T/spec-bad.json" 27 < "$T/table-claims.json" >/dev/null 2>&1
[ $? != 0 ] && ok "malformed spec → nonzero" || bad "malformed spec exited 0"
node "$REPO/final_table_assert.mjs" "$REPO/fixtures/final/spec.json" 4 < "$REPO/fixtures/final/table-valid.json" >/dev/null 2>&1
[ $? = 0 ] && ok "committed fixture control still green (spec coverage change broke nothing)" || bad "committed fixture control regressed"

echo "== RESULT: $PASS passed, $FAILS failed =="
[ $FAILS -eq 0 ] || exit 1
exit 0
