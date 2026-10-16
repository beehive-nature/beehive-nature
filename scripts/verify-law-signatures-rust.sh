#!/bin/sh
# verify-law-signatures-rust.sh — SPEC-BTUNGSTEN-PQ-1 §PQ08, the second
# implementation of the law gate: crates/bsigner (RustCrypto ML-DSA-65)
# verifies every file docs/PQ-LAW.json names against its CURRENT bytes,
# independently of scripts/verify-bpq-signatures.mjs (noble). Each signer must
# be pinned in docs/PQ-SIGNERS.json. TEETH: one law file is copied, a line is
# appended, and bsigner must refuse the old signature over it.
#
# usage: sh scripts/verify-law-signatures-rust.sh <path-to-bsigner>   (repo root)
set -eu

BSIGNER="${1:?usage: verify-law-signatures-rust.sh <bsigner>}"
say() { printf '%s\n' "$*"; }
fail() { say "LAW-RUST: FAIL — $*"; exit 1; }
json() { node -e "const v=JSON.parse(require('fs').readFileSync('$1','utf8')); console.log($2)"; }

[ -x "$BSIGNER" ] || fail "bsigner binary missing at $BSIGNER: a skipped gate is not a pass"
FILES=$(json docs/PQ-LAW.json "v.files.join('\n')")
PINS=$(json docs/PQ-SIGNERS.json "v.signers.map(s=>s.id).join('\n')")
[ -n "$FILES" ] || fail "docs/PQ-LAW.json names no law file"

n=0; ok=0
for f in $FILES; do
  n=$((n + 1))
  [ -f "$f.bpqsig.json" ] || { say "LAW-RUST FAIL $f: no signature"; continue; }
  out=$("$BSIGNER" bpq-verify --file "$f.bpqsig.json" --target "$f" 2>&1) || { say "LAW-RUST FAIL $f: $out"; continue; }
  id=$(printf '%s' "$out" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log(v.verified===true&&v.kind==='detached'?v.id:'')})")
  if [ -n "$id" ] && printf '%s\n' "$PINS" | grep -qx "$id"; then
    ok=$((ok + 1)); say "LAW-RUST ok   $f: signed by $id"
  else
    say "LAW-RUST FAIL $f: verified=$out, signer not pinned"
  fi
done

# TEETH: the first law file, changed by one appended line, must be refused
first=$(printf '%s\n' "$FILES" | head -1)
tmp=$(mktemp)
cp "$first" "$tmp" && printf '\nan edit after signing\n' >> "$tmp"
if "$BSIGNER" bpq-verify --file "$first.bpqsig.json" --target "$tmp" > /dev/null 2>&1; then
  rm -f "$tmp"; fail "TEETH: bsigner accepted the signature of $first over a changed copy"
fi
rm -f "$tmp"
say "LAW-RUST TEETH: a changed copy of $first is refused"

say "law files (rust): $ok of $n current"
[ "$ok" -eq "$n" ] || fail "$((n - ok)) law file(s) without a current pinned signature"
