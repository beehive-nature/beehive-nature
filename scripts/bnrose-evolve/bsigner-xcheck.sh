#!/bin/sh
# bnrose-evolve × bsigner cross-check: envelopes written by the REAL bsigner
# binary verify under the controller's verifier, by role, and fail closed on a
# wrong role, a wrong file and a wrong key. The battery's own signer mirrors
# bsigner's envelope shape; this run removes the mirror from the argument.
#
# Throwaway keys only: a fresh key directory under mktemp, sealed under the
# published BIP-39 all-zero-entropy test phrase (assembled here, never a real
# owner's words), deleted on exit. Nothing is printed but public halves.
#
# Usage: sh scripts/bnrose-evolve/bsigner-xcheck.sh <bsigner> <bnrose-evolve>

set -eu
BSIGNER=$1
EVOLVE=$2
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

words=""
i=0
while [ $i -lt 23 ]; do words="$words abandon"; i=$((i + 1)); done
BSX_REC="${words# } art"
export BSX_REC

keygen() {
    "$BSIGNER" keygen --alg ml-dsa-65 --rec-env BSX_REC --keydir "$WORK/keys" > "$WORK/$1.json"
    kid=$(grep -o '"key_id": *"[^"]*"' "$WORK/$1.json" | sed 's/.*"\([^"]*\)"$/\1/')
    vk=$(grep -o '"verifying_key_b64u": *"[^"]*"' "$WORK/$1.json" | sed 's/.*"\([^"]*\)"$/\1/')
    [ -n "$kid" ] && [ -n "$vk" ] || { echo "XCHECK: keygen output unreadable"; exit 1; }
    echo "$2 $kid ml-dsa-65 $vk" >> "$WORK/trust.txt"
    eval "${1}_KID=\$kid"
}
keygen sov sovereign
keygen agt agent

printf 'bnrose-evolve/policy/v1\npolicy_id=xcheck\n' > "$WORK/policy.txt"
"$BSIGNER" sign --key-id "$sov_KID" --file "$WORK/policy.txt" --rec-env BSX_REC \
    --keydir "$WORK/keys" --out "$WORK/policy.sov.json" > /dev/null
"$BSIGNER" sign --key-id "$agt_KID" --file "$WORK/policy.txt" --rec-env BSX_REC \
    --keydir "$WORK/keys" --out "$WORK/policy.agt.json" > /dev/null

verify() {
    "$EVOLVE" verify-envelope --trust "$WORK/trust.txt" --role "$1" --file "$2" --envelope "$3"
}

FAIL=0
expect() {
    want=$1
    shift
    if out=$(verify "$@"); then got=0; else got=$?; fi
    if [ "$got" = "$want" ]; then
        echo "XCHECK ok   (exit $got): $out"
    else
        echo "XCHECK FAIL (exit $got, wanted $want): $out"
        FAIL=1
    fi
}

expect 0 sovereign "$WORK/policy.txt" "$WORK/policy.sov.json"
expect 0 agent "$WORK/policy.txt" "$WORK/policy.agt.json"
expect 1 sovereign "$WORK/policy.txt" "$WORK/policy.agt.json"
printf 'bnrose-evolve/policy/v1\npolicy_id=xcheck2\n' > "$WORK/other.txt"
expect 1 sovereign "$WORK/other.txt" "$WORK/policy.sov.json"
# a different public key registered under the sovereign's key id: refused
keygen str stranger
str_vk=$(awk '$1=="stranger"{print $4}' "$WORK/trust.txt")
awk -v vk="$str_vk" '$1=="sovereign"{print $1, $2, $3, vk} $1=="agent"{print}' \
    "$WORK/trust.txt" > "$WORK/substituted.txt"
if out=$("$EVOLVE" verify-envelope --trust "$WORK/substituted.txt" --role sovereign \
    --file "$WORK/policy.txt" --envelope "$WORK/policy.sov.json"); then got=0; else got=$?; fi
if [ "$got" = 1 ]; then
    echo "XCHECK ok   (exit 1): $out"
else
    echo "XCHECK FAIL (exit $got, wanted 1 under a substituted key): $out"
    FAIL=1
fi

[ "$FAIL" -eq 0 ] && echo "XCHECK: bsigner envelopes verify by role and fail closed"
exit "$FAIL"
