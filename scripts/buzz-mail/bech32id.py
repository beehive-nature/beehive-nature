#!/usr/bin/env python3
"""bech32id.py — bech32 ENCODING only (npub <-> 32-byte hex), for roster files.

This is not cryptography: bech32 (BIP-173) is a checksummed base-32 text
encoding. It lives here as its own tiny module so the package contains no
hand-written signature, hash or cipher primitives at all (coordinator steer
83a2a264: all cryptography lives behind the pinned nostr-tools adapter;
false-signal law — wrong implementations are deleted, not labelled).

Correctness is pinned by test_bech32id.py against the canonical NIP-19
example vector plus round-trip and checksum-rejection properties.
"""
CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _polymod(values):
    gen = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for i in range(5):
            if (top >> i) & 1:
                chk ^= gen[i]
    return chk


def _hrp_expand(hrp):
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _convertbits(data, frombits, tobits, pad=True):
    acc = 0
    bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for value in data:
        if value < 0 or (value >> frombits):
            return None
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return None
    return ret


def encode(hrp: str, data: bytes) -> str:
    data5 = _convertbits(list(data), 8, 5)
    values = _hrp_expand(hrp) + data5
    polymod = _polymod(values + [0, 0, 0, 0, 0, 0]) ^ 1
    checksum = [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]
    return hrp + "1" + "".join(CHARSET[d] for d in data5 + checksum)


def decode(addr: str):
    addr = addr.strip().lower()
    if addr != addr.strip():
        return None, None
    if any(ord(c) < 33 or ord(c) > 126 for c in addr):
        return None, None
    pos = addr.rfind("1")
    if pos < 1 or pos + 7 > len(addr) or len(addr) > 90:
        return None, None
    hrp = addr[:pos]
    data = []
    for c in addr[pos + 1:]:
        d = CHARSET.find(c)
        if d < 0:
            return None, None
        data.append(d)
    if _polymod(_hrp_expand(hrp) + data) != 1:
        return None, None
    return hrp, data[:-6]


def npub_encode(pubkey32: bytes) -> str:
    return encode("npub", pubkey32)


def npub_decode(npub: str) -> bytes:
    hrp, data5 = decode(npub)
    if hrp != "npub" or data5 is None:
        raise ValueError("npub decode failed (bad hrp or checksum)")
    raw = _convertbits(data5, 5, 8, pad=False)
    if raw is None or len(raw) != 32:
        raise ValueError("npub length invalid")
    return bytes(raw)


if __name__ == "__main__":  # helper: print the npub for a hex pubkey
    import sys
    print(npub_encode(bytes.fromhex(sys.argv[1])))
