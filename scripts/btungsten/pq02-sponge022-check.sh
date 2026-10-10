#!/bin/sh
# pq02-sponge022-check.sh — SPEC-BTUNGSTEN-PQ-1 PQ02: the SHA-3 sponge as sha3
# 0.11.0 runs it on keccak 0.2.2 (ml-kem 0.3.2's and slh-dsa's). Classes,
# none standing in for another:
#
#   PIN          every package in pq02-sponge022/Cargo.lock is in the workspace
#                Cargo.lock with the same version and checksum (sha3 0.11.0,
#                keccak 0.2.2).
#   BUILD        pq02-sponge022 compiles to MIR JSON through cargo-saw-build;
#                keccak 0.2.2's one keccak_p instance is found by name and
#                signature.
#   SPEC-CHECK   pq02-cryptol/KeccakF1600.cry's any-rate sponge on closed
#                terms, by evaluation (:exhaust over no variables): SHA3-512
#                of 33 bytes, SHA3-256 of 1184 (both sponge definitions),
#                SHAKE128 of 34 to 504, SHAKE256 of 1120 to 32 and of 33 to
#                128 (values computed by Python's hashlib).
#   EQUIVALENCE  pq02-saw/sponge022.saw: those five shapes (ML-KEM-768's H, G,
#                J, PRF and SampleNTT XOF) equal to FIPS 202 for every input,
#                with keccak_p::<u64, 24> ASSUMED equal to keccakF and held
#                opaque (pq02-saw-check.sh ties it: shipped022.saw and
#                agree022.saw).
#   TEETH        sponge022-teeth-512.saw (SHA3-512 at rate 136) and
#                sponge022-teeth-128.saw (SHAKE128 at rate 136) MUST fail with
#                a counterexample.
#
# Not covered: shake 0.1.0 (ml-dsa's SHAKE) absorbs through a pointer cast of
# its u64 state to bytes that SAW's MIR model cannot read; see
# pq02-sponge022/src/lib.rs.
#
# usage: pq02-sponge022-check.sh <saw> <cryptol>
set -eu

SAW="${1:?usage: pq02-sponge022-check.sh <saw> <cryptol>}"
CRYPTOL="${2:?usage: pq02-sponge022-check.sh <saw> <cryptol>}"
ROOT=$(pwd)
SAWDIR="$ROOT/scripts/btungsten/pq02-saw"
CRYDIR="$ROOT/scripts/btungsten/pq02-cryptol"
HARNESS="$ROOT/scripts/btungsten/pq02-sponge022"
OUT="$ROOT/target/saw-pq02-sponge022"
MIR="$OUT/pq02_sponge022.linked-mir.json"

say() { printf '%s\n' "$*"; }
clock() { date +%s; }

say "== SAW PQ02 sponge022: toolchain =="
"$SAW" --version | head -1
"$CRYPTOL" --version | head -1
rm -rf "$OUT" && mkdir -p "$OUT"

# ---- PIN -----------------------------------------------------------------------
say "== SAW PQ02 sponge022: PIN the harness lock to the workspace lock =="
lockset() {
  awk '
    /^\[\[package\]\]/ { n = ""; v = "" }
    /^name = /     { n = $3 }
    /^version = /  { v = $3 }
    /^checksum = / { print n, v, $3 }
  ' "$1" | tr -d '"' | sort
}
lockset "$HARNESS/Cargo.lock" > "$OUT/harness.lock.txt"
lockset "$ROOT/Cargo.lock" > "$OUT/workspace.lock.txt"
_extra=$(comm -23 "$OUT/harness.lock.txt" "$OUT/workspace.lock.txt")
[ -z "$_extra" ] || { say "SAW-PIN PQ02 sponge022: FAIL — harness packages not in the workspace lock as such:"; say "$_extra"; exit 1; }
grep -q '^sha3 0.11.0 ' "$OUT/harness.lock.txt" && grep -q '^keccak 0.2.2 ' "$OUT/harness.lock.txt" ||
  { say "SAW-PIN PQ02 sponge022: FAIL — the harness does not lock sha3 0.11.0 and keccak 0.2.2"; exit 1; }
say "SAW-PIN PQ02 sponge022: PASS ($(wc -l < "$OUT/harness.lock.txt") packages, each the workspace's version and checksum)"

# ---- BUILD -----------------------------------------------------------------------
say "== SAW PQ02 sponge022: BUILD the harness to MIR JSON (cargo-saw-build) =="
_lock0=$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)
( cd "$HARNESS" && RUSTUP_TOOLCHAIN="${MIR_JSON_TOOLCHAIN:-nightly-2026-03-21}" CARGO_TARGET_DIR="$OUT/cargo" \
    cargo saw-build ) || { say "SAW-BUILD PQ02 sponge022: FAIL — harness"; exit 1; }
# cargo-saw-build takes no --locked: the lock must come out as it went in
[ "$(sha256sum "$HARNESS/Cargo.lock" | cut -d' ' -f1)" = "$_lock0" ] ||
  { say "SAW-BUILD PQ02 sponge022: FAIL — the build changed pq02-sponge022/Cargo.lock"; exit 1; }
_found=$(find "$OUT/cargo" -name 'pq02_sponge022-*.linked-mir.json' | head -1)
[ -n "$_found" ] && [ -s "$_found" ] || { say "SAW-BUILD PQ02 sponge022: FAIL — no linked MIR"; exit 1; }
cp "$_found" "$MIR"
# keccak 0.2.2's soft keccak_p, the one instance (u64, 24 rounds: one argument)
python3 - "$MIR" > "$OUT/names.saw" <<'PYEOF' || { say "SAW-BUILD PQ02 sponge022: FAIL — names"; exit 1; }
import json, re, sys
d = json.load(open(sys.argv[1]))
xs = sorted({f["name"] for f in d["fns"]
             if re.search(r"^keccak/[0-9a-f]+::backends::soft::keccak_p::_inst[0-9a-f]+\[0\]$", f["name"]) and len(f["args"]) == 1})
if len(xs) != 1:
    sys.exit(f"keccak_p: {len(xs)} instances {xs}")
print('let keccak_p_name = "' + re.sub(r"/[0-9a-f]+::", "::", xs[0]).removesuffix("[0]") + '";')
PYEOF
say "SAW-BUILD PQ02 sponge022: PASS ($(wc -c < "$MIR") bytes of linked MIR; $(cat "$OUT/names.saw"))"

# ---- SPEC-CHECK --------------------------------------------------------------------
say "== SPEC-CHECK PQ02 sponge022: KeccakF1600.cry closed terms =="
# closed terms over several permutations: evaluated (:exhaust, no variables),
# not sent to a solver whole
for prop in sha3_512Of33 sha3_256Of1184 shake128Of34To504 shake256Of1120 shake256Of33To128; do
  _out=$(cd "$CRYDIR" && "$CRYPTOL" -c ":load KeccakF1600.cry" -c ":exhaust $prop" 2>&1) || {
    say "SPEC-CHECK $prop: ABORTED. Output:"; say "$_out"; exit 1; }
  if ! say "$_out" | grep -aq 'Q.E.D.'; then
    say "SPEC-CHECK $prop: FAIL. Output:"; say "$_out"; exit 1
  fi
  say "SPEC-CHECK $prop: PASS"
done

run_required() {
  _script=$1; shift
  say "== SAW PQ02 sponge022: $_script =="
  _t0=$(clock)
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M8g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  _t1=$(clock)
  say "$_log" | grep -a -E 'PQ02-SAW|Subgoal failed|rror' || true
  for _ob in "$@"; do
    if ! say "$_log" | grep -aqxF "PQ02-SAW PROVEN $_ob"; then
      say "SAW $_script: '$_ob' NOT PROVEN (rc=$_rc). Full output:"
      say "$_log"
      exit 1
    fi
  done
  [ "$_rc" -eq 0 ] || { say "SAW $_script: saw exited rc=$_rc after every PROVEN line — red until explained"; exit 1; }
  say "SAW $_script: $# obligations PROVEN in $((_t1 - _t0))s"
}

run_teeth_verify() {
  _script=$1
  say "== SAW PQ02 sponge022: TEETH $_script — must FAIL with a counterexample =="
  _log=$(cd "$SAWDIR" && "$SAW" +RTS -M8g -RTS "$_script" 2>&1) && _rc=0 || _rc=$?
  say "$_log" | grep -a -E 'PQ02-SAW-TEETH|Subgoal failed|ounterexample' | head -12 || true
  if say "$_log" | grep -aq 'UNEXPECTED-PROVEN' || [ "$_rc" -eq 0 ]; then
    say "SAW-TEETH $_script: FAIL — the wrong obligation was accepted"
    exit 1
  fi
  if ! say "$_log" | grep -aq 'PQ02-SAW-TEETH obligation' || ! say "$_log" | grep -aqiE 'counterexample|^Invalid: \['; then
    say "SAW-TEETH $_script: FAIL — saw failed, but not with a counterexample on the obligation. Full output:"
    say "$_log"
    exit 1
  fi
  say "SAW-TEETH $_script: PASS (counterexample found, as required)"
}

# ---- EQUIVALENCE + TEETH -------------------------------------------------------------
run_required sponge022.saw "sha3 0.11.0 sha3_256_1184" "sha3 0.11.0 sha3_512_33" "sha3 0.11.0 shake256_1120_32"   "sha3 0.11.0 shake256_33_128" "sha3 0.11.0 shake128_34_504"
say "$_log" | grep -aqxF "PQ02-SAW ASSUMED keccak 0.2.2 keccak_p::<u64, 24> = keccakF (tied by shipped022.saw and agree022.saw)" ||
  { say "SAW sponge022.saw: the keccak_p assumption is not reported as such"; exit 1; }
run_teeth_verify sponge022-teeth-512.saw
run_teeth_verify sponge022-teeth-128.saw

say "== SAW PQ02 sponge022: ladder state =="
say "PIN: PASS | BUILD: PASS | SPEC-CHECK: PASS (5) | EQUIVALENCE: PROVEN (5: ML-KEM-768's H, G, J, PRF and SampleNTT XOF shapes) with keccak_p::<u64, 24> ASSUMED = keccakF (tied by the loop lane) | TEETH: PASS (2)"
