#!/bin/sh
# Secret scan — single source of truth for the shape rules enforced both
# locally (pre-commit hook, `diff` mode) and remotely (CI, `tree` mode).
#
# Hard signals only — vocabulary like `spend_secret` is legitimate here:
#   1. secret-bearing file names (.seed/.key/.pem/.secret, secrets/, .env*)
#   2. hex runs of 48+ chars in content (key/seed/vector-shaped)
#   3. PEM private-key blocks
#   4. base58/bech32 key-shaped strings (Bitcoin WIF both forms, nostr nsec1),
#      shared with push-preflight.sh via scripts/keyshape.sh - one
#      implementation, two enforcers. Checksum-INVALID shape runs (the
#      base64/asset noise class) are collapsed, not flagged; checksum-VALID
#      unmarked strings BLOCK under the same marker law as hex. npub1, the
#      public identifier, can never match (the arm anchors on the nsec1
#      prefix).
#
# Exemptions:
#   - Cargo.lock: its sha256 checksums are 64-char hex and public by nature
#   - fixtures/: generated demo fixtures (`--json` output). Their 64-hex values
#     are commitment hashes computed by the demo at run time — public by
#     construction, never key material — and the file regenerates
#     byte-identically via DEMO_GENERATED_FROM=<head>. Path-scoped exemption,
#     founder-ruled 2026-07-06.
#   - docs/audits/: verbatim GLM audit returns, banked byte-faithful (the
#     no-edits fence forbids adding markers). Their hex runs are the
#     auditor's own docket-digest stamps — content hashes of public audit
#     material, never key material. Path-scoped exemption, founder-ruled
#     2026-07-07.
#   - dockets/*/receipt-*.json: canonical com.beehivenature.receipt
#     manifests. Their sha256 fields are 64-hex content hashes of PUBLIC
#     artifacts (a repo CAR, its blobs) — never key material — and
#     canonical JSON has nowhere to carry a same-line marker without
#     changing the artifact the receipt pins. Path-scoped (this glob only;
#     the 64-hex pattern stays armed everywhere else), founder-ruled
#     2026-07-25 (DISPATCH-2026-07-25-B CC-3, on the fixtures/ basis).
#   - crates/voucher-escrow/fixtures/: the LIVE escrow-ledger snapshot —
#     hash-chained canonical JSONL where every byte is load-bearing (chain
#     verification hashes the exact bytes), so a same-line marker would break
#     the artifact it pins. Its 64-hex values are PUBLIC chain hashes of the
#     append-only events, never key material. Path-scoped (this crate's
#     fixtures only), on the dockets/*/receipt-*.json basis, 2026-08-29.
#   - docs/handoffs/silentpay-v2/: the banked Silent Pay v2 primary corpus —
#     byte-faithful copies of external handoff material (no-edits fence:
#     copies must stay hash-identical to the source MANIFEST, so a same-line
#     marker is impossible). Its 64-hex runs are public sha256/txid/suite
#     pins, verified 11/11 against the corpus's own MANIFEST.json at banking;
#     PROVENANCE.md carries the recovery chain. Path-scoped (this handoff dir
#     only; the 64-hex pattern stays armed everywhere else), on the
#     docs/audits basis, founder-approved 2026-09-16 (Astra disposition:
#     "DC-1 merge after normal CI"; banking commit a1bb4f8e).
#   - lines carrying a same-line TESTNET-ONLY marker — the sanctioned way to
#     commit a throwaway testnet vector for the compat tests, e.g.:
#       let s: [u8; 32] = hex!("...");  // TESTNET-ONLY throwaway compat vector
#   - lines carrying a same-line PUBLIC-CONSTANT marker — for public chain
#     data that merely looks key-shaped (asset ids, txids, block hashes), e.g.:
#       Asset ID: `8614...4f8f` <!-- PUBLIC-CONSTANT: fUSD asset id -->
#     Markers must be on the SAME line as the hex; CI re-scans the whole
#     tree on every push, so an unmarked hex run fails remotely even if it
#     was committed locally with --no-verify.
#   - lines matching proptest's regression-seed SHAPE `cc <64-hex>` — a FORMAT
#     exemption, deliberately NOT a path exemption. proptest-regressions/*.txt
#     seeds are 64-hex RNG cases the file's own header says to commit. Exempting
#     the shape (not the folder) keeps every other line in those files scanned:
#     a real secret pasted there in any other form (`key = <hex>`, a raw blob)
#     is still caught. And a proptest format change fails LOUD — the seed stops
#     matching this shape and the scan flags it — rather than silently opening a
#     gap under a folder nobody watches. Founder-ruled 2026-07-20.
#
# usage: secret-scan.sh diff   # scan the staged diff (pre-commit hook)
#        secret-scan.sh tree   # scan all tracked files (CI backstop)
#        secret-scan.sh selftest  # known-BAD/known-GOOD through THIS body (2026-09-20,
#                                # the P11 law carried across the file boundary: a
#                                # blocker whose wiring can be swapped while saying
#                                # "clean" is false confidence in exactly the path
#                                # that runs where no seat does)

mode="$1"
fail=0

# Shared key-shape implementation (WIF_RE + keyshape classify/mint): one
# implementation, two enforcers - this file and push-preflight.sh.
. "$(dirname "$0")/keyshape.sh"
# FAIL CLOSED on a broken source: an empty WIF_RE would turn the arm into
# `git grep -InE ""` - a match on every line of every file and a per-line
# node spawn over the whole tree, silently, instead of saying it is broken
# (measured by the mutation seat, 2026-09-20). Say it and stop.
if [ -z "$WIF_RE" ]; then
    echo "secret-scan: keyshape.sh did not load - WIF_RE is empty. FAILING CLOSED." >&2
    exit 2
fi

NAME_RE='\.(seed|key|pem|secret)$|(^|/)secrets/|(^|/)\.env(\.|$)'
HEX_RE='[0-9a-fA-F]{48,}'
PEM_RE='BEGIN .*PRIVATE KE[Y]'   # [Y] bracket trick: never matches this file itself
MARK='TESTNET-ONLY'
MARK2='PUBLIC-CONSTANT'
# proptest regression-seed shape: `cc <exactly-64-hex>` at line/diff/grep start.
# Matches only the seed shape, so anything else in those files is still scanned.
PROPTEST_RE='(^|[+:])cc [0-9a-fA-F]{64}([^0-9a-fA-F]|$)'

case "$mode" in
selftest|--selftest)
    # The founder law (a checker is not landed until known-BAD and known-GOOD
    # both appear in its report) + the P11 law carried across the file
    # boundary: the rows run THIS script's own body over a real throwaway
    # repo, not the shared helpers. The mutation seat measured (MC, 2026-09-20)
    # that a swapped wiring in this file said "clean" over an unmarked
    # checksum-VALID WIF while push-preflight's own selftest stayed 11/11 -
    # a blocker that can silently stop blocking is false confidence in
    # exactly the path that runs where no seat does.
    st=0
    SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
    M=$(keyshape mint unc)
    NP=$(keyshape mint npub)
    NOISE="K$(zrep 51)"
    if [ "$M" = ERR ] || [ -z "$M" ]; then
      echo "  fixture mint failed (node unavailable?) - the arm cannot be trusted: FAIL"
      exit 1
    fi
    T=$(mktemp -d 2>/dev/null) || { echo "  mktemp failed: FAIL"; exit 1; }
    (
      cd "$T" && git init -q repo 2>/dev/null && cd repo && mkdir -p scripts || exit 1
      cp "$SELF" scripts/secret-scan.sh
      cp "$(dirname "$SELF")/keyshape.sh" scripts/keyshape.sh
      printf 'fixture: unmarked checksum-VALID WIF\n%s\n' "$M" > fx-unmarked.txt
      printf 'fixture: marked\n%s  TESTNET-ONLY: runtime-minted selftest fixture\n' "$M" > fx-marked.txt
      printf 'fixture: shape-only noise\n%s\n' "$NOISE" > fx-noise.txt
      printf 'fixture: public id\n%s\n' "$NP" > fx-npub.txt
      # N2 (bOPus5 2026-09-20): the diff row stages ONLY the VALID fixture.
      # The old shared staging let a swapped diff arm block fx-noise in the
      # key's place while the row stayed green on the static header's bytes -
      # a row satisfied by the wrong token is not a row. Tree and diff rows
      # now stage separately, mirroring how each mode meets the world.
      git add fx-unmarked.txt fx-marked.txt fx-noise.txt 2>/dev/null
      sh scripts/secret-scan.sh tree > "$T/t1" 2>&1; echo "$?" > "$T/r1"
      git rm -q --cached fx-unmarked.txt fx-marked.txt fx-noise.txt 2>/dev/null
      git add fx-unmarked.txt 2>/dev/null
      sh scripts/secret-scan.sh diff > "$T/t2" 2>&1; echo "$?" > "$T/r2"
      git rm -q --cached fx-unmarked.txt 2>/dev/null
      # S4 (bOPus5 2026-09-20, N9): the noise class had a row in TREE mode only.
      # A diff arm that reported checksum-INVALID strings too - blocking a
      # committer's base64 asset in a real key's place - left S1/S2/S3 all
      # "correct" and the selftest green, measured at f95946ea and again at
      # c474ace7. The false-alarm direction needs its own fixture on its own arm.
      git add fx-noise.txt 2>/dev/null
      sh scripts/secret-scan.sh diff > "$T/t4" 2>&1; echo "$?" > "$T/r4"
      git rm -q --cached fx-noise.txt 2>/dev/null
      rm -f fx-unmarked.txt
      git add fx-marked.txt fx-noise.txt fx-npub.txt 2>/dev/null
      sh scripts/secret-scan.sh tree > "$T/t3" 2>&1; echo "$?" > "$T/r3"
    )
    r1=$(cat "$T/r1" 2>/dev/null || echo 99)
    r2=$(cat "$T/r2" 2>/dev/null || echo 99)
    r3=$(cat "$T/r3" 2>/dev/null || echo 99)
    r4=$(cat "$T/r4" 2>/dev/null || echo 99)
    if [ "$r1" -eq 1 ] && grep -qF "fx-unmarked.txt" "$T/t1" && ! grep -qF "fx-marked.txt" "$T/t1" && ! grep -qF "fx-noise.txt" "$T/t1"; then
      echo "  S1 known-BAD  unmarked VALID WIF, tree mode -> BLOCKED, location named, marked+noise silent (correct)"
    else echo "  S1 known-BAD  tree wiring broken (rc=$r1)"; st=1; fi
    if [ "$r2" -eq 1 ] && grep -qF "added-line 2: [REDACTED key-shaped checksum-VALID]" "$T/t2"; then
      echo "  S2 known-BAD  unmarked VALID WIF ALONE staged, diff mode (the pre-commit path) -> BLOCKED naming ITS line (correct)"
    else echo "  S2 known-BAD  diff wiring broken or wrong token named (rc=$r2)"; st=1; fi
    if [ "$r3" -eq 0 ] && grep -q "clean" "$T/t3"; then
      echo "  S3 known-GOOD marked + noise + npub only -> clean (correct)"
    else echo "  S3 known-GOOD  false positive on marked/noise/npub (rc=$r3)"; st=1; fi
    if [ "$r4" -eq 0 ] && grep -q "clean" "$T/t4"; then
      echo "  S4 known-GOOD shape-only noise ALONE staged, diff mode -> clean (correct)"
    else echo "  S4 known-GOOD  false positive on the noise class in DIFF mode (rc=$r4)"; st=1; fi
    rm -rf "$T"
    [ "$st" -eq 0 ] && echo "secret-scan selftest ok - the blocker blocks, the marked pass, the noise collapses." \
                      || echo "secret-scan selftest FAIL - see above."
    exit $st
    ;;
diff)
    # SS-1 (2026-09-19): fail closed on the enumeration-failure class.
    # Measured live: WSL git against a worktree whose .git file carries a
    # Windows path prints `fatal: not a git repository` and STILL EXITS 0 -
    # the exit code lies; stdout does not. rev-parse prints `true` in every
    # usable checkout (ordinary, fresh clone, worktree under working git)
    # and prints nothing when the gitdir cannot be resolved, so the CONTENT
    # is the guard, not the exit status. Exit 2 = environment refused, never
    # readable as a pass (1 = secret found, 0 = clean). A working repository
    # with an empty staged set still passes - that is a real clean.
    inside=$(git rev-parse --is-inside-work-tree 2>/dev/null)
    if [ "$inside" != "true" ]; then
        echo "  secret-scan: REFUSING - git cannot resolve this checkout (rev-parse answered nothing)." >&2
        echo "  Not a usable repository, or git failed. A scan of nothing is not a pass." >&2
        exit 2
    fi
    # SS-2 fold-in (order 91c72e99; hole reproduced by bOPus5, 2026-09-20):
    # R-status changes were invisible to ACM - a high-similarity rename that
    # appended a key rode past the scan (rc=0). ACMR + --no-renames: renames
    # decompose to A+D, the destination's full content is inspected, and the
    # clean line's count is over exactly what was scanned.
    names=$(git diff --cached --name-only --diff-filter=ACMR --no-renames | grep -Ei "$NAME_RE")
    added=$(git diff --cached --diff-filter=ACMR --no-renames -- . ':(exclude)Cargo.lock' ':(exclude)*/Cargo.lock' ':(exclude)fixtures/' ':(exclude)docs/audits/' ':(exclude)dockets/*/receipt-*.json' ':(exclude)surfaces/blight/bnri-art/' ':(exclude)crates/voucher-escrow/fixtures/' ':(exclude)docs/handoffs/silentpay-v2/' |
        grep '^+' | grep -v '^+++')
    hex=$(printf '%s\n' "$added" | grep -vF -e "$MARK" -e "$MARK2" | grep -vE "$PROPTEST_RE" | grep -nE "$HEX_RE")
    pem=$(printf '%s\n' "$added" | grep -nE "$PEM_RE")
    wif=$(printf '%s\n' "$added" | grep -vF -e "$MARK" -e "$MARK2" | grep -nE "$WIF_RE" | while IFS= read -r lh; do
        aln=${lh%%:*}; acontent=${lh#*:}
        for tok in $(printf '%s\n' "$acontent" | grep -oE "$WIF_RE"); do
          cls=$(keyshape classify "$tok")
          case "$cls" in
            VALID*) echo "added-line $aln: [REDACTED key-shaped checksum-VALID]" ;;
            INVALID) : ;;
            *) echo "added-line $aln: [CLASSIFIER UNAVAILABLE - treat as key-shaped]" ;;
          esac
        done
      done)
    ;;
tree)
    names=$(git ls-files | grep -Ei "$NAME_RE")
    hex=$(git grep -InE "$HEX_RE" -- ':(exclude)Cargo.lock' ':(exclude)*/Cargo.lock' ':(exclude)fixtures/' ':(exclude)docs/audits/' ':(exclude)dockets/*/receipt-*.json' ':(exclude)surfaces/blight/bnri-art/' ':(exclude)crates/voucher-escrow/fixtures/' ':(exclude)docs/handoffs/silentpay-v2/' | grep -vF -e "$MARK" -e "$MARK2" | grep -vE "$PROPTEST_RE")
    pem=$(git grep -InE "$PEM_RE")
    wif=$(git grep -InE "$WIF_RE" -- ':(exclude)Cargo.lock' ':(exclude)*/Cargo.lock' ':(exclude)fixtures/' ':(exclude)docs/audits/' ':(exclude)dockets/*/receipt-*.json' ':(exclude)surfaces/blight/bnri-art/' ':(exclude)crates/voucher-escrow/fixtures/' ':(exclude)docs/handoffs/silentpay-v2/' | grep -vF -e "$MARK" -e "$MARK2" | while IFS= read -r thit; do
        tf=${thit%%:*}; trest=${thit#*:}; tln=${trest%%:*}; tcontent=${trest#*:}
        for tok in $(printf '%s\n' "$tcontent" | grep -oE "$WIF_RE"); do
          cls=$(keyshape classify "$tok")
          case "$cls" in
            VALID*) echo "$tf:$tln: [REDACTED key-shaped checksum-VALID]" ;;
            INVALID) : ;;
            *) echo "$tf:$tln: [CLASSIFIER UNAVAILABLE - treat as key-shaped]" ;;
          esac
        done
      done)
    ;;
*)
    echo "usage: $0 {diff|tree|selftest}   # --selftest accepted (estate form, cf. identity-check.sh --selftest)" >&2
    exit 2
    ;;
esac

# Fail closed. Every branch above enumerates through git, so outside a repository — or if
# git errors for any reason — names/hex/pem all come back empty, `fail` stays 0, and this
# script reports "secret-scan: clean" having inspected NOTHING. A guard that passes
# without looking is worse than no guard, because it produces a receipt.
# In tree mode a repository always has tracked files, so an empty listing means the
# enumeration failed rather than that the tree is clean.
# Diff mode: guarded at the top of its branch by the rev-parse content check
# (SS-1) - a working repository with an empty staged set still passes (a real
# clean for the pre-commit hook); a checkout git cannot enumerate refuses
# with exit 2 before scanning nothing.
if [ "$mode" = tree ] && [ -z "$(git ls-files 2>/dev/null)" ]; then
    echo "  secret-scan: REFUSING — git ls-files returned nothing." >&2
    echo "  Not a git repository, or git failed. A scan of zero files is not a pass." >&2
    exit 2
fi

if [ -n "$names" ]; then
    echo "BLOCKED: secret-bearing file names:" >&2
    echo "$names" >&2
    fail=1
fi
if [ -n "$hex" ]; then
    echo "BLOCKED: 48+ char hex run(s) (key/seed/vector-shaped)." >&2
    echo "Deliberate testnet vector? Same-line $MARK. Public chain constant? Same-line $MARK2." >&2
    # Report locations only. A scanner must not copy the suspected secret
    # into terminal/CI logs while refusing it (AGENTS.md secrets law).
    printf '%s\n' "$hex" | head -10 | awk -F: -v mode="$mode" '{ if (mode == "tree") print $1 ":" $2 ": [REDACTED matching content]"; else print "added-line " $1 ": [REDACTED matching content]" }' >&2
    fail=1
fi
if [ -n "$wif" ]; then
    echo "BLOCKED: key-shaped checksum-VALID string(s) - WIF (base58) or nsec (bech32)." >&2
    echo "Deliberate testnet/test vector? Same-line $MARK. Public documented constant? Same-line $MARK2." >&2
    printf '%s\n' "$wif" | head -10 >&2
    fail=1
fi
if [ -n "$pem" ]; then
    echo "BLOCKED: PEM private-key block(s):" >&2
    printf '%s\n' "$pem" | head -10 | awk -F: -v mode="$mode" '{ if (mode == "tree") print $1 ":" $2 ": [REDACTED matching content]"; else print "added-line " $1 ": [REDACTED matching content]" }' >&2
    fail=1
fi

if [ "$fail" -ne 0 ]; then
    if [ "$mode" = "diff" ]; then
        echo "" >&2
        echo "Last resort (eyeballed exception): git commit --no-verify — but CI re-scans the tree on push." >&2
    fi
    exit 1
fi

# Clean is self-evidencing (SS-1): the count proves the scan enumerated real
# content. A silent exit 0 is indistinguishable from a scan that never ran -
# the WSL/worktree vacuity class this guard family closes.
if [ "$mode" = "diff" ]; then
    echo "secret-scan: clean - diff mode, $(printf '%s\n' "$added" | grep -c .) added lines scanned"
else
    echo "secret-scan: clean - tree mode, $(git ls-files | wc -l) tracked files scanned"
fi
exit 0
