#!/usr/bin/env python3
# gen_field_vectors.py — emits known-vector test lines for test_field256.
# Every line is computed with python big ints (independent of the C++ under
# test). Groups: M64, M512, MOD, R2, FMUL, FADD, FSUB, FNEG.
import random, sys

Q  = 21888242871839275222246405745257275088548364400416034343698204186575808495617   # PUBLIC-CONSTANT BN254 scalar field
QF = 21888242871839275222246405745257275088696311157297823662689037894645226208583   # PUBLIC-CONSTANT BN254 base field
M64 = (1 << 64) - 1

random.seed(20260904)
out = []

def h(x, n=16):  # fixed-width hex, n hex chars
    return format(x, "0%dx" % n)

# 64×64 → 128 (edges first, then random)
m64_cases = [(0,0),(1,0),(0,1),(1,1),(M64,M64),(M64,1),(1,M64),(M64,M64-1),(1<<32,1<<32),(1<<63,1<<63)]
m64_cases += [(random.getrandbits(64), random.getrandbits(64)) for _ in range(200)]
for a,b in m64_cases:
    p = a*b
    out.append("M64 %s %s %s %s" % (h(a), h(b), h(p >> 64), h(p & M64)))

# 256×256 → 512
edges = [0, 1, 2, 3, Q-1, QF-1, (1<<255)-1, 1<<254, M64, M64<<130]
m512_cases = [(a,b) for a in edges for b in edges]
m512_cases += [(random.getrandbits(256), random.getrandbits(256)) for _ in range(200)]
for a,b in m512_cases:
    out.append("M512 %s %s %s" % (h(a,64), h(b,64), h(a*b,128)))

# 512-bit mod 256-bit (both moduli; edges + random)
mod_cases = []
for m in (Q, QF):
    mod_cases += [(m-1, m), (0, m), (1, m), (m, m), (m+1, m), ((1<<512)-1, m), ((1<<256)-1, m)]
    mod_cases += [(random.getrandbits(512), m) for _ in range(120)]
for x,m in mod_cases:
    out.append("MOD %s %s %s" % (h(x,128), h(m,64), h(x % m,64)))

# Montgomery context: 2^512 mod m
for m in (Q, QF):
    out.append("R2 %s %s" % (h(m,64), h((1<<512) % m,64)))

# field ops — vectors per modulus incl. the gnarly edges
for m in (Q, QF):
    vals = [0, 1, 2, 3, m-1, m-2, m>>1, (m-1)//3*2]
    pairs = [(a,b) for a in vals for b in vals]
    pairs += [(random.randrange(m), random.randrange(m)) for _ in range(200)]
    for a,b in pairs:
        out.append("FMUL %s %s %s %s" % (h(m,64), h(a,64), h(b,64), h(a*b % m,64)))
        out.append("FADD %s %s %s %s" % (h(m,64), h(a,64), h(b,64), h((a+b) % m,64)))
        out.append("FSUB %s %s %s %s" % (h(m,64), h(a,64), h(b,64), h((a-b) % m,64)))
        out.append("FNEG %s %s %s"   % (h(m,64), h(a,64), h((-a) % m,64)))

# exponentiation (incl. the inversion exponent m−2) + batch-invert triples
for m in (Q, QF):
    pow_cases = [(2, m-2), (m-1, 2), (m-2, m-2), (1, 1), (0, 0), (1, 0), (m-1, m-2)]
    pow_cases += [(random.randrange(m), random.randrange(m)) for _ in range(40)]
    for a,e in pow_cases:
        out.append("FPOW %s %s %s %s" % (h(m,64), h(a,64), h(e,64), h(pow(a, e, m),64)))
    for _ in range(120):
        vs = [random.randrange(1, m) for _ in range(3)]
        out.append("BINV %s %s %s %s %s %s %s" % (h(m,64), h(vs[0],64), h(vs[1],64), h(vs[2],64),
                                                  h(pow(vs[0], m-2, m),64),
                                                  h(pow(vs[1], m-2, m),64),
                                                  h(pow(vs[2], m-2, m),64)))

sys.stdout.write("\n".join(out) + "\n")
