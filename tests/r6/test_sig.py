"""SIG MALLEABILITY AT THE LEAF BOUNDARY.

leaf = H(0x00 || canon(record) || sig). canon() injectivity says nothing about `sig`.
If one record admits two ACCEPTED signatures, it admits two valid leaves -- the leaf
stops being a canonical commitment even with a perfect canon().

NEGATIVE CONTROL (LAW 8r/8k): a "no variants verified" result is worthless unless the
probe can return a positive. `permissive_ed25519.py` implements RFC-8032 verification
WITHOUT the canonical-S range check. The s+L variant MUST verify there and MUST NOT
verify under libsodium. If that stops holding, this file fails -- do not delete the
permissive verifier to make it pass.

Why s+L is the right probe: L*B is the identity, so [s+L]B == [s]B. Any verifier that
omits the s < L check accepts it. libsodium checks it; that check IS the mitigation.
"""
import hashlib
import nacl.signing
from permissive_ed25519 import verify_permissive, L

LEAF = b'\x00'
SEED = b'COWORK-SIGMALL-SEED-2026-0000000'.ljust(32, b'0')[:32]
MSG = b"canon-bytes-of-a-record"

def run():
    sk = nacl.signing.SigningKey(SEED)
    vk = bytes(sk.verify_key)
    sig = sk.sign(MSG).signature
    R, S = sig[:32], sig[32:]
    s = int.from_bytes(S, 'little')
    fails = 0

    def libsodium(x):
        try:
            sk.verify_key.verify(MSG, x); return True
        except Exception:
            return False

    def leaf(sg): return hashlib.sha256(LEAF + MSG + sg).digest()

    if not (s < L):
        print("  FAIL fixture: reference signature has non-canonical S"); fails += 1

    variants = []
    s2 = s + L
    if s2 < 2**256:
        variants.append(("s+L", R + s2.to_bytes(32, 'little'), True))   # must pass permissive
    hb = s | (1 << 255)
    if hb < 2**256:
        variants.append(("S high bit", R + hb.to_bytes(32, 'little'), None))
    variants.append(("bit flip R", bytes([sig[0] ^ 1]) + sig[1:], False))
    variants.append(("bit flip S", sig[:32] + bytes([sig[32] ^ 1]) + sig[33:], False))

    accepted = [("original", sig)]
    for nm, v, perm_expect in variants:
        ls = libsodium(v)
        pm = verify_permissive(vk, MSG, v)
        if ls:
            accepted.append((nm, v))
            print(f"  FAIL libsodium ACCEPTED malleated variant {nm!r}"); fails += 1
        if perm_expect is True and not pm:
            print(f"  FAIL control: {nm!r} did NOT verify under the permissive verifier "
                  f"-- probe cannot return a positive, result is vacuous"); fails += 1
        if perm_expect is False and pm:
            print(f"  FAIL control: garbage variant {nm!r} verified under permissive"); fails += 1
        print(f"  {nm:14} libsodium={str(ls):<6} permissive={str(pm):<6}")

    leaves = {leaf(v) for _, v in accepted}
    if len(leaves) != 1:
        print(f"  FAIL {len(accepted)} accepted signatures produced {len(leaves)} leaves"); fails += 1
    print(f"\n  accepted signatures for one record = {len(accepted)}, distinct leaves = {len(leaves)}")

    total = 1 + 2 * len(variants) + 1
    print(f"\nSIG SUITE: {total - fails}/{total} passed")
    return fails

if __name__ == "__main__":
    raise SystemExit(1 if run() else 0)
