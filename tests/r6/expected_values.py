#!/usr/bin/env python3
"""Expected-value fixture -- freezes the reconciliation bytes.

Run: python tests/r6/expected_values.py
Exit 0 if canon() + leaf() match frozen values; 1 if they diverge.

Proven MATCH 2026-08-09 (commit 021c013) across both implementations.
Single-repo: imports only tests/r6/canon.py. No cross-repo dependency.
No key material -- format check only.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from canon import canon_prefixed, leaf

REC = dict(name=b"alice", owner=bytes(range(32)), revision=7,
           signed_at=1_800_000_000, expires_at=1_831_536_000,
           prev_signed_at=1_797_408_000, payload=b"bnr-reconcile-v1")
SIG_ED25519 = bytes(range(64))
SIG_DER = bytes(range(71))

# Frozen expected values -- proven MATCH 2026-08-09, commit 021c013
EXPECTED_CANON_LEN = 113
EXPECTED_CANON_HEX = "00000005616c69636500000020000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f00000008000000000000000700000008000000006b49d20000000008000000006d2b058000000008000000006b22450000000010626e722d7265636f6e63696c652d7631"  # PUBLIC-CONSTANT test fixture
EXPECTED_LEAF_ED25519 = "092eac0e9fbb23c02a60d6f80b76cde35e55e3668cf6741e77d473122c8cd0e7"  # PUBLIC-CONSTANT test fixture
EXPECTED_LEAF_DER = "eff1e56e60836c17599731b60d90998e435b6ab62b921c7ed5dfb1c25a639bd3"  # PUBLIC-CONSTANT test fixture

def check():
    c = canon_prefixed(REC)
    ok = True
    if len(c) != EXPECTED_CANON_LEN:
        print(f"FAIL: canon len {len(c)} != {EXPECTED_CANON_LEN}")
        ok = False
    if c.hex() != EXPECTED_CANON_HEX:
        print("FAIL: canon hex diverged")
        ok = False
    for label, sig, exp in [("ed25519", SIG_ED25519, EXPECTED_LEAF_ED25519),
                             ("der", SIG_DER, EXPECTED_LEAF_DER)]:
        got = leaf(REC, sig).hex()
        if got != exp:
            print(f"FAIL: leaf({label}) diverged")
            ok = False
    if ok:
        print(f"PASS: canon {EXPECTED_CANON_LEN}B, both leaves match")
    return ok

if __name__ == "__main__":
    sys.exit(0 if check() else 1)
