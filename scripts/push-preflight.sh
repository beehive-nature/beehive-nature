#!/bin/sh
# push-preflight.sh — the safety checks a seat runs on its OWN delta before
# pushing its OWN lane.
#
# WHY THIS EXISTS: lane pushes are now per-seat and continuous (standing order,
# 2026-08-25). A one-time preservation push protects the moment it happened, not
# the work that lands after it. But lane commits had never been public before,
# so every lane push now publishes material that was previously local-only —
# and it is public the instant it lands, not when someone reviews it.
#
# THIS IS DETECTION BEFORE PUBLICATION, NOT PREVENTION. It is skippable, and
# CI re-scans on push. Never call this layer "enforced".
#
# FAILS CLOSED: if a range cannot be COMPUTED it exits non-zero. A base that
# does not resolve is "could not determine", never "nothing to check" — the
# same law scripts/identity-check.sh states for the §7 range.
#
# THE FOOTGUN — the dot count that means "only mine" is INVERTED between the
# two commands. This is the whole trap; memorising "three dots" or "two dots"
# as a single rule guarantees getting one of them wrong:
#
#   git log  main..lane     TWO dots    commits that are yours              OK
#   git diff main..lane     TWO dots    diff of TIPS — peer work rides in   WRONG
#                                       REVERSED (their adds show as -,
#                                       their deletes show as +)
#   git diff main...lane    THREE dots  merge-base to lane, only yours      OK
#
# Reproduced here, not taken on report (Cowork ran it with planted secrets):
#   CASE A  two-dot surfaces a peer's content inside "your" delta.
#   CASE B  worse — with an EMPTY subject (git log base..subject returns
#           NOTHING), the two-dot diff STILL emits the peer's content. Measured
#           against origin/lane/zB: subject 0 commits, two-dot 5 files / 12
#           added lines of zB's work, three-dot 0 files. A seat with no work at
#           all can file a security finding about someone else's code.
#
# SIGN INVERSION, and why a wrong-dot finding is UNFALSIFIABLE:
# a reversed two-dot diff also inverts the signs — peer ADDITIONS appear as
# deletions, peer DELETIONS appear as additions. This scan reads ^+ lines, so a
# secret surfaced that way is one a peer had ALREADY REMOVED. The finding is
# wrong about the OWNER and about the TENSE. You then grep the tree, do not find
# it, and cannot tell "false alarm" from "someone hid it" — and you may have
# cost a peer a rotation they already performed.
#   RULE: a scan hit you cannot locate in the working tree means CHECK YOUR DOT
#   COUNT BEFORE YOU ESCALATE. The locate() helper below does this for you and
#   says so in the output, so the rule fires when you are looking at a hit
#   rather than sitting in a header nobody re-reads.
#
# SCOPE: secret-scan.sh in TREE mode has no direction and is immune. This
# applies to the DELTA scan below only.
#
# Usage:  sh scripts/push-preflight.sh [base-ref]     (default: origin/main)
# locate() is defined HERE, ABOVE its callers. It previously sat further down
# and the selftest below called it before definition — sh returns "command not
# found" and the discriminator silently does nothing. The selftest caught that
# on its first run (P3/P4 reported "the discriminator is dead"), which is the
# fail-CLOSED behaviour this file exists to have. Same defect class the S7
# header records: helpers defined after their callers.
# Is this token actually IN the working tree? A hit that is not tells you the
# scan direction is wrong far more often than it tells you a secret is hiding.
locate() {
  if git grep -qF -- "$1" -- . 2>/dev/null; then
    echo "       present in the working tree — treat as a REAL hit."
  else
    echo "       NOT PRESENT in the working tree."
    echo "       >> CHECK YOUR DOT COUNT BEFORE ESCALATING. A two-dot diff inverts"
    echo "          signs: this may be a PEER'S line that was ALREADY REMOVED,"
    echo "          surfaced as an addition in a delta that is not yours. Escalating"
    echo "          it can cost someone a rotation they have already done."
  fi
}


# ---- key-shape arms + checksum classifier (2026-09-20 WIF/nsec slice) ------
# Three shape arms, ACCOUNTING class (the 64-hex model below), never a block:
#   arm1  uncompressed Bitcoin WIF: 5 + [HJK] + 49 base58 chars = 51
#   arm2  compressed Bitcoin WIF: [KL] + 51 base58 chars        = 52
#   arm3  nostr secret, the estate's own format: literal nsec1 prefix +
#         bech32 (real shape is 58 chars after the prefix; the floor is 50 so
#         the near-shape fixtures already in this tree route through the
#         classifier instead of escaping the arm entirely)
# npub1, the PUBLIC identifier, can never match: arm3 anchors on the nsec1
# prefix and no other arm can start a match at an n.
# The arms are shape-only; keyshape() below separates real key material
# (base58check / bech32 checksum VALID) from the base64-asset noise class
# (checksum INVALID), which collapses to one count line instead of an
# accounting row per embedded asset. Measured on the tree at the slice base:
# 12 checksum-VALID public test vectors across 7 files stay committable as
# accounting rows; the one in-tree INVALID shape hit (a 173 KB SVG base64
# payload) and every synthetic nsec fixture land in the collapsed count.
WIF_RE='\b5[HJK][1-9A-HJ-NP-Za-km-z]{49}\b|\b[KL][1-9A-HJ-NP-Za-km-z]{51}\b|\bnsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{50,}'

# keyshape classify <string> -> "VALID <detail>" | INVALID | ERR
# keyshape mint <unc|cmp|nsec|npub> -> a checksum-minted fixture | ERR
# Fixtures mint from 32x 0x11, a documented non-secret constant: a VALID
# checksum is what makes a fixture exercise the whole gate, and minting at
# runtime keeps the literal out of this file so preflight never blocks its
# own commit. ERR (node unavailable or broken) degrades check 3 toward
# LISTING every shape hit instead of collapsing any.
keyshape() {
  KEYSHAPE_MODE=$1 KEYSHAPE_ARG=$2 node -e '
    const crypto = require("crypto");
    const sha256 = (b) => crypto.createHash("sha256").update(b).digest();
    const B58A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const BECH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    function b58decode(s) {
      let n = 0n;
      for (const ch of s) { const i = B58A.indexOf(ch); if (i < 0) return null; n = n * 58n + BigInt(i); }
      const out = [];
      while (n > 0n) { out.unshift(Number(n & 0xffn)); n >>= 8n; }
      for (const ch of s) { if (ch === "1") out.unshift(0); else break; }
      return Uint8Array.from(out);
    }
    function b58check(bytes) {
      const c = sha256(sha256(bytes)).subarray(0, 4);
      const full = Buffer.concat([Buffer.from(bytes), c]);
      let n = 0n; for (const b of full) n = (n << 8n) | BigInt(b);
      let s = "";
      while (n > 0n) { s = B58A[Number(n % 58n)] + s; n /= 58n; }
      for (const b of full) { if (b === 0) s = "1" + s; else break; }
      return s;
    }
    const GEN = [0x3b07a, 0x1b, 0x3d0e, 0x2b];
    function polymod(values) {
      let chk = 1;
      for (const value of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ value;
        for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
      }
      return chk >>> 0;
    }
    const hrpExpand = (hrp) => [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0]).concat([...hrp].map((c) => c.charCodeAt(0) & 31));
    function to5bit(bytes) {
      let acc = 0, bits = 0; const out = [];
      for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { out.push((acc >> (bits - 5)) & 31); bits -= 5; } }
      if (bits > 0) out.push((acc << (5 - bits)) & 31);
      return out;
    }
    function bech32Encode(hrp, data5) {
      const values = hrpExpand(hrp).concat(data5).concat([0, 0, 0, 0, 0, 0]);
      const mod = polymod(values) ^ 1;
      const cs = [];
      for (let i = 0; i < 6; i++) cs.push((mod >> (5 * (5 - i))) & 31);
      return hrp + "1" + data5.concat(cs).map((v) => BECH[v]).join("");
    }
    function bech32Verify(s) {
      const pos = s.lastIndexOf("1");
      if (pos < 1 || pos + 7 > s.length) return false;
      const hrp = s.slice(0, pos).toLowerCase();
      const idx = [...s.slice(pos + 1)].map((c) => BECH.indexOf(c));
      if (idx.some((v) => v < 0)) return false;
      return polymod(hrpExpand(hrp).concat(idx)) === 1;
    }
    const mode = process.env.KEYSHAPE_MODE || "";
    const arg = process.env.KEYSHAPE_ARG || "";
    if (mode === "mint") {
      const key = new Uint8Array(32).fill(0x11);
      if (arg === "unc") console.log(b58check(new Uint8Array([0x80, ...key])));
      else if (arg === "cmp") console.log(b58check(new Uint8Array([0x80, ...key, 0x01])));
      else if (arg === "nsec") console.log(bech32Encode("nsec", to5bit(key)));
      else if (arg === "npub") console.log(bech32Encode("npub", to5bit(key)));
      else { console.log("ERR"); process.exit(1); }
    } else if (mode === "classify") {
      if (/^nsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(arg)) {
        console.log(bech32Verify(arg) ? "VALID bech32(nsec)" : "INVALID");
      } else {
        const raw = b58decode(arg);
        const ok = raw && (raw.length === 37 || raw.length === 38) && raw[0] === 0x80 &&
          Buffer.compare(sha256(sha256(raw.subarray(0, raw.length - 4))).subarray(0, 4), raw.subarray(raw.length - 4)) === 0;
        console.log(ok ? "VALID ver=0x80 paylen=" + (raw.length - 4) : "INVALID");
      }
    } else { console.log("ERR"); process.exit(1); }
  ' 2>/dev/null || echo ERR
}

# zpad n -> n z chars (selftest fixture assembly; runtime-built so no literal
# in this file is ever key-shaped)
zrep() { _n=$1; _s=; _i=0; while [ "$_i" -lt "$_n" ]; do _s="z$_s"; _i=$((_i+1)); done; printf '%s' "$_s"; }


# ---- SELFTEST ------------------------------------------------------------
# LAW (founder, 2026-08-25): a checker is not LANDED until it has been run
# against a KNOWN-BAD and a KNOWN-GOOD, and BOTH results appear in its report.
# A green from an unvalidated checker is a claim about the checker, not the code.
#
#   P1 known-BAD   unresolvable base ref  -> MUST exit 1 ("unknown", not "clean")
#   P2 known-GOOD  empty subject          -> MUST exit 0, run ZERO checks, claim nothing
#   P3 known-BAD   token absent from tree -> locate() MUST raise the dot-count warning
#   P4 known-GOOD  token present in tree  -> locate() MUST call it a real hit
if [ "${1:-}" = "--selftest" ]; then
  SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
  st=0
  echo "push-preflight selftest — known-BAD and known-GOOD:"
  sh "$SELF" refs/heads/__no_such_ref__ >/tmp/ps1 2>&1; r=$?
  if [ "$r" -ne 0 ] && grep -q "does not resolve" /tmp/ps1; then
    echo "  P1 known-BAD  unresolvable base -> exit $r, refused (correct)"
  else echo "  P1 known-BAD  unresolvable base -> exit $r WITHOUT refusing — fails OPEN"; st=1; fi
  sh "$SELF" HEAD >/tmp/ps2 2>&1; r=$?
  n=$(grep -c '^[1-7])' /tmp/ps2)
  if [ "$r" -eq 0 ] && [ "$n" -eq 0 ] && grep -q 'NOT SCANNING' /tmp/ps2; then
    echo "  P2 known-GOOD empty subject -> halted, $n checks ran, claims nothing (correct)"
  else echo "  P2 known-GOOD empty subject -> exit $r with $n checks run — scanned an unconfirmed subject"; st=1; fi
  # Built at RUNTIME from $$ so the literal never appears in this source —
  # a hardcoded "absent" token is present the moment you write the test, and
  # git grep finds it here. The fixture defeated itself on first run.
  ABSENT="PVT_K1_selftestAbsent$$"
  o=$(locate "$ABSENT")
  case "$o" in *"CHECK YOUR DOT COUNT"*) echo "  P3 known-BAD  absent token -> dot-count warning raised (correct)";;
                *) echo "  P3 known-BAD  absent token -> NO warning — the discriminator is dead"; st=1;; esac
  o=$(locate "PREFLIGHT ok")
  case "$o" in *"REAL hit"*) echo "  P4 known-GOOD present token -> called a real hit (correct)";;
                *) echo "  P4 known-GOOD present token -> misreported"; st=1;; esac
  # P5-P10 - key-shape arms + checksum classifier (2026-09-20). Every BAD
  # fixture is MINTED at runtime (checksum-VALID from 32x 0x11): a shape-only
  # fixture would pass the arms and die in the classifier, leaving a selftest
  # that is green while the gate is blind - the vacuity trap named before this
  # was written. If every mint answers ERR, node is unavailable and the
  # classifier layer of check 3 cannot be trusted: that fails this selftest
  # loudly rather than passing vacuously.
  M_UNC=$(keyshape mint unc); M_CMP=$(keyshape mint cmp)
  M_NSEC=$(keyshape mint nsec); M_NPUB=$(keyshape mint npub)
  shapehit() { printf '%s\n' "$1" | grep -cE "$WIF_RE" || true; }
  kcls() { keyshape classify "$1"; }
  if [ "$M_UNC" != ERR ] && [ "$(shapehit "$M_UNC")" -eq 1 ] && [ "$(kcls "$M_UNC")" = "VALID ver=0x80 paylen=33" ]; then
    echo "  P5 known-BAD  minted uncompressed WIF -> arm1 hit, checksum VALID (correct)"
  else echo "  P5 known-BAD  minted uncompressed WIF -> MISSED: arm1 or classifier dead ($(kcls "$M_UNC"))"; st=1; fi
  if [ "$M_CMP" != ERR ] && [ "$(shapehit "$M_CMP")" -eq 1 ] && [ "$(kcls "$M_CMP")" = "VALID ver=0x80 paylen=34" ]; then
    echo "  P6 known-BAD  minted compressed WIF -> arm2 hit, checksum VALID (correct)"
  else echo "  P6 known-BAD  minted compressed WIF -> MISSED: arm2 or classifier dead ($(kcls "$M_CMP"))"; st=1; fi
  if [ "$M_NSEC" != ERR ] && [ "$(shapehit "$M_NSEC")" -eq 1 ] && [ "$(kcls "$M_NSEC")" = "VALID bech32(nsec)" ]; then
    echo "  P7 known-BAD  minted nsec1 -> arm3 hit, bech32 checksum VALID (correct)"
  else echo "  P7 known-BAD  minted nsec1 -> MISSED: arm3 or classifier dead ($(kcls "$M_NSEC"))"; st=1; fi
  if [ "$M_NPUB" != ERR ] && [ "$(shapehit "$M_NPUB")" -eq 0 ]; then
    echo "  P8 known-GOOD minted npub1 (public id, checksum VALID) -> no arm hits it (correct)"
  else echo "  P8 known-GOOD npub1 flagged - the public identifier must never be blocked"; st=1; fi
  NOISE="K$(zrep 51)"
  if [ "$(shapehit "$NOISE")" -eq 1 ] && [ "$(kcls "$NOISE")" = INVALID ]; then
    echo "  P9 known-GOOD shape-only run (the SVG/base64 noise class) -> arm2 hit, checksum INVALID -> collapsed (correct)"
  else echo "  P9 shape-only noise misread ($(kcls "$NOISE")) - the noise collapse is broken"; st=1; fi
  _last=$(printf '%s' "$M_UNC" | tail -c 1)
  if [ "$_last" = z ]; then _repl=K; else _repl=z; fi
  FLIP="$(printf '%s' "$M_UNC" | cut -c1-50)$_repl"
  if [ "$(kcls "$M_UNC")" != ERR ] && [ "$(kcls "$FLIP")" = INVALID ]; then
    echo "  P10 classifier non-vacuity: minted reads VALID, one char flipped reads INVALID (correct)"
  else echo "  P10 classifier vacuous - cannot tell a key from a flipped key"; st=1; fi
  rm -f /tmp/ps1 /tmp/ps2
  [ "$st" -eq 0 ] && echo "selftest ok — refuses what it must, permits what it must."                    || echo "selftest FAIL — see above."
  exit $st
fi

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1
BASE_REF=${1:-origin/main}

if ! git rev-parse --verify -q "$BASE_REF" >/dev/null; then
  echo "PREFLIGHT FAIL — base ref '$BASE_REF' does not resolve. Cannot compute a"
  echo "  delta, so this is 'unknown', not 'clean'. Fetch first."
  exit 1
fi
BASE=$(git merge-base "$BASE_REF" HEAD) || { echo "PREFLIGHT FAIL — no merge-base"; exit 1; }

N=$(git rev-list --count "$BASE"..HEAD)
FILES=$(git diff --name-only "$BASE_REF"...HEAD | grep -c . || true)
echo "PREFLIGHT  base=$BASE_REF ($(git rev-parse --short "$BASE"))  commits=$N  files=$FILES"

# ── SUBJECT ASSERTION — run BEFORE any scanning ─────────────────────
# A scan whose subject you have not confirmed is not a scan of your work.
# With an EMPTY delta the reverse diff shows MAIN'S new content from other
# seats as though it were yours — zC nearly filed a peer's commits as a
# finding on its own lane that way. Direction is base..HEAD, never HEAD..base.
echo ""
echo "SUBJECT — these are the commits about to be scanned ($BASE_REF..HEAD):"
if [ "$N" -eq 0 ]; then
  echo "  (none)"
  echo ""
  echo "DELTA EMPTY — NOT SCANNING. There is nothing of yours to preserve here."
  echo "  Reporting 'clean' now would mean reporting on a scan that never ran."
  echo "  Push the ref if you like; do not claim a check."
  exit 0
fi
git log --format='  %h  %cn  %s' "$BASE"..HEAD | cut -c1-100
# Committers present, listed rather than classified. Do NOT auto-guess the
# seat label: falling back to git config user.name marks your OWN commits
# foreign, which is a false signal inside the check that exists to prevent
# false findings. Export GIT_COMMITTER_NAME (or SEAT=) to get the comparison.
echo "  committers in range: $(git log --format='%cn' "$BASE"..HEAD | sort -u | tr '
' ' ')"
SEAT=${SEAT:-${GIT_COMMITTER_NAME:-}}
if [ -z "$SEAT" ]; then
  echo "    (seat label unset — not classifying. READ the list above: merge"
  echo "     commits from main are expected, peer LANE commits mean a wrong base.)"
else
  FOREIGN=$(git log --format='%cn' "$BASE"..HEAD | grep -vxF "$SEAT" | sort -u | tr '
' ' ')
  [ -n "$FOREIGN" ] && echo "    not committed by '$SEAT': $FOREIGN  (merges from main are expected)"
fi
echo "  direction: $BASE_REF..HEAD (base -> lane). Never lane -> base."

# This file necessarily CONTAINS the patterns it hunts (PVT_K1_, the PEM form,
# the word "secret"). Excluded from the ADDED-lines checks BY NAME — check 1
# still scans it as part of the whole tree, so coverage is not lost.
SELF=scripts/push-preflight.sh
ADDED=$(git diff "$BASE_REF"...HEAD -- . ":(exclude)$SELF" | grep '^+' | grep -v '^+++')
rc=0

echo ""
echo "1) secret scan over the tree"
if sh scripts/secret-scan.sh tree >/tmp/pf_1 2>&1; then
  echo "   ok"
else
  echo "   BLOCKED:"; sed 's/^/     /' /tmp/pf_1; rc=1
fi

# PEM pattern uses the estate bracket trick (see scripts/secret-scan.sh:55):
# KE[Y] so this detector never matches its own source. The base58 arm that
# lived here ({48}) was measured dead on every real WIF shape - 0 hits on the
# 51-char uncompressed and 52-char compressed forms both - and is REPLACED by
# the three live arms of check 3: a 50-char match it could block is not a key,
# and a real 51-char WIF escaped it.
echo "2) private-key material on added lines"
printf '%s\n' "$ADDED" | grep -nE 'PVT_K1_|xprv|BEGIN .*PRIVATE KE[Y]' >/tmp/pf_2
n=$(grep -c . /tmp/pf_2 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 matches"; else
  echo "   BLOCKED — $n match(es):"; head -5 /tmp/pf_2 | sed 's/^/     /'
  printf '%s
' "$ADDED" | grep -oE 'PVT_K1_[A-Za-z0-9]+|xprv[A-Za-z0-9]+' | sort -u | while read -r t; do
    printf '     token %s…
' "$(printf '%s' "$t" | cut -c1-24)"; locate "$t"; done
  rc=1; fi

echo "3) key-shaped strings on added lines (shape arms + checksum class)"
if ! printf '%s\n' "$ADDED" | grep -qE "$WIF_RE"; then
  echo "   ok - 0 present"
else
  wif_rows=""; wif_noise=0; wif_err=0
  while IFS= read -r t; do
    [ -n "$t" ] || continue
    cls=$(keyshape classify "$t")
    case "$cls" in
      VALID*) wif_rows="$wif_rows$t|$cls
" ;;
      INVALID) wif_noise=$((wif_noise+1)) ;;
      *) wif_err=$((wif_err+1)); wif_rows="$wif_rows$t|(CLASSIFIER UNAVAILABLE - treat as key-shaped until accounted)
" ;;
    esac
  done <<EOF
$(printf '%s\n' "$ADDED" | grep -oE "$WIF_RE" | sort -u)
EOF
  n=$(printf '%s' "$wif_rows" | grep -c . || true)
  if [ "$n" -eq 0 ]; then
    echo "   ok - 0 checksum-valid present ($wif_noise checksum-invalid shape run(s) collapsed)"
  else
    echo "   $n distinct checksum-VALID - ACCOUNT FOR EACH (a public test vector and a leaked key look identical):"
    printf '%s' "$wif_rows" | while IFS='|' read -r t d; do
      [ -n "$t" ] || continue
      printf '     %.16s...  %s\n' "$t" "$d"
      printf '       %s\n' "$(printf '%s\n' "$ADDED" | grep -F "$t" | head -1 | cut -c1-76)"
    done
    if [ "$wif_noise" -gt 0 ]; then echo "   ($wif_noise checksum-INVALID shape run(s) - base64/asset noise class - collapsed, not listed)"; fi
    if [ "$wif_err" -gt 0 ]; then echo "   !! checksum classifier FAILED on $wif_err hit(s) - node runtime broken? every shape hit is listed above"; fi
  fi
fi

echo "4) 64-hex strings on added lines (each must be accounted for)"
printf '%s\n' "$ADDED" | grep -oE '[0-9a-fA-F]{64}' | sort -u >/tmp/pf_4
n=$(grep -c . /tmp/pf_4 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 present"
else
  echo "   $n distinct — ACCOUNT FOR EACH (a Cargo.lock checksum and a leaked key look identical):"
  while read -r h; do
    printf '     %s…  %s\n' "$(printf '%s' "$h" | cut -c1-16)" \
      "$(printf '%s\n' "$ADDED" | grep -F "$h" | head -1 | cut -c1-80)"
  done < /tmp/pf_4
fi

echo "5) credential words on added lines"
printf '%s\n' "$ADDED" | grep -inE 'password|passphrase|secret|api[_-]?key|token|credential' >/tmp/pf_5
n=$(grep -c . /tmp/pf_5 || true)
if [ "$n" -eq 0 ]; then echo "   ok — 0 hits"
else echo "   $n hit(s) — confirm each is PROSE, not a value:"; head -6 /tmp/pf_5 | cut -c1-100 | sed 's/^/     /'; fi

echo "6) credential-shaped files in the delta"
git diff --name-only "$BASE_REF"...HEAD | grep -iE 'DO_NOT_COMMIT|(^|/)\.env|credential|\.pem$|\.key$' >/tmp/pf_6
n=$(grep -c . /tmp/pf_6 || true)
if [ "$n" -eq 0 ]; then echo "   ok — none"; else echo "   BLOCKED:"; sed 's/^/     /' /tmp/pf_6; rc=1; fi

echo "7) @-handles on added lines (public or fictional only)"
printf '%s\n' "$ADDED" | grep -oE '@[A-Za-z][A-Za-z0-9_.-]{2,}' | sort -u >/tmp/pf_7
n=$(grep -c . /tmp/pf_7 || true)
if [ "$n" -eq 0 ]; then echo "   ok — none"; else echo "   $n distinct:"; head -8 /tmp/pf_7 | tr '\n' ' ' | sed 's/^/     /'; echo ""; fi

echo ""
if [ "$rc" -ne 0 ]; then echo "PREFLIGHT BLOCKED — do not push."; else
  echo "PREFLIGHT ok — checks 3, 4, 5 and 7 are JUDGEMENT items: read them, do not"
  echo "  just note they printed. Then: git push origin HEAD:<your lane>"
fi
exit $rc
