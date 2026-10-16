#!/bin/bash
# scale-run.sh — the bTunGsTeN-4 scale beat for ONE size (n leaves,
# m members): compile → ceremony pot$POT → setup → vk → witness → prove
# → off-chain verify, with /usr/bin/time -v receipts (wall, peak RSS)
# for witness gen and proving, and an INTERRUPT-RECOVERY leg (kill the
# prove mid-run, rerun to completion, verify the artifact).
# Usage: REPO=… bash scale-run.sh <members> <n> <pot>
set -e
# REPO = the directory containing the helpers (full path; pre-set wins as-is)
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature/contracts/zkreceipts}
W=~/plonkport
M=$1; N=$2; POT=$3
TAG="s${N}"
cd $W
[ -d node_modules/snarkjs ] || npm i --silent snarkjs@0.7.6 circomlib circomlibjs js-sha3

echo "[1] compile count_scale at n=$N (members $M)"
~/.cargo/bin/circom $REPO/count_scale.circom --r1cs --wasm -l $W/node_modules -o $W/$TAG 2>/dev/null || {
  # count_scale.circom carries a template; emit the concrete main via -c? circom
  # has no -D; so a tiny wrapper file instantiates it:
  mkdir -p $W/$TAG
  cat > $W/$TAG/main_$TAG.circom <<EOF
include "$REPO/count_scale.circom";
component main {public [root, kind, count]} = CountScale($N, $M);
EOF
  ~/.cargo/bin/circom $W/$TAG/main_$TAG.circom --r1cs --wasm -l $W/node_modules -o $W/$TAG
}
npx snarkjs r1cs info $W/$TAG/main_$TAG.r1cs | sed 's/^/    /'

echo "[2] ceremony pot$POT (one honest seat — REHEARSAL tier)"
if [ ! -f pot${POT}_final.ptau ]; then
  if [ ! -f pot${POT}_0000.ptau ]; then npx snarkjs powersoftau new bn128 $POT pot${POT}_0000.ptau; fi
  if [ ! -f pot${POT}_0001.ptau ]; then echo "zkreceipts-scale-pot${POT}-rehearsal" | npx snarkjs powersoftau contribute pot${POT}_0000.ptau pot${POT}_0001.ptau --name=zkreceipts-scale -v; fi
  npx snarkjs powersoftau prepare phase2 pot${POT}_0001.ptau pot${POT}_final.ptau -v
fi

echo "[3] setup + vk"
npx snarkjs plonk setup $W/$TAG/main_$TAG.r1cs pot${POT}_final.ptau $W/$TAG/scale.zkey
npx snarkjs zkey export verificationkey $W/$TAG/scale.zkey $W/$TAG/vk.json

echo "[4] witness (timed)"
node $REPO/scale-prep.cjs $M $N $W/$TAG scale-seed-$N
/usr/bin/time -v node $W/$TAG/main_${TAG}_js/generate_witness.js $W/$TAG/main_${TAG}_js/main_$TAG.wasm $W/$TAG/input_dead.json $W/$TAG/witness.wtns 2> $W/$TAG/time-witness.txt
grep -E "Elapsed|Maximum resident" $W/$TAG/time-witness.txt

echo "[5] prove (timed)"
/usr/bin/time -v npx --prefix $W snarkjs plonk prove $W/$TAG/scale.zkey $W/$TAG/witness.wtns $W/$TAG/proof.json $W/$TAG/public.json 2> $W/$TAG/time-prove.txt
grep -E "Elapsed|Maximum resident" $W/$TAG/time-prove.txt

echo "[6] verify (timed)"
/usr/bin/time -v npx --prefix $W snarkjs plonk verify $W/$TAG/vk.json $W/$TAG/public.json $W/$TAG/proof.json 2> $W/$TAG/time-verify.txt
grep -E "Elapsed|Maximum resident" $W/$TAG/time-verify.txt

echo "[7] recovery leg: interrupt the prove at 25s, rerun, verify"
rm -f $W/$TAG/proof.json
(npx --prefix $W snarkjs plonk prove $W/$TAG/scale.zkey $W/$TAG/witness.wtns $W/$TAG/proof.json $W/$TAG/public.json 2>/dev/null & P=$!; sleep 25; kill $P 2>/dev/null; wait $P 2>/dev/null; echo "  killed mid-prove (proof.json $( [ -f $W/$TAG/proof.json ] && echo EXISTS || echo absent ))")
rm -f $W/$TAG/proof.json
npx --prefix $W snarkjs plonk prove $W/$TAG/scale.zkey $W/$TAG/witness.wtns $W/$TAG/proof.json $W/$TAG/public.json
npx --prefix $W snarkjs plonk verify $W/$TAG/vk.json $W/$TAG/public.json $W/$TAG/proof.json && echo "  recovery: rerun proves + verifies OK"

echo "[8] expected set"
cat $W/$TAG/expected_scale.json
