"""Record canonicalization for leaf hashing.

LEAF = H(0x00 || canon(record)).  For the leaf to be a COMMITMENT, canon() must be
INJECTIVE: distinct records must never produce identical bytes.

TWO ENCODINGS ARE PROVIDED ON PURPOSE (LAW 8r — the negative control lives in the suite):

  canon_delimited  -- b"|".join(fields).  VULNERABLE. Kept solely so the suite can
                      EXHIBIT the collision. Never use it.
  canon_prefixed   -- length-prefixed fields.  INJECTIVE UNCONDITIONALLY.

Why delimiter-joining is unsafe here (measured 2026-08-09):
  * `name` and `payload` are variable-length AND attacker-influenced.
  * With an unvalidated `name`, a record can absorb the entire fixed middle, letting
    two distinct records serialize identically.
  * Charset validation on `name` blocks that instance -- but ONLY while `payload`
    remains the LAST field. Append any field after payload and the collision returns
    with fully charset-valid names.
  => Delimiter-joining is injective only CONDITIONALLY, on two invariants nothing in
     the code records: name validation, and payload-stays-last. Length prefixing needs
     neither.
"""
import struct

def _fields(r):
    name = r["name"].encode() if isinstance(r["name"], str) else r["name"]
    return [name, bytes(r["owner"]), struct.pack("<I", r["revision"]),
            struct.pack("<Q", r["signed_at"]), struct.pack("<Q", r["expires_at"]),
            struct.pack("<Q", r["prev_signed_at"]), r["payload"]]

def canon_delimited(r, extra=None):
    """VULNERABLE — negative control only. `extra` appends a trailing field, which is
    how a future schema addition reintroduces the collision under valid names."""
    f = _fields(r) + ([extra] if extra is not None else [])
    return b"|".join(f)

def canon_prefixed(r, extra=None):
    """INJECTIVE. Each field carries its own u32 length; no separator is overloadable."""
    f = _fields(r) + ([extra] if extra is not None else [])
    return b"".join(struct.pack("<I", len(x)) + x for x in f)

canon = canon_prefixed          # the one callers should use
