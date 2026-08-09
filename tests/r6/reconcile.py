#!/usr/bin/env python3
"""RECONCILE (Code half) — mirror of reconcile_v1.py through CODE's implementation
(b-domain/anchor-global/epoch_pipeline.canon), on the SAME record and sigs, so the two
files' output is directly comparable line-by-line. xcheck.py automates the compare and
asserts. Proven MATCH 2026-08-09: canon 113 B and both leaves byte-identical to
reconcile_v1.py (Cowork).

CROSS-REPO: the two implementations being reconciled live in two repos —
  Cowork's reference : beehive-nature/tests/r6/canon.py  (this dir)
  Code's pipeline    : b-domain/anchor-global/epoch_pipeline.py
This harness locates epoch_pipeline via $BDOMAIN_ANCHOR or a default checkout path.
No key material, no network — a format check must not depend on anyone holding a key.
"""
import os, sys, hashlib

def _find_pipeline():
    for c in (os.environ.get("BDOMAIN_ANCHOR"),
              os.path.expanduser("~/b-domain/anchor-global"),
              "/mnt/c/Users/travi/b-domain/anchor-global"):
        if c and os.path.exists(os.path.join(c, "epoch_pipeline.py")):
            return os.path.abspath(c)
    raise SystemExit("epoch_pipeline.py not found — set BDOMAIN_ANCHOR to b-domain/anchor-global")

sys.path.insert(0, _find_pipeline())
from epoch_pipeline import canon, _lp     # noqa: E402
H = lambda b: hashlib.sha256(b).digest()

REC = dict(name=b"alice", owner=bytes(range(32)), revision=7,
           signed_at=1_800_000_000, expires_at=1_831_536_000,
           prev_signed_at=1_797_408_000, payload=b"bnr-reconcile-v1")
SIGS = {"ed25519-shaped (64 B)": bytes(range(64)),       # fixed test constants, not real sigs
        "der-shaped     (71 B)": bytes(range(71))}

if __name__ == "__main__":
    c = canon(REC)
    print("RECORD :", {k: (v.hex() if isinstance(v, bytes) and k == "owner" else v)
                       for k, v in REC.items()})
    print(f"canon len : {len(c)} B")
    print(f"canon hex : {c.hex()}")
    print()
    for label, s in SIGS.items():
        print(f"leaf, sig={label} : {H(bytes([0]) + c + _lp(s)).hex()}")
