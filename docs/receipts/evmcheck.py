#!/usr/bin/env python3
"""Check deployed runtime bytecode for opcodes a target chain does not implement.

Written for the exSat lane: exSat is SHANGHAI, so PUSH0 (0x5f) is expected and fine,
while the cancun trio TLOAD/TSTORE/MCOPY (0x5c/0x5d/0x5e) would deploy successfully
and then revert at runtime. solc >= 0.8.25 defaults to cancun and emits MCOPY, so a
default build is exactly the thing that fails.

Two traps this avoids, both of which make a naive `grep` wrong:

  1. PUSH IMMEDIATES ARE DATA, NOT CODE. A PUSH32 carries 32 arbitrary bytes, any of
     which may equal 0x5e. Scanning bytes without walking the instruction stream
     invents MCOPYs that are not there. We advance past each PUSH's immediate.

  2. SOLIDITY APPENDS CBOR METADATA. The trailer after the last instruction is not
     code; disassembling it produces garbage opcodes. Its length lives in the final
     two bytes, big-endian, and we strip it before scanning.

Read-only: the sole network call is eth_getCode. No keys, no transactions.
"""

import json
import sys
import urllib.request

# Opcodes introduced after shanghai. Anything here is a hard stop on an exSat deploy.
CANCUN = {
    0x5C: ("TLOAD", "cancun"),
    0x5D: ("TSTORE", "cancun"),
    0x5E: ("MCOPY", "cancun"),
}
PUSH0 = 0x5F  # shanghai — expected, and a code-size win. NOT a defect.


def fetch_code(rpc, address):
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_getCode", "params": [address, "latest"]}
    ).encode()
    # Several public RPCs 403 the default Python user-agent.
    req = urllib.request.Request(
        rpc,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "evmcheck/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if "error" in out:
        sys.exit("RPC error: %s" % out["error"])
    return out["result"]


def strip_metadata(code):
    """Remove the Solidity CBOR metadata trailer. Returns (code, trailer_len)."""
    if len(code) < 2:
        return code, 0
    n = int.from_bytes(code[-2:], "big")
    if 0 < n <= len(code) - 2:
        return code[: -(n + 2)], n + 2
    return code, 0


def scan(code):
    """Walk the instruction stream, skipping PUSH immediates.

    Returns (hits, push0s, zero_pushes). zero_pushes counts `PUSH1 0x00`, which a
    shanghai build would emit as PUSH0 instead — one byte shorter and one gas cheaper
    apiece. On a contract near the EIP-170 ceiling that difference is headroom.
    """
    hits, push0s, zero_pushes, i = [], 0, 0, 0
    while i < len(code):
        op = code[i]
        if op in CANCUN:
            hits.append((i, op, CANCUN[op][0]))
            i += 1
        elif op == PUSH0:
            push0s += 1
            i += 1
        elif 0x60 <= op <= 0x7F:          # PUSH1..PUSH32 — skip the immediate
            n = op - 0x5F
            if op == 0x60 and i + 1 < len(code) and code[i + 1] == 0x00:
                zero_pushes += 1
            i += 1 + n
        else:
            i += 1
    return hits, push0s, zero_pushes


def main():
    if len(sys.argv) < 2:
        sys.exit(
            "usage: evmcheck.py <address> [rpc-url]\n"
            "       evmcheck.py --hex 0x60806040...\n"
        )

    if sys.argv[1] == "--hex":
        raw, label = sys.argv[2], "(literal)"
    else:
        addr = sys.argv[1]
        rpc = sys.argv[2] if len(sys.argv) > 2 else "https://mainnet.base.org"
        label = "%s @ %s" % (addr, rpc)
        raw = fetch_code(rpc, addr)

    code = bytes.fromhex(raw[2:] if raw.startswith("0x") else raw)
    if not code:
        sys.exit("no code at that address (EOA, or wrong chain)")

    code, trailer = strip_metadata(code)
    hits, push0s, zero_pushes = scan(code)

    print("target      %s" % label)
    print("runtime     %d B code + %d B metadata = %d B total"
          % (len(code), trailer, len(code) + trailer))
    print("EIP-170     %d / 24576  (%.1f%%)"
          % (len(code) + trailer, 100.0 * (len(code) + trailer) / 24576))
    print("PUSH0       %d  (shanghai; expected)" % push0s)
    print("PUSH1 0x00  %d  -> %d B recoverable by targeting shanghai (%.1f%% of ceiling)"
          % (zero_pushes, zero_pushes, 100.0 * zero_pushes / 24576))

    if hits:
        print("\nPOST-SHANGHAI OPCODES FOUND — WILL NOT RUN ON exSat:")
        for off, op, name in hits:
            print("  0x%04x  %02x  %s" % (off, op, name))
        print("\n%d occurrence(s). Rebuild with evm_version = \"shanghai\"." % len(hits))
        return 1

    print("\nclean: no TLOAD/TSTORE/MCOPY. Shanghai-compatible.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
