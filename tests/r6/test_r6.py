"""R6 conformance suite.

LAW 8p — enumerate the structural classes of the thing under test and confirm each is
represented in the FIXTURE. The thing under test is a verifier over trees of ARBITRARY N,
so the enumeration ranges OVER N, not merely over positions within one N.

Classes covered:
  N = 1              empty proof (root IS the leaf hash)      -- degenerate boundary
  N = power of 2     ZERO promoted leaves, all proofs equal   -- balanced
  N = odd/mixed      >=1 promoted leaf, multiple proof lengths
and within each N, one representative per distinct proof length, plus leftmost + rightmost.

CAVEAT, kept deliberately (Cowork): this enumeration is LARGER THAN IT WAS, NOT PROVEN
EXHAUSTIVE. Classes may vary along axes nobody has checked -- tree depth, leaf-content
structure, proof encoding.
"""
from merkle import build, verify, hleaf, hnode

N_VALUES = [1, 2, 3, 4, 7, 8, 16, 17, 19, 31, 32, 33]

def classes_of(proofs):
    out = {}
    for i, p in enumerate(proofs):
        out.setdefault(len(p), []).append(i)
    return out

def representatives(proofs, n):
    cls = classes_of(proofs)
    reps = {min(v) for v in cls.values()}
    reps |= {0, n - 1}                      # leftmost + rightmost
    return sorted(reps), cls

def run():
    total = failed = 0
    for n in N_VALUES:
        leaves = [f"L{i}".encode() for i in range(n)]
        root, proofs = build(leaves)
        reps, cls = representatives(proofs, n)
        promoted = sum(len(v) for k, v in cls.items() if k < max(cls))
        kind = ("EMPTY-PROOF" if n == 1 else
                "BALANCED (0 promoted)" if promoted == 0 else
                f"{promoted} promoted")
        for i in reps:
            cases = [(f"N={n} leaf{i} valid", leaves[i], proofs[i], root, True)]
            if proofs[i]:
                cases += [
                    (f"N={n} leaf{i} FM1 order", leaves[i],
                     [(s, not d) for s, d in proofs[i]], root, False),
                    (f"N={n} leaf{i} FM2 trunc", leaves[i], proofs[i][:-1], root, False),
                ]
            for name, data, pf, rt, expect in cases:
                got = verify(data, pf, rt)
                total += 1
                if got != expect:
                    failed += 1
                    print(f"  FAIL {name}: expected {expect}, got {got}")
        if n > 1:
            stale, _ = build(leaves[:-1])
            total += 1
            if verify(leaves[0], proofs[0], stale) is not False:
                failed += 1; print(f"  FAIL N={n} FM3 stale root")
        if n > 2:
            forged = hnode(hleaf(leaves[0]), hleaf(leaves[1]))
            total += 1
            if verify(forged, proofs[0][1:], root) is not False:
                failed += 1; print(f"  FAIL N={n} FM4 second-preimage")
        print(f"  N={n:<3} classes={sorted(cls, reverse=True)}  reps={reps}  [{kind}]")
    # CVE-2012-2459 negative control: the mitigation must be load-bearing
    s1 = [b"A", b"B", b"C"]
    s2 = [b"A", b"B", b"C", b"C"]
    dup_collide = build(s1, duplicate=True)[0] == build(s2, duplicate=True)[0]
    rfc_collide = build(s1)[0] == build(s2)[0]
    total += 2
    if not dup_collide:
        failed += 1; print("  FAIL CVE control: attack did NOT reproduce under duplication")
    if rfc_collide:
        failed += 1; print("  FAIL CVE control: collision present under promote-unchanged")
    print(f"\n  CVE-2012-2459 control: duplicating collides={dup_collide} "
          f"promote-unchanged collides={rfc_collide}")
    print(f"\nR6 SUITE: {total - failed}/{total} passed across {len(N_VALUES)} values of N")
    return failed

if __name__ == "__main__":
    raise SystemExit(1 if run() else 0)
