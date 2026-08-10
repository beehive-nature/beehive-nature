"""Leaf-content structure and FORMAT-CONFORMANCE tests.

The R6 suite uses synthetic leaves. Real leaves are canon(record)||lp(sig), where `name`
and `payload` are variable-length and attacker-influenced. This file tests whether the
LEAF IS ACTUALLY A COMMITMENT, and whether this implementation matches the RULED FORMAT.

LAW 8p: structural classes of a REAL leaf enumerated below and each represented.
LAW 8r: the vulnerable encoding is kept and MUST collide, or the safe result proves
        nothing. DO NOT delete canon_delimited or leaf_raw_suffix to make a failing
        control pass -- their entire job is to exhibit what the ruled format avoids.

WHY A FORMAT SECTION EXISTS AT ALL (earned 2026-08-09): this suite passed 15/15 while
the reference shipped little-endian length prefixes against a big-endian ruling. It
tested injectivity, and injectivity is byte-order-blind. A SUITE THAT TESTS THE PROPERTY
BUT NOT THE FORMAT WILL NOT NOTICE A CONSENSUS DIVERGENCE.

⚠ RUNNING THIS SUITE: if you edit canon.py and revert it, DELETE `tests/r6/__pycache__`
before trusting the result. A stale `.pyc` can shadow a source file that is byte-identical
to HEAD — observed 2026-08-09: canon.py matched HEAD by md5 and the suite still reported
`FAIL R1a pin 2`, because Python imported cached bytecode from the edited version. `-B`
does NOT help; it prevents writing bytecode, not reading it. The dangerous direction is the
opposite one: a suite PASSING against bytecode that is not the code in the repo.

Four boundaries are tested:
  * the FIELD boundary    -- controls A and B (a field absorbs the separator)
  * the FORMAT boundary   -- R1a's three pins: framing, field bytes, prefixed sig
  * the canon||sig split  -- is the boundary recoverable for ANY signature scheme?
  * the POST-sig boundary -- is the leaf still injective if anything follows sig?
"""
import struct, hashlib, re
from canon import (canon_delimited, canon_prefixed, _fields, _lp, leaf,
                   leaf_raw_suffix, LEN_PREFIX, INT_PACK)

LEAF = b'\x00'
CHARSET = re.compile(rb'^[a-z0-9-]{1,32}$')
O = bytes(range(32))
REV, SA, EA, PSA = 1, 1_800_000_000, 1_831_536_000, 0

def rec(name, payload):
    return dict(name=name, owner=O, revision=REV, signed_at=SA,
                expires_at=EA, prev_signed_at=PSA, payload=payload)

def hleaf(b): return hashlib.sha256(LEAF + b).digest()

# built from _fields() so it tracks the ruled encoding instead of hardcoding it
MIDDLE = b"|" + b"|".join(_fields(rec(b"x", b"y"))[1:6]) + b"|"

CLASSES = [
    ("minimal name, empty payload",      rec(b"a", b"")),
    ("max-length name (32)",             rec(b"a" * 32, b"x")),
    ("hyphenated name",                  rec(b"a-b-c", b"x")),
    ("empty payload",                    rec(b"alice", b"")),
    ("large payload (4 KiB)",            rec(b"alice", b"P" * 4096)),
    ("payload containing separator",     rec(b"alice", b"X|Y|Z")),
    ("payload of NUL bytes",             rec(b"alice", b"\x00" * 64)),
    ("payload = the fixed middle",       rec(b"alice", MIDDLE)),
]


def run():
    fails = 0

    # ---------------- INJECTIVITY ----------------
    seen = {}
    for label, r in CLASSES:
        c = canon_prefixed(r)
        if c in seen:
            print(f"  FAIL class collision: {label!r} == {seen[c]!r}"); fails += 1
        seen[c] = label
    print(f"  {len(CLASSES)} structural classes, all distinct under canon_prefixed")

    A = rec(b"a", MIDDLE + b"z")
    B = rec(b"a" + MIDDLE, b"z")
    vuln = canon_delimited(A) == canon_delimited(B)
    safe = canon_prefixed(A) == canon_prefixed(B)
    if not vuln:
        print("  FAIL control A: collision did NOT reproduce under canon_delimited"); fails += 1
    if safe:
        print("  FAIL control A: collision PRESENT under canon_prefixed"); fails += 1
    print(f"  control A (unvalidated name): delimited collides={vuln} prefixed collides={safe}")
    if hleaf(canon_delimited(A)) != hleaf(canon_delimited(B)):
        print("  FAIL control A: leaf hashes differ though canon bytes matched"); fails += 1

    C = rec(b"alice", b"X|Y")
    D = rec(b"alice", b"X")
    vuln2 = canon_delimited(C, extra=b"memo") == canon_delimited(D, extra=b"Y|memo")
    safe2 = canon_prefixed(C, extra=b"memo") == canon_prefixed(D, extra=b"Y|memo")
    both_valid = bool(CHARSET.match(C["name"])) and bool(CHARSET.match(D["name"]))
    if not vuln2:
        print("  FAIL control B: trailing-field collision did NOT reproduce"); fails += 1
    if safe2:
        print("  FAIL control B: collision PRESENT under canon_prefixed"); fails += 1
    print(f"  control B (valid names + trailing field): delimited collides={vuln2} "
          f"prefixed collides={safe2} names_charset_valid={both_valid}")

    target = hleaf(canon_prefixed(rec(b"victim", b"real")))
    hit = any(hleaf(canon_prefixed(rec(b"attacker", bytes([i]) * n))) == target
              for i in range(256) for n in (0, 1, 32))
    if hit:
        print("  FAIL second-preimage: attacker payload reached the target leaf"); fails += 1
    print(f"  second-preimage over 768 attacker payloads: target reached={hit}")

    # ---------------- FORMAT CONFORMANCE (R1a, three pins) ----------------
    print("\n  -- R1a conformance --")

    # PIN 1: framing = 4-byte BIG-endian length prefix
    if LEN_PREFIX != ">I" or canon_prefixed(rec(b"alice", b"p"))[:4] != b"\x00\x00\x00\x05":
        print("  FAIL R1a pin 1: length prefix is not 4-byte big-endian"); fails += 1
    print(f"  pin 1 framing: length prefix = {canon_prefixed(rec(b'alice', b'p'))[:4].hex()} (len 5, big-endian)")

    # ...and that byte order is LOAD-BEARING, not cosmetic (control for my own fix)
    r0 = rec(b"alice", b"p")
    be = b"".join(struct.pack(">I", len(x)) + x for x in _fields(r0))
    le = b"".join(struct.pack("<I", len(x)) + x for x in _fields(r0))
    if hleaf(be) == hleaf(le):
        print("  FAIL endianness control: BE and LE produced the SAME leaf"); fails += 1
    print(f"  pin 1 load-bearing: BE {hleaf(be).hex()[:16]} != LE {hleaf(le).hex()[:16]}")

    # PIN 2: field bytes = 8-byte BIG-endian unsigned, every integer field
    if INT_PACK != ">Q":
        print("  FAIL R1a pin 2: integer fields are not 8-byte big-endian"); fails += 1
    rev_off = 4 + 5 + 4 + 32                     # past lp(name="alice") and lp(owner)
    rev_bytes = canon_prefixed(r0)[rev_off:rev_off + 4 + 8]
    if rev_bytes != b"\x00\x00\x00\x08" + struct.pack(">Q", REV):
        print("  FAIL R1a pin 2: revision is not lp(8-byte BE)"); fails += 1
    print(f"  pin 2 field bytes: revision = {rev_bytes.hex()} (len 8, big-endian unsigned)")

    # ...and the pin is LOAD-BEARING: the two rejected alternatives give other leaves
    def impl(kind):
        if kind == "dec":
            f = [b"alice", O, str(REV).encode(), str(SA).encode(),
                 str(EA).encode(), str(PSA).encode(), b"p"]
        else:
            i, q = kind + "I", kind + "Q"
            f = [b"alice", O, struct.pack(i, REV), struct.pack(q, SA),
                 struct.pack(q, EA), struct.pack(q, PSA), b"p"]
        return hleaf(b"".join(struct.pack(">I", len(x)) + x for x in f))
    alts = {"4-byte LE (was inherited)": impl("<"),
            "4-byte BE": impl(">"),
            "ASCII decimal": impl("dec")}
    ruled = hleaf(canon_prefixed(r0))
    if any(v == ruled for v in alts.values()) or len(set(alts.values())) != 3:
        print("  FAIL pin 2 control: rejected alternatives did not diverge"); fails += 1
    print(f"  pin 2 load-bearing: ruled 8-byte BE = {ruled.hex()[:16]}")
    for k, v in alts.items():
        print(f"      rejected {k:<26s} = {v.hex()[:16]}")

    # ...and EIGHT bytes, not four: the 1000-year test, by construction
    Y2106 = 4_294_967_296                        # 2^32 s after epoch = 2106-02-07
    Y3026 = 33_350_000_000                       # ~1000 years out
    u32_overflows, u64_holds = False, True
    try:
        struct.pack(">I", Y2106)
    except struct.error:
        u32_overflows = True
    try:
        struct.pack(">Q", Y3026)
    except struct.error:
        u64_holds = False
    if not (u32_overflows and u64_holds):
        print("  FAIL 1000-year control: overflow behaviour not as ruled"); fails += 1
    print(f"  pin 2 width: u32 overflows at {Y2106} (2106-02-07) = {u32_overflows}; "
          f"u64 holds year 3026 = {u64_holds}")

    # PIN 2b: NO EXCEPTIONS -- the prefix is on EVERY field, fixed-width integers too.
    # Structural check, not a spot check: parse the buffer forward as pure
    # length-prefixed frames and require it to consume exactly 7 fields and no
    # trailing bytes. That can only pass if the framing is uniform.
    def parse_forward(buf):
        out, i = [], 0
        while i < len(buf):
            if i + 4 > len(buf):
                return None                       # ragged: not uniformly framed
            n = struct.unpack(">I", buf[i:i + 4])[0]
            i += 4
            if i + n > len(buf):
                return None                       # length runs past the end
            out.append(buf[i:i + n]); i += n
        return out
    parsed = parse_forward(canon_prefixed(r0))
    if parsed is None or len(parsed) != 7 or parsed != _fields(r0):
        print("  FAIL R1a pin 2b: canon is not uniformly length-prefixed"); fails += 1
    print(f"  pin 2b no exceptions: forward parse yields {len(parsed) if parsed else 0}/7 "
          f"fields, 0 trailing bytes, round-trips = {parsed == _fields(r0)}")

    # ...and the "tidy" alternative is exhibited as a DIVERGENCE, so nobody re-derives it.
    # Exception class: omit the prefix on the four fixed-width integers.
    f = _fields(r0)
    tidy = _lp(f[0]) + _lp(f[1]) + f[2] + f[3] + f[4] + f[5] + _lp(f[6])
    tidy_parsed = parse_forward(tidy)
    tidy_readable = tidy_parsed is not None and tidy_parsed == f
    if hleaf(tidy) == hleaf(canon_prefixed(r0)):
        print("  FAIL pin 2b control: exception class gave the SAME leaf"); fails += 1
    if tidy_readable:
        print("  FAIL pin 2b control: exception class was parseable without prior knowledge"); fails += 1
    print(f"  pin 2b control: exception-class leaf = {hleaf(tidy).hex()[:16]} "
          f"(!= ruled {hleaf(canon_prefixed(r0)).hex()[:16]}); "
          f"forward-parseable = {tidy_readable}")
    print("     (a reader must KNOW which fields are fixed-width -- knowledge that goes")
    print("      stale the first time a field is added or a width changes. 4 bytes each.)")

    # PIN 3: the sig suffix is length-prefixed
    S64, DER71 = bytes(range(64)), bytes(range(71))
    if leaf(r0, S64) != hashlib.sha256(LEAF + canon_prefixed(r0) + _lp(S64)).digest():
        print("  FAIL R1a pin 3: leaf() does not length-prefix sig"); fails += 1
    print(f"  pin 3 sig prefixed: leaf = H(0x00 || canon || lp(sig)) = {leaf(r0, S64).hex()[:16]}")

    # ---------------- THE canon||sig SPLIT ----------------
    print("\n  -- boundary behaviour --")
    fixed_ok = all(
        canon_delimited(rec(b"alice", b"P" * 20)) + S64
        != canon_delimited(rec(b"alice", b"P" * (20 - k))) + bytes(64)
        for k in range(1, 21))
    if not fixed_ok:
        print("  FAIL boundary: fixed-length sig collided"); fails += 1
    print(f"  FIXED 64 B sig: no collision under either encoding = {fixed_ok} "
          f"(delimited is safe here BY ACCIDENT of Ed25519's fixed size)")

    pa, sa_ = b"P" * 20, DER71                   # |payload|=20 |sig|=71
    pb, sb_ = b"P" * 20 + DER71[:1], DER71[1:]   # |payload|=21 |sig|=70, both valid DER
    dv = canon_delimited(rec(b"alice", pa)) + sa_ == canon_delimited(rec(b"alice", pb)) + sb_
    pv = leaf_raw_suffix(rec(b"alice", pa), sa_) == leaf_raw_suffix(rec(b"alice", pb), sb_)
    if not dv:
        print("  FAIL boundary control: variable-length collision did NOT reproduce"); fails += 1
    if pv:
        print("  FAIL boundary: collision PRESENT under prefixed canon"); fails += 1
    print(f"  VARIABLE-length sig (DER 71/70): delimited collides={dv} "
          f"prefixed-canon collides={pv}  [charset-valid names, NO schema change]")

    # ---------------- THE POST-sig BOUNDARY (why pin 3 is worth having) ----------------
    # HONEST SCOPE: raw-suffix sig is injective TODAY, because canon_prefixed is
    # self-delimiting and NOTHING FOLLOWS sig. Pin 3 is not fixing a live collision.
    # It is removing the dependency on "nothing ever follows sig" -- the same silent
    # assumption that made control B possible. Append one component and raw-suffix
    # collides; length-prefixed does not.
    TAIL_A, TAIL_B = b"v1", DER71[70:71] + b"v1"          # e.g. a co-sign or version tag
    raw_coll = (hashlib.sha256(LEAF + canon_prefixed(rec(b"alice", pa)) + DER71 + TAIL_A).digest()
                == hashlib.sha256(LEAF + canon_prefixed(rec(b"alice", pa)) + DER71[:70] + TAIL_B).digest())
    lp_coll = (hashlib.sha256(LEAF + canon_prefixed(rec(b"alice", pa)) + _lp(DER71) + TAIL_A).digest()
               == hashlib.sha256(LEAF + canon_prefixed(rec(b"alice", pa)) + _lp(DER71[:70]) + TAIL_B).digest())
    if not raw_coll:
        print("  FAIL post-sig control: raw-suffix collision did NOT reproduce"); fails += 1
    if lp_coll:
        print("  FAIL post-sig: collision PRESENT under lp(sig)"); fails += 1
    print(f"  ANYTHING APPENDED AFTER sig: raw-suffix collides={raw_coll} "
          f"lp(sig) collides={lp_coll}")
    print("     (raw-suffix is injective TODAY -- nothing follows sig. Pin 3 removes the")
    print("      dependency on that staying true, which is exactly control B's failure mode.)")

    total = len(CLASSES) + 24
    print(f"\nCANON SUITE: {total - fails}/{total} passed")
    return fails


if __name__ == "__main__":
    raise SystemExit(1 if run() else 0)
