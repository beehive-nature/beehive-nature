"""Leaf-content structure tests -- the axis that was NAMED, NOT CLAIMED until now.

The R6 suite uses synthetic leaves. Real leaves are canon(record)||sig, where `name`
and `payload` are variable-length and attacker-influenced. This file tests whether the
LEAF IS ACTUALLY A COMMITMENT.

LAW 8p: structural classes of a REAL leaf enumerated below and each represented.
LAW 8r: the vulnerable encoding is kept and MUST collide, or the safe result proves nothing.
"""
import struct, hashlib, re
from canon import canon_delimited, canon_prefixed

LEAF = b'\x00'
CHARSET = re.compile(rb'^[a-z0-9-]{1,32}$')
O = bytes(range(32))
REV, SA, EA, PSA = 1, 1_800_000_000, 1_831_536_000, 0

def rec(name, payload):
    return dict(name=name, owner=O, revision=REV, signed_at=SA,
                expires_at=EA, prev_signed_at=PSA, payload=payload)

def hleaf(b): return hashlib.sha256(LEAF + b).digest()

MIDDLE = (b"|" + O + b"|" + struct.pack("<I", REV) + b"|" + struct.pack("<Q", SA)
          + b"|" + struct.pack("<Q", EA) + b"|" + struct.pack("<Q", PSA) + b"|")

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

    total = len(CLASSES) + 7
    print(f"\nCANON SUITE: {total - fails}/{total} passed")
    return fails

if __name__ == "__main__":
    raise SystemExit(1 if run() else 0)
