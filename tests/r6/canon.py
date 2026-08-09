"""Record canonicalization for leaf hashing.

LEAF = H(0x00 || canon(record) || sig).  For the leaf to be a COMMITMENT, canon() must be
INJECTIVE: distinct records must never produce identical bytes.

CONFORMS TO R1a (NORMATIVE, SPEC_RESOLVER_VALIDITY_RULES rev 6):
    "each field as 4-byte BIG-ENDIAN length || field bytes, concatenated in fixed field order"

TWO ENCODINGS ARE PROVIDED ON PURPOSE (LAW 8r — the negative control lives in the suite):

  canon_delimited  -- b"|".join(fields).  VULNERABLE. Kept solely so the suite can
                      EXHIBIT the collisions. Never use it.
  canon_prefixed   -- length-prefixed fields, big-endian.  INJECTIVE UNCONDITIONALLY.

THREE independent reasons delimiter-joining is unsafe here (all measured, all in
test_canon.py as required-to-reproduce controls):
  1. Unvalidated `name` absorbs the fixed middle -> two records, identical bytes.
  2. Charset validation blocks (1) but ONLY while `payload` is the LAST field. Append
     any field and the collision returns under fully valid names.
  3. THE canon||sig BOUNDARY. `sig` is appended UNPREFIXED. Delimiter-joining is not
     self-delimiting, so the split between canon and sig is recoverable only because
     Ed25519 signatures happen to be a FIXED 64 bytes. Under a VARIABLE-length scheme
     (secp256k1/K1 DER, 70-72 B — already used elsewhere in this project) bytes move
     across the boundary and two records collide with charset-valid names and NO schema
     change. Length-prefixed canon is self-delimiting and safe for ANY signature length.

=> Delimiter-joining is injective only CONDITIONALLY, on three invariants nothing in the
   code records: name validation, payload-stays-last, and fixed-length signatures.
   Length prefixing needs none of them.
"""
import struct

# ---------------------------------------------------------------------------
# UNPINNED — FLAGGED TO goose, NOT DECIDED HERE.
# R1a pins the FRAMING (4-byte big-endian length prefix). It does NOT define
# "field bytes" for the INTEGER fields (revision, signed_at, expires_at,
# prev_signed_at). Two implementations can both conform to R1a and still produce
# DIFFERENT leaves and DIFFERENT roots — see test_canon.py, which demonstrates three.
# This is the R6a argument exactly: any choice works mathematically; an unpinned
# choice means implementations cannot interoperate.
# Left AS-IS deliberately rather than guessed: a seat does not ship a format that
# another seat has been named to rule. One-line change when R1a is amended.
INT_ENC = "<"          # little-endian, INHERITED not ruled
# ---------------------------------------------------------------------------

LEN_PREFIX = ">I"      # RULED by R1a: 4-byte BIG-endian. Load-bearing, not style.


def _fields(r):
    name = r["name"].encode() if isinstance(r["name"], str) else r["name"]
    return [name, bytes(r["owner"]),
            struct.pack(INT_ENC + "I", r["revision"]),
            struct.pack(INT_ENC + "Q", r["signed_at"]),
            struct.pack(INT_ENC + "Q", r["expires_at"]),
            struct.pack(INT_ENC + "Q", r["prev_signed_at"]),
            r["payload"]]


def canon_delimited(r, extra=None):
    """VULNERABLE — negative control only. `extra` appends a trailing field, which is
    how a future schema addition reintroduces the collision under valid names."""
    f = _fields(r) + ([extra] if extra is not None else [])
    return b"|".join(f)


def canon_prefixed(r, extra=None):
    """INJECTIVE, and SELF-DELIMITING. Each field carries its own big-endian u32 length,
    so no separator is overloadable and the canon||sig boundary is unambiguous."""
    f = _fields(r) + ([extra] if extra is not None else [])
    return b"".join(struct.pack(LEN_PREFIX, len(x)) + x for x in f)


canon = canon_prefixed          # the one callers should use
