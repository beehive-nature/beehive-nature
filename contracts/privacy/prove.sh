#!/bin/bash
# prove.sh — the M4 proving pipeline (run from ~/plonkport, sources in the repo).
# Ceremony: powersoftau bn128 pot12, ONE honest participant (this rehearsal
# seat) — labeled dev-rehearsal; a production ceremony needs more
# participants. The pre-contribution pot and contribution transcript stay in
# $PWD (wiped with the WSL /tmp-style lifecycle — "transcript burned").
set -e
REPO=/mnt/c/Users/travi/beehive-nature/contracts/privacy
W=~/plonkport
cd $W
[ -d node_modules/snarkjs ] || npm i --silent snarkjs@0.7.6 circomlib circomlibjs js-sha3

echo "[1] compile circuit"
~/.cargo/bin/circom $REPO/spend.circom --r1cs --wasm -l $W/node_modules -o $W || exit 1

echo "[2] powersoftau (one honest participant — rehearsal labeled)"
[ -f pot12_0000.ptau ] || npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
[ -f pot12_0001.ptau ] || npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="m4-one-honest-seat" -v
[ -f pot12_final.ptau ] || npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

echo "[3] plonk setup + vk"
npx snarkjs plonk setup $W/spend.r1cs pot12_final.ptau $W/spend.zkey
npx snarkjs zkey export verificationkey $W/spend.zkey $W/vk.json
npx snarkjs zkey verify $W/spend.r1cs pot12_final.ptau $W/spend.zkey || true

echo "[4] witness + proof"
node $REPO/m4prep.js $W/input.json
node $W/spend_js/generate_witness.js $W/spend_js/spend.wasm $W/input.json $W/witness.wts
npx snarkjs plonk prove $W/spend.zkey $W/witness.wts $W/proof.json $W/public.json

echo "[5] off-chain verify"
npx snarkjs plonk verify $W/vk.json $W/public.json $W/proof.json && echo OFFCHAIN-VERIFY-OK

echo "[6] flatten proof to calldata order (A,B,C,Z,T1,T2,T3,Wxi,Wxiw,eval_a,eval_b,eval_c,eval_s1,eval_s2,eval_zw)"
node $REPO/flatten.js $W/proof.json $W/public.json > $W/calldata.json
node -e "const c=require('$W/calldata.json'); console.log('proof words:', c.proof_words, 'pubs:', c.pubs_hex.length/64, 'bytes:', c.proof_hex.length/2)"
