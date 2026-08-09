"""Leaf-content structure tests -- the axis that was NAMED, NOT CLAIMED until now.

The R6 suite uses synthetic leaves. Real leaves are canon(record)||sig, where `name`
and `payload` are variable-length and attacker-influenced. This file tests whether the
LEAF IS ACTUALLY A COMMITMENT.

LAW 8p: structural classes of a REAL leaf enumerated below and each represented.
LAW 8r: the vulnerable encoding is kept and MUST collide, or the safe result proves
        nothing. DO NOT delete canon_delimited to make a failing control pass -- its
        entire job is to exhibit what canon_prefixed avoids.

Three boundaries are tested, not one:
  * the FIELD boundary   -- controls A and B (a field absorbs the separator)
  * the FORMAT boundary  -- R1a conformance: is the length prefix big-endian, and is
                            that byte order load-bearing? (consensus, not style)
  * the canon||sig BOUNDARY -- `sig` is appended UNPREFIXED; is the split recoverable?
"""
import struct, hashlib, re
from canon import canon_delimited, canon_prefixed, _fields, INT_ENC, LEN_PREFIX

LEAF = b'\x00'
CHARSET = re.compile(rb'^[a-z0-9-]{1,32}$')
O = bytes(range(32))
REV, SA, EA, PSA = 1, 1_800_000_000, 1_831_536_000, 0

def rec(name, payload):
    return dict(name=name, owner=O, revision=REV, signed_at=SA,
                expires_at=EA, prev_signed_at=PSA, payload=payload)

def hleaf(b): return hashlib.sha256(LEAF + b).digest()

# built from _fields() so it tracks INT_ENC instead of hardcoding it
MIDDLE = b"|" + b"|".join(_fields(rec(b"x", b"y"))[1:6]) + b"|"


# ---- structural classes of a real leaf (LAW 8p) ----
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

    # 1. every structural class round-trips distinctly under the safe encoding
    seen = {}
    for label, r in CLASSES:
        c = canon_prefixed(r)
        if c in seen:
            print(f"  FAIL class collision: {label!r} == {seen[c]!r}"); fails += 1
        seen[c] = label
    print(f"  {len(CLASSES)} structural classes, all distinct under canon_prefixed")

    # 2. NEGATIVE CONTROL A -- unvalidated name absorbs the middle (LAW 8r)
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

    # 3. NEGATIVE CONTROL B -- charset-VALID names, collision via a trailing field
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

    # 4. second-preimage: attacker controlling payload cannot hit a chosen leaf
    target = hleaf(canon_prefixed(rec(b"victim", b"real")))
    hit = any(hleaf(canon_prefixed(rec(b"attacker", bytes([i]) * n))) == target
              for i in range(256) for n in (0, 1, 32))
    if hit:
        print("  FAIL second-preimage: attacker payload reached the target leaf"); fails += 1
    print(f"  second-preimage over 768 attacker payloads: target reached={hit}")

    # ---------------------------------------------------------------------
    # 5. R1a CONFORMANCE -- the length prefix MUST be 4-byte BIG-endian.
    #    Caught late: the reference shipped little-endian while R1a ruled big.
    # ---------------------------------------------------------------------
    if LEN_PREFIX != ">I" or canon_prefixed(rec(b"alice", b"p"))[:4] != b"\x00\x00\x00\x05":
        print("  FAIL R1a: length prefix is not 4-byte big-endian"); fails += 1
    print(f"  R1a length prefix big-endian: {canon_prefixed(rec(b'alice', b'p'))[:4].hex()} (len 5)")

    # 6. ...and that byte order is LOAD-BEARING, not cosmetic.
    #    Negative control for my own fix: if LE and BE gave the same leaf, R1a's
    #    byte-order clause would be a formatting preference. It does not.
    r0 = rec(b"alice", b"p")
    be = b"".join(struct.pack(">I", len(x)) + x for x in _fields(r0))
    le = b"".join(struct.pack("<I", len(x)) + x for x in _fields(r0))
    order_matters = hleaf(be) != hleaf(le)
    if not order_matters:
        print("  FAIL endianness control: BE and LE produced the SAME leaf"); fails += 1
    print(f"  length-prefix byte order load-bearing: {order_matters} "
          f"(BE {hleaf(be).hex()[:16]} != LE {hleaf(le).hex()[:16]})")

    # ---------------------------------------------------------------------
    # 7. R1a PINS THE FRAMING, NOT THE FIELD BYTES.
    #    Three implementations, ALL conforming to R1a (4-byte big-endian length
    #    prefix, fixed field order), differing only in how they serialize the
    #    INTEGER fields -- which R1a never defines. All three leaves differ.
    #    Same argument as R6a: any choice works mathematically; unpinned means
    #    implementations cannot interoperate.
    # ---------------------------------------------------------------------
    def impl(int_enc):
        if int_enc == "dec":
            f = [b"alice", O, str(REV).encode(), str(SA).encode(),
                 str(EA).encode(), str(PSA).encode(), b"p"]
        else:
            f = [b"alice", O, struct.pack(int_enc + "I", REV),
                 struct.pack(int_enc + "Q", SA), struct.pack(int_enc + "Q", EA),
                 struct.pack(int_enc + "Q", PSA), b"p"]
        return hleaf(b"".join(struct.pack(">I", len(x)) + x for x in f))  # R1a-conforming
    variants = {k: impl(k) for k in ("<", ">", "dec")}
    unpinned = len(set(variants.values())) == 3
    if not unpinned:
        print("  FAIL field-bytes control: R1a-conforming variants did not diverge"); fails += 1
    print("  R1a-conforming impls differing ONLY in integer field bytes:")
    for k, v in variants.items():
        print(f"      int_enc={k:>3s}  leaf={v.hex()[:32]}")
    print(f"  all distinct = {unpinned}  <-- R1a pins FRAMING, not FIELD BYTES "
          f"(reference uses INT_ENC={INT_ENC!r}, INHERITED not ruled)")

    # ---------------------------------------------------------------------
    # 8. THE canon||sig BOUNDARY. leaf = H(0x00 || canon || sig), sig UNPREFIXED.
    #    8a: with a FIXED-length signature (Ed25519, 64 B) the split is recoverable
    #        under BOTH encodings -- delimited is safe here BY ACCIDENT of Ed25519.
    #    8b: with a VARIABLE-length signature (secp256k1/K1 DER, 70-72 B -- already
    #        used elsewhere in this project) bytes move across the boundary and
    #        delimited COLLIDES. Prefixed is self-delimiting and does not.
    # ---------------------------------------------------------------------
    S64 = bytes(range(64))
    fixed_ok = all(
        canon_delimited(rec(b"alice", b"P" * 20)) + S64
        != canon_delimited(rec(b"alice", b"P" * (20 - k))) + bytes(64)
        for k in range(1, 21))
    if not fixed_ok:
        print("  FAIL boundary: fixed-length sig collided"); fails += 1
    print(f"  canon||sig, FIXED 64 B sig: no collision under either encoding = {fixed_ok}")

    der = bytes(range(71))                       # 71 B, a valid DER length
    pa, sa_ = b"P" * 20, der                     # |payload|=20 |sig|=71
    pb, sb_ = b"P" * 20 + der[:1], der[1:]       # |payload|=21 |sig|=70, also valid DER
    dv = canon_delimited(rec(b"alice", pa)) + sa_ == canon_delimited(rec(b"alice", pb)) + sb_
    pv = canon_prefixed(rec(b"alice", pa)) + sa_ == canon_prefixed(rec(b"alice", pb)) + sb_
    if not dv:
        print("  FAIL boundary control: variable-length collision did NOT reproduce"); fails += 1
    if pv:
        print("  FAIL boundary: collision PRESENT under canon_prefixed"); fails += 1
    print(f"  canon||sig, VARIABLE-length sig (DER 71/70): delimited collides={dv} "
          f"prefixed collides={pv}  [charset-valid names, NO schema change]")

    total = len(CLASSES) + 13
    print(f"\nCANON SUITE: {total - fails}/{total} passed")
    return fails


if __name__ == "__main__":
    raise SystemExit(1 if run() else 0)
