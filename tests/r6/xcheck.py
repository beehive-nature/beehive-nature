#!/usr/bin/env python3
"""Cross-IMPLEMENTATION reconciliation — the proof that PROVED the format agreed.

Runs RECONCILE-V1's exact record through BOTH implementations and compares byte-for-byte:
  Cowork's reference : ./canon.py            (canon_prefixed, leaf)
  Code's pipeline    : b-domain/anchor-global/epoch_pipeline.py  (canon, _lp)

A format check that runs ONE side is not a reconciliation, and a match against one's own
harness means nothing (LAW: one side is not a reconciliation). This runs both.

Proven 2026-08-09: canon 113 B identical; leaf ed25519(64 B) and leaf DER(71 B) both
identical. Exit 0 on MATCH, 1 on divergence (with a per-field breakdown localising it).

CROSS-REPO: locates epoch_pipeline via $BDOMAIN_ANCHOR or a default checkout path.
"""
import os, sys, hashlib

def _find_pipeline():
    for c in (os.environ.get("BDOMAIN_ANCHOR"),
              os.path.expanduser("~/b-domain/anchor-global"),
              "/mnt/c/Users/travi/b-domain/anchor-global"):
        if c and os.path.exists(os.path.join(c, "epoch_pipeline.py")):
            return os.path.abspath(c)
    raise SystemExit("epoch_pipeline.py not found — set BDOMAIN_ANCHOR to b-domain/anchor-global")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # this dir: Cowork's canon.py
sys.path.insert(0, _find_pipeline())                             # b-domain: Code's epoch_pipeline
import canon as cw            # noqa: E402  Cowork's reference implementation
import epoch_pipeline as code  # noqa: E402  Code's implementation (main() is __main__-guarded)
H = lambda b: hashlib.sha256(b).digest()

REC = dict(name=b"alice", owner=bytes(range(32)), revision=7,
           signed_at=1_800_000_000, expires_at=1_831_536_000,
           prev_signed_at=1_797_408_000, payload=b"bnr-reconcile-v1")
SIGS = {"ed25519-shaped (64 B)": bytes(range(64)),
        "der-shaped     (71 B)": bytes(range(71))}

cw_canon = cw.canon_prefixed(REC)
my_canon = code.canon(REC)
canon_match = cw_canon == my_canon

print("=== canon(record) ===")
print(f"  match     : {canon_match}   (cowork {len(cw_canon)} B, code {len(my_canon)} B)")
print(f"  cowork hex: {cw_canon.hex()}")
print(f"  code   hex: {my_canon.hex()}")

all_leaf_match = True
print("\n=== leaf = sha256(00 || canon || lp(sig)) ===")
for label, s in SIGS.items():
    cw_leaf = cw.leaf(REC, s)
    my_leaf = H(bytes([0]) + my_canon + code._lp(s))
    m = cw_leaf == my_leaf
    all_leaf_match = all_leaf_match and m
    print(f"  sig={label}: match={m}")
    print(f"    cowork: {cw_leaf.hex()}")
    print(f"    code  : {my_leaf.hex()}")

if not canon_match:
    print("\n=== DIVERGENCE — per-field (cowork | code) ===")
    def frames(b):
        off, out = 0, []
        while off < len(b):
            ln = int.from_bytes(b[off:off + 4], "big"); off += 4
            out.append(b[off:off + ln]); off += ln
        return out
    cf, mf = frames(cw_canon), frames(my_canon)
    for i, name in enumerate(code.FIELD_ORDER):
        a = cf[i].hex() if i < len(cf) else "(none)"
        b = mf[i].hex() if i < len(mf) else "(none)"
        print(f"  {name:14s} {a} | {b}{'' if a == b else '  <-- DIFFERS'}")

ok = canon_match and all_leaf_match
print(f"\nVERDICT: {'MATCH — format agreed' if ok else 'DIVERGE — see per-field breakdown; escalate to goose'}")
sys.exit(0 if ok else 1)
