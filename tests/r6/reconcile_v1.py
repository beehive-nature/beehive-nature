"""RECONCILE-V1 — the reconciliation vector for Code <-> Cowork leaf-byte comparison.

Fully specified inputs, no key material, no network. Prints canon bytes and leaf hashes
under the RULED format (R1a: 4-byte BE length prefix, 8-byte BE unsigned integers,
length-prefixed sig). Both seats run this and compare BYTE FOR BYTE.

The `sig` values are FIXED CONSTANTS, not real signatures — this is a FORMAT check, and
a format check must not depend on anyone holding a key. Two lengths are included so the
vector pins variable-length behaviour, not just the Ed25519 case.
"""
from canon import canon_prefixed, leaf

REC = dict(name=b"alice", owner=bytes(range(32)), revision=7,
           signed_at=1_800_000_000, expires_at=1_831_536_000,
           prev_signed_at=1_797_408_000, payload=b"bnr-reconcile-v1")

SIGS = {"ed25519-shaped (64 B)": bytes(range(64)),           # TESTNET-ONLY constant
        "der-shaped     (71 B)": bytes(range(71))}           # TESTNET-ONLY constant

if __name__ == "__main__":
    c = canon_prefixed(REC)
    print("RECORD :", {k: (v.hex() if isinstance(v, bytes) and k == "owner" else v)
                       for k, v in REC.items()})
    print(f"canon len : {len(c)} B")
    print(f"canon hex : {c.hex()}")
    print()
    for label, s in SIGS.items():
        print(f"leaf, sig={label} : {leaf(REC, s).hex()}")
