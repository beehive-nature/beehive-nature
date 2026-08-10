#!/usr/bin/env python3
"""Emit LANGUAGE-NEUTRAL Merkle-fold conformance vectors from the audited RFC 6962 reference.

The vectors carry the LEAF HASHES, not the leaf data, so a consumer in any language is
tested on the ONE thing under test: THE FOLD. Leaf hashing is a separate rule; bundling
them would let a fold bug hide behind a matching leaf convention.

Roots come from merkle.build() — the reference the R6 suite already exercises — rather
than from a fold re-written here, so these vectors cannot drift from the suite that
validates them.

⚠ WHY EACH HASH IS `"<hex> TESTNET-ONLY"` AND NOT A BARE HEX STRING:
the repo's secret-scan hook blocks any 48+ char hex run, because a public test vector and a
private key are the same shape to a scanner. LAW 8g: annotate on the SAME LINE, never
`--no-verify`. A bare-string array puts each hash alone on its line with nowhere to put the
marker. **Do not "tidy" this back to bare strings — it will trip the hook, and the tempting
fix at that point is the bypass.**

Regenerate:  python tests/r6/gen_vectors.py
Consumed by: crates/adapter-arweave/src/lib.rs  (r6_conformance)
"""
import json, pathlib
from merkle import build, hleaf, hnode

OUT = pathlib.Path(__file__).parent / "vectors" / "merkle_fold.json"
N_VALUES = [1, 2, 3, 4, 7, 8, 16, 17, 19, 31, 32, 33]

def data(i): return b"bnr-conformance-leaf-%d" % i

def tag(digest):
    """`"<hex> TESTNET-ONLY"` — ONE string, so the marker is on the SAME LINE as the hex.

    Third shape tried, and the reason is recorded so nobody re-walks it: a bare hex string
    leaves the line unmarked, and {"h":…,"k":…} gets split across two lines by indent=2,
    which puts the marker on a different line than the run it annotates. A single string
    is the only shape that survives pretty-printing."""
    return f"{digest.hex()} TESTNET-ONLY"

cases = []
for n in N_VALUES:
    ds = [data(i) for i in range(n)]
    cases.append({"n": n,
                  "leaves": [tag(hleaf(d)) for d in ds],
                  "root": tag(build(ds)[0])})

# CVE-2012-2459 control — distinct leaf SETS that COLLIDE under a duplicating fold.
a, b, c = data(101), data(102), data(103)
set_a, set_b = [a, b, c], [a, b, c, c]
cve = {
    "note": "R6b: odd node PROMOTED UNCHANGED. Under a DUPLICATING fold these roots COLLIDE.",
    "set_a": {"leaves": [tag(hleaf(x)) for x in set_a], "root": tag(build(set_a)[0])},
    "set_b": {"leaves": [tag(hleaf(x)) for x in set_b], "root": tag(build(set_b)[0])},
    "duplicating_fold_gives_both_sets": tag(build(set_a, duplicate=True)[0]),
}
assert cve["set_a"]["root"] != cve["set_b"]["root"], "control broken: ruled roots must differ"
assert cve["duplicating_fold_gives_both_sets"] == cve["set_b"]["root"], \
    "control broken: the duplicating fold of set_a must equal set_b's root — that IS the CVE"

OUT.write_text(json.dumps({
    "spec": "R6a tags 0x00 leaf / 0x01 node; R6b odd node PROMOTED UNCHANGED (never duplicated)",
    "under_test": "the FOLD only — leaves are given pre-hashed",
    "generated_by": "tests/r6/gen_vectors.py from tests/r6/merkle.py",
    "cases": cases, "cve_2012_2459": cve,
}, indent=2) + "\n")
print(f"wrote {OUT}: {len(cases)} N-cases + CVE control")
print(f"  N=19  root {cases[8]['root'][:16]}…")
print(f"  set_a root {cve['set_a']['root'][:16]}…   set_b root {cve['set_b']['root'][:16]}…")
print(f"  duplicating fold of set_a == set_b root: {cve['duplicating_fold_gives_both_sets'][:16]}…  <-- THE CVE")
