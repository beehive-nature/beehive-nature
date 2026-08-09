"""Record canonicalization and leaf construction.

LEAF = H(0x00 || canon(record) || lp(sig)).  For the leaf to be a COMMITMENT, this
byte string must be INJECTIVE in (record, sig).

CONFORMS TO R1a (NORMATIVE, SPEC_RESOLVER_VALIDITY_RULES), all three pins:
  * FRAMING      -- each field as 4-byte BIG-ENDIAN length || field bytes,
                    concatenated in fixed field order.
  * FIELD BYTES  -- every INTEGER field (revision, signed_at, expires_at,
                    prev_signed_at) as 8-byte BIG-ENDIAN UNSIGNED. Ruled Seat 1
                    2026-08-09. Big-endian matches the length prefix: one convention
                    throughout. EIGHT bytes, not four -- a 4-byte unsigned timestamp
                    OVERFLOWS 2106-02-07 and fails the 1000-year test by construction
                    (demonstrated in test_canon.py).
  * NO EXCEPTIONS -- the length prefix is kept on EVERY field WITHOUT EXCEPTION,
                    including the fixed-width integers: integer field = _lp(int8(v))
                    = 00000008 || 8-byte BE. Ruled Seat 1 2026-08-09. The "tidy"
                    alternative -- omit the prefix where the width is already known --
                    creates an EXCEPTION CLASS, and an exception class means an
                    implementer must know which fields are fixed-width. That knowledge
                    goes stale the first time a field is added or a width changes.
                    4 bytes per integer buys the removal of an entire divergence class.
                    DO NOT RE-DERIVE THE TIDY ALTERNATIVE. test_canon.py exhibits it
                    as a divergence and shows a forward parser cannot read it.
  * sig SUFFIX   -- LENGTH-PREFIXED like every other variable-length component, so the
                    leaf is self-delimiting for ANY signature scheme.

TWO ENCODINGS ARE PROVIDED ON PURPOSE (LAW 8r — the negative control lives in the suite):

  canon_delimited  -- b"|".join(fields).  VULNERABLE. Kept solely so the suite can
                      EXHIBIT the collisions. Never use it.
  canon_prefixed   -- the ruled encoding.  INJECTIVE UNCONDITIONALLY.

THREE independent reasons delimiter-joining is unsafe here (all measured, all in
test_canon.py as required-to-reproduce controls):
  1. Unvalidated `name` absorbs the fixed middle -> two records, identical bytes.
  2. Charset validation blocks (1) but ONLY while `payload` is the LAST field. Append
     any field and the collision returns under fully valid names.
  3. THE canon||sig BOUNDARY. Delimiter-joining is not self-delimiting, so the split
     between canon and sig is recoverable only because Ed25519 signatures happen to be
     a FIXED 64 bytes. Under a VARIABLE-length scheme (secp256k1/K1 DER, 70-72 B --
     already used elsewhere in this project) bytes move across the boundary and two
     records collide with charset-valid names and NO schema change.

=> Delimiter-joining is injective only CONDITIONALLY, on three invariants nothing in the
   code recorded: name validation, payload-stays-last, and fixed-length signatures.
   Length prefixing needs none of them.
"""
import struct, hashlib

LEN_PREFIX = ">I"      # R1a: 4-byte BIG-endian length. Load-bearing, not style.
INT_PACK   = ">Q"      # R1a: 8-byte BIG-endian unsigned, EVERY integer field.
LEAF_TAG   = b"\x00"   # R6a

FIELD_ORDER = ("name", "owner", "revision", "signed_at",
               "expires_at", "prev_signed_at", "payload")
INT_FIELDS  = ("revision", "signed_at", "expires_at", "prev_signed_at")


def _fields(r):
    """Field bytes in ruled order. Integers are 8-byte big-endian unsigned."""
    out = []
    for k in FIELD_ORDER:
        v = r[k]
        if k in INT_FIELDS:
            out.append(struct.pack(INT_PACK, v))
        elif isinstance(v, str):
            out.append(v.encode())
        else:
            out.append(bytes(v))
    return out


def _lp(b):
    return struct.pack(LEN_PREFIX, len(b)) + b


def canon_delimited(r, extra=None):
    """VULNERABLE — negative control only. `extra` appends a trailing field, which is
    how a future schema addition reintroduces the collision under valid names."""
    f = _fields(r) + ([extra] if extra is not None else [])
    return b"|".join(f)


def canon_prefixed(r, extra=None):
    """RULED. Each field carries its own big-endian u32 length; no separator is
    overloadable and the encoding is self-delimiting."""
    f = _fields(r) + ([extra] if extra is not None else [])
    return b"".join(_lp(x) for x in f)


canon = canon_prefixed          # the one callers should use


def leaf(r, sig, extra=None):
    """LEAF = H(0x00 || canon(record) || lp(sig)).

    `sig` is LENGTH-PREFIXED, not raw-appended (R1a, ruled Seat 1 2026-08-09), so the
    leaf is self-delimiting for any signature scheme — fixed-length Ed25519 or
    variable-length secp256k1/K1 DER alike."""
    return hashlib.sha256(LEAF_TAG + canon_prefixed(r, extra) + _lp(sig)).digest()


def leaf_raw_suffix(r, sig, extra=None):
    """PRE-RULING shape: sig appended UNPREFIXED. Kept as the negative control for the
    third R1a reason — under a variable-length signature this is not injective."""
    return hashlib.sha256(LEAF_TAG + canon_prefixed(r, extra) + sig).digest()
