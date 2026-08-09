"""Minimal RFC-8032 Ed25519 verification WITHOUT the canonical-S range check.
Exists solely as a NEGATIVE CONTROL: if s+L verifies here but not under libsodium,
the malleability is real and libsodium's strictness is the mitigation."""
import hashlib
p = 2**255 - 19
L = 2**252 + 27742317777372353535851937790883648493
d = (-121665 * pow(121666, p-2, p)) % p
I = pow(2, (p-1)//4, p)
def xrecover(y):
    xx = (y*y-1) * pow(d*y*y+1, p-2, p)
    x = pow(xx, (p+3)//8, p)
    if (x*x - xx) % p != 0: x = (x*I) % p
    if x % 2 != 0: x = p-x
    return x
By = 4 * pow(5, p-2, p) % p
B = (xrecover(By), By)
def edwards(P, Q):
    x1,y1 = P; x2,y2 = Q
    k = d*x1*x2*y1*y2
    x3 = (x1*y2 + x2*y1) * pow(1+k, p-2, p)
    y3 = (y1*y2 + x1*x2) * pow(1-k, p-2, p)
    return (x3 % p, y3 % p)
def scalarmult(P, e):
    if e == 0: return (0, 1)
    Q = scalarmult(P, e//2); Q = edwards(Q, Q)
    return edwards(Q, P) if e & 1 else Q
def decodepoint(s):
    y = int.from_bytes(s, 'little') & ((1<<255)-1)
    x = xrecover(y)
    if x & 1 != (s[31] >> 7) & 1: x = p-x
    return (x, y)
def verify_permissive(pubkey: bytes, msg: bytes, sig: bytes) -> bool:
    """NO check that s < L. Everything else per RFC 8032."""
    R = decodepoint(sig[:32])
    A = decodepoint(pubkey)
    S = int.from_bytes(sig[32:], 'little')          # <-- unchecked
    h = int.from_bytes(hashlib.sha512(sig[:32] + pubkey + msg).digest(), 'little') % L
    return scalarmult(B, S) == edwards(R, scalarmult(A, h))
