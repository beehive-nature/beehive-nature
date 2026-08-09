"""R6 reference verifier — RFC 6962 construction, per SPEC_RESOLVER_VALIDITY_RULES.
NORMATIVE VALUES (R6a/R6b): leaf tag 0x00, node tag 0x01, odd node PROMOTED UNCHANGED.
Do NOT duplicate the unpaired node — that is the Bitcoin construction (CVE-2012-2459).
This is a reference implementation; goose's R6 text is normative. If they differ, R6 wins."""
import hashlib
LEAF_TAG = b'\x00'
NODE_TAG = b'\x01'

def hleaf(data: bytes) -> bytes:
    return hashlib.sha256(LEAF_TAG + data).digest()

def hnode(left: bytes, right: bytes) -> bytes:
    return hashlib.sha256(NODE_TAG + left + right).digest()

def build(leaves, duplicate=False):
    """Return (root, proofs). proofs[i] = [(sibling, sibling_is_right), ...] leaf -> root.
    duplicate=True selects the VULNERABLE construction; provided only so the
    negative control can exhibit CVE-2012-2459. Never use it in production."""
    if not leaves:
        return b'\x00' * 32, []
    level = [hleaf(x) for x in leaves]
    proofs = [[] for _ in level]
    pos = {i: i for i in range(len(level))}
    while len(level) > 1:
        odd = len(level) % 2
        if odd and duplicate:
            level = level + [level[-1]]
        n = len(level) - (1 if (odd and not duplicate) else 0)
        nxt = []
        for i in range(0, n, 2):
            for orig, p in pos.items():
                if p == i:
                    proofs[orig].append((level[i + 1], True))
                elif p == i + 1:
                    proofs[orig].append((level[i], False))
            nxt.append(hnode(level[i], level[i + 1]))
        if odd and not duplicate:
            nxt.append(level[-1])          # PROMOTE UNCHANGED — no proof step
        pos = {o: (p // 2 if p < n else len(nxt) - 1) for o, p in pos.items()}
        level = nxt
    return level[0], proofs

def verify(data: bytes, proof, root: bytes) -> bool:
    h = hleaf(data)
    for sibling, sibling_is_right in proof:
        h = hnode(h, sibling) if sibling_is_right else hnode(sibling, h)
    return h == root
