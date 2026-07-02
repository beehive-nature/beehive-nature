#!/bin/sh
# Secret scan — single source of truth for the shape rules enforced both
# locally (pre-commit hook, `diff` mode) and remotely (CI, `tree` mode).
#
# Hard signals only — vocabulary like `spend_secret` is legitimate here:
#   1. secret-bearing file names (.seed/.key/.pem/.secret, secrets/, .env*)
#   2. hex runs of 48+ chars in content (key/seed/vector-shaped)
#   3. PEM private-key blocks
#
# Exemptions:
#   - Cargo.lock: its sha256 checksums are 64-char hex and public by nature
#   - lines carrying a same-line TESTNET-ONLY marker — the sanctioned way to
#     commit a throwaway testnet vector for the compat tests, e.g.:
#       let s: [u8; 32] = hex!("...");  // TESTNET-ONLY throwaway compat vector
#   - lines carrying a same-line PUBLIC-CONSTANT marker — for public chain
#     data that merely looks key-shaped (asset ids, txids, block hashes), e.g.:
#       Asset ID: `8614...4f8f` <!-- PUBLIC-CONSTANT: fUSD asset id -->
#     Markers must be on the SAME line as the hex; CI re-scans the whole
#     tree on every push, so an unmarked hex run fails remotely even if it
#     was committed locally with --no-verify.
#
# usage: secret-scan.sh diff   # scan the staged diff (pre-commit hook)
#        secret-scan.sh tree   # scan all tracked files (CI backstop)

mode="$1"
fail=0

NAME_RE='\.(seed|key|pem|secret)$|(^|/)secrets/|(^|/)\.env(\.|$)'
HEX_RE='[0-9a-fA-F]{48,}'
PEM_RE='BEGIN .*PRIVATE KE[Y]'   # [Y] bracket trick: never matches this file itself
MARK='TESTNET-ONLY'
MARK2='PUBLIC-CONSTANT'

case "$mode" in
diff)
    names=$(git diff --cached --name-only --diff-filter=ACM | grep -Ei "$NAME_RE")
    added=$(git diff --cached --diff-filter=ACM -- . ':(exclude)Cargo.lock' ':(exclude)*/Cargo.lock' |
        grep '^+' | grep -v '^+++')
    hex=$(printf '%s\n' "$added" | grep -vF -e "$MARK" -e "$MARK2" | grep -nE "$HEX_RE")
    pem=$(printf '%s\n' "$added" | grep -nE "$PEM_RE")
    ;;
tree)
    names=$(git ls-files | grep -Ei "$NAME_RE")
    hex=$(git grep -InE "$HEX_RE" -- ':(exclude)Cargo.lock' ':(exclude)*/Cargo.lock' | grep -vF -e "$MARK" -e "$MARK2")
    pem=$(git grep -InE "$PEM_RE")
    ;;
*)
    echo "usage: $0 {diff|tree}" >&2
    exit 2
    ;;
esac

if [ -n "$names" ]; then
    echo "BLOCKED: secret-bearing file names:" >&2
    echo "$names" >&2
    fail=1
fi
if [ -n "$hex" ]; then
    echo "BLOCKED: 48+ char hex run(s) (key/seed/vector-shaped)." >&2
    echo "Deliberate testnet vector? Same-line $MARK. Public chain constant? Same-line $MARK2." >&2
    printf '%s\n' "$hex" | head -10 >&2
    fail=1
fi
if [ -n "$pem" ]; then
    echo "BLOCKED: PEM private-key block(s):" >&2
    printf '%s\n' "$pem" | head -10 >&2
    fail=1
fi

if [ "$fail" -ne 0 ]; then
    if [ "$mode" = "diff" ]; then
        echo "" >&2
        echo "Last resort (eyeballed exception): git commit --no-verify — but CI re-scans the tree on push." >&2
    fi
    exit 1
fi
exit 0
