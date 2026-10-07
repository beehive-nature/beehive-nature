#!/bin/bash
# prove_count.sh — the count.circom proving pipeline (SPEC-ZK-RECEIPT-
# AGGREGATES-1 v1). Run from WSL; sources default to the shared checkout,
# override REPO= to run against a seat worktree.
#   [1] compile + constraint receipt        [5] witness + TWO proofs (dead/live)
#   [2] pot$POT ceremony (one honest seat —  [6] off-chain verify both
#       REHEARSAL-labeled, the estate law)  [7] flatten to calldata
#   [3] plonk setup + vk + zkey verify      [8] FORGERY set (tungsten 1):
#   [4] vk_count_constants.hpp for cdt-cpp      tampered proof + tampered publics
set -e
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature}/contracts/zkreceipts
POT=${POT:-17}
W=~/plonkport
COHORT=${COHORT:-$REPO/../../docs/receipts/ant-reach-cohort-2026-10-06.json}
cd $W
[ -d node_modules/snarkjs ] || npm i --silent snarkjs@0.7.6 circomlib circomlibjs js-sha3

echo "[1] compile circuit"
~/.cargo/bin/circom $REPO/count.circom --r1cs --wasm -l $W/node_modules -o $W
npx snarkjs r1cs info $W/count.r1cs | sed 's/^/    /'

echo "[2] powersoftau bn128 pot$POT (ONE honest participant — REHEARSAL labeled)"
[ -f pot${POT}_0000.ptau ]  || npx snarkjs powersoftau new bn128 $POT pot${POT}_0000.ptau -v
[ -f pot${POT}_0001.ptau ]  || printf 'zkreceipts-pot%s-rehearsal-2026-10-06\n' "$POT" | npx snarkjs powersoftau contribute pot${POT}_0000.ptau pot${POT}_0001.ptau --name="zkreceipts-one-honest-seat" -v
[ -f pot${POT}_final.ptau ] || npx snarkjs powersoftau prepare phase2 pot${POT}_0001.ptau pot${POT}_final.ptau -v

echo "[3] plonk setup + vk"
# PTAU selects the ceremony: default = the lab's one-seat rehearsal pot; the
# RELEASE artifacts are derived from a verified PUBLIC multi-party transcript
# (PTAU=hez17.ptau — Hermez powersOfTau28_hez_final_17, 54 contributions +
# beacon, blake2b-512 pinned against the iden3/snarkjs README table; the
# transcript itself re-verified with `snarkjs powersoftau verify`).
PTAU=${PTAU:-pot${POT}_final.ptau}
echo "    ceremony: $PTAU ($(sha256sum $PTAU | cut -c1-16)… sha256)"
npx snarkjs plonk setup $W/count.r1cs $PTAU $W/count.zkey
npx snarkjs zkey export verificationkey $W/count.zkey $W/count_vk.json
npx snarkjs zkey verify $W/count.r1cs pot${POT}_final.ptau $W/count.zkey || true   # zkey verify is groth16-only ("zkey file is not groth16") — the M-lane prove.sh || true law

echo "[4] vk_count_constants.hpp (for cdt-cpp)"
node $REPO/gen_vk_count_cpp.js $W/count_vk.json $REPO/vk_count_constants.hpp

echo "[5] witness + proofs (kind 0 = dead-baseline, kind 1 = live-baseline)"
node $REPO/zkrprep.cjs "$COHORT" $W
node $W/count_js/generate_witness.js $W/count_js/count.wasm $W/input_dead.json $W/witness_dead.wtns
node $W/count_js/generate_witness.js $W/count_js/count.wasm $W/input_live.json $W/witness_live.wtns
npx snarkjs plonk prove $W/count.zkey $W/witness_dead.wtns $W/proof_dead.json $W/public_dead.json
npx snarkjs plonk prove $W/count.zkey $W/witness_live.wtns $W/proof_live.json $W/public_live.json

echo "[6] off-chain verify (real)"
npx snarkjs plonk verify $W/count_vk.json $W/public_dead.json $W/proof_dead.json && echo OFFCHAIN-DEAD-OK
npx snarkjs plonk verify $W/count_vk.json $W/public_live.json $W/proof_live.json && echo OFFCHAIN-LIVE-OK

echo "[7] flatten to calldata (A,B,C,Z,T1..T3,Wxi,Wxiw,eval_a..eval_zw; pubs root‖kind‖count)"
node $REPO/../privacy/flatten.js $W/proof_dead.json $W/public_dead.json > $W/calldata_dead.json
node $REPO/../privacy/flatten.js $W/proof_live.json  $W/public_live.json  > $W/calldata_live.json

echo "[8] FORGERY set (tungsten 1 — every one must verify FAIL below/on-chain)"
# a: tampered proof word (eval_zw + 1, the m4run mutation)
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('$W/proof_dead.json'));
p.eval_zw=(BigInt(p.eval_zw)+1n).toString();
fs.writeFileSync('$W/proof_forged.json',JSON.stringify(p));
"
node $REPO/../privacy/flatten.js $W/proof_forged.json $W/public_dead.json > $W/calldata_forged.json
npx snarkjs plonk verify $W/count_vk.json $W/public_dead.json $W/proof_forged.json && echo "FORGERY-A PASSED (BAD)" || echo "forgeries-a rejected (expected)"
# b/c/d: real proof against MUTATED PUBLICS (count, root, kind)
for m in count root kind; do
  node -e "
const fs=require('fs');
const pub=JSON.parse(fs.readFileSync('$W/public_dead.json'));
if ('$m'=='count') pub[2]=(BigInt(pub[2])+1n).toString();
if ('$m'=='root')  pub[0]=(BigInt(pub[0])+1n).toString();
if ('$m'=='kind')  pub[1]=(BigInt(pub[1])+1n).toString();
fs.writeFileSync('$W/public_mut_$m.json',JSON.stringify(pub));
"
  npx snarkjs plonk verify $W/count_vk.json $W/public_mut_$m.json $W/proof_dead.json && echo "FORGERY-$m PASSED (BAD)" || echo "forgeries-$m rejected (expected)"
done
echo "[9] expected set (cross-checked against the receipt in step 5)"
cat $W/expected.json

echo "[9b] ASYM REGRESSION (the selector law — fixtures/asym-cohort.json:"
echo "     deadKept=20, liveKept=19; a label mixup can no longer hide)"
node $REPO/zkrprep.cjs $REPO/fixtures/asym-cohort.json $W/asym
node $W/count_js/generate_witness.js $W/count_js/count.wasm $W/asym/input_dead.json $W/asym/witness_dead.wtns
node $W/count_js/generate_witness.js $W/count_js/count.wasm $W/asym/input_live.json $W/asym/witness_live.wtns
npx snarkjs plonk prove $W/count.zkey $W/asym/witness_dead.wtns $W/asym/proof_dead.json $W/asym/public_dead.json
npx snarkjs plonk prove $W/count.zkey $W/asym/witness_live.wtns $W/asym/proof_live.json $W/asym/public_live.json
npx snarkjs plonk verify $W/count_vk.json $W/asym/public_dead.json $W/asym/proof_dead.json && echo "ASYM-DEAD-20-OK"
npx snarkjs plonk verify $W/count_vk.json $W/asym/public_live.json $W/asym/proof_live.json && echo "ASYM-LIVE-19-OK"
node $REPO/../privacy/flatten.js $W/asym/proof_dead.json $W/asym/public_dead.json > $W/asym/calldata_dead.json
node $REPO/../privacy/flatten.js $W/asym/proof_live.json $W/asym/public_live.json > $W/asym/calldata_live.json
# the INVERSION PROBES: the claim the pre-fix selector verified (each kind
# fed the OTHER baseline's count) must now fail AT WITNESS GENERATION —
# picked === count has no satisfying witness
for probe in 0:19 1:20; do
  kind=${probe%%:*}; want=${probe##*:}
  node -e "
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('$W/asym/input_dead.json'));   // same leaf set — only the claim differs
j.kind='$kind'; j.count='$want';
fs.writeFileSync('$W/asym/input_probe_${kind}_${want}.json',JSON.stringify(j));
"
  if node $W/count_js/generate_witness.js $W/count_js/count.wasm $W/asym/input_probe_${kind}_${want}.json $W/asym/witness_probe_${kind}_${want}.wtns 2>$W/asym/probe_err_${kind}_${want}.log; then
    echo "INVERSION-PROBE kind=$kind count=$want PASSED WITNESS (BAD — selector still inverted)"; exit 1
  else
    echo "inversion-probe kind=$kind count=$want refused at witness generation (expected): $(head -c 200 $W/asym/probe_err_${kind}_${want}.log | tr '\n' ' ')"
  fi
done
# tampered publics against a valid ASYM proof (kind and count both)
for m in kind count; do
  node -e "
const fs=require('fs');
const pub=JSON.parse(fs.readFileSync('$W/asym/public_live.json'));
if ('$m'=='kind')  pub[1]=(BigInt(pub[1])+1n).toString();
if ('$m'=='count') pub[2]=(BigInt(pub[2])+1n).toString();
fs.writeFileSync('$W/asym/public_mut_$m.json',JSON.stringify(pub));
"
  npx snarkjs plonk verify $W/count_vk.json $W/asym/public_mut_$m.json $W/asym/proof_live.json && echo "ASYM-FORGERY-$m PASSED (BAD)" || echo "asym-forgeries-$m rejected (expected)"
done
cat $W/asym/expected.json
