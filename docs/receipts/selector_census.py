#!/usr/bin/env python3
"""Census the dispatcher surface of every ERC-20i-family deployment, from bytecode.

Written for SPEC-INSCRIPTION-COMPAT-1 §2.1, 2026-08-25. The question is old — which
deployments expose which enumeration pair — and the method is the one §2.2 ran for
transferItem on 2026-08-20: read bytecode on two independent RPCs and let agreement
be the control. What the older runs tested membership against FUNGI's selector list;
this tool DISCOVERS each dispatcher's real surface instead, because a family with
per-deployment vocabularies (JELLI names its traits Medusa and Polyp) turns a
membership checklist into a wall of absences that reads like a finding and is noise.

Three properties make its output a receipt rather than an assertion:

  1. A SELECTOR LIVES INSIDE A PUSH4 IMMEDIATE — exactly what evmcheck.py's opcode
     walk skips, because immediates are data. Reusing that walk would report every
     selector absent everywhere and look clean doing it. This tool collects
     immediates instead, and counts only a COMPLETE PUSH4 (0x63 with four bytes
     after it) as presence; a truncated tail is not a selector.

  2. TWO RPCs MUST RETURN BYTE-IDENTICAL CODE. A disagreement prints as DISAGREE
     and yields no verdict, because one of them is wrong and that is the finding.

  3. EVERY RUN RE-DERIVES TWO RECEIPTS WE ALREADY HOLD before printing a single
     row: FUNGI must carry 0x9c216508 (mushroomCount, catalog 2026-08-16) and must
     NOT carry 0x67c65e99 (transferItem, §2.2 census 2026-08-20). A broken scanner
     aborts instead of reporting a tidy wall of absences.

The Solidity CBOR metadata trailer is stripped first (its length is in the final two
bytes, big-endian), so hash bytes in the trailer cannot pose as selectors.

Refuses to run while any address is null: a prefix is not an address, and a
fabricated row is worse than a missing one because it looks like a receipt.

Read-only throughout: eth_getCode only. No keys, no transactions, no state.

Usage: python3 selector_census.py [deployments.json]
"""

import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
WORKLIST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "deployments.json")

# The two known-receipt controls, run before any row is printed.
CONTROL_DEPLOYMENT = "FUNGI"
CONTROL_MUST_CARRY = "0x9c216508"    # mushroomCount(address) — catalog, 2026-08-16
CONTROL_MUST_LACK = "0x67c65e99"     # transferItem(address,uint256) — §2.2, 2026-08-20

# Modest builtin labels so the discovery dump reads as a surface, not noise.
# These are standard ERC-20 / access-control selectors, checked here by the same
# PUSH4 rule as everything else — labelled for reading, not assumed present.
BUILTIN_LABELS = {
    "0x70a08231": "balanceOf(address)",
    "0xa9059cbb": "transfer(address,uint256)",
    "0x23b872dd": "transferFrom(address,address,uint256)",
    "0x095ea7b3": "approve(address,uint256)",
    "0xdd62ed3e": "allowance(address,address)",
    "0x18160ddd": "totalSupply()",
    "0x06fdde03": "name()",
    "0x95d89b41": "symbol()",
    "0x313ce567": "decimals()",
    "0x8da5cb5b": "owner()",
    "0xf2fde38b": "transferOwnership(address)",
    "0x715018a6": "renounceOwnership()",
    "0x01ffc9a7": "supportsInterface(bytes4)",
    "0x4e487b71": "Panic(uint256) — solc >=0.8 assertion error, in everything",
    "0x3b9aca00": "numeric 10^9 — a scalar, not a selector",
    "0x77359400": "numeric 2*10^9 — a scalar, not a selector",
    "0xffffffff": "mask — not a selector",
    "0xffff0000": "mask — not a selector",
    "0xff000000": "mask — not a selector",
    "0x01000000": "mask — not a selector",
}


def die(msg, code=1):
    sys.exit("ABORT — %s" % msg if code else msg)


def fetch_code(rpc, address):
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_getCode", "params": [address, "latest"]}
    ).encode()
    # Several public RPCs 403 the default Python user-agent.
    req = urllib.request.Request(
        rpc,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "selector-census/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if "error" in out:
        raise RuntimeError(out["error"])
    return out["result"]


def strip_metadata(code):
    """Remove the Solidity CBOR metadata trailer (same rule as evmcheck.py)."""
    if len(code) < 2:
        return code
    n = int.from_bytes(code[-2:], "big")
    if 0 < n <= len(code) - 2:
        return code[: -(n + 2)]
    return code


def push4_immediates(code):
    """Walk the instruction stream and collect complete PUSH4 immediates.

    PUSH1..PUSH32 (0x60..0x7f) carry immediates that are DATA — advancing past them
    is what keeps a 0x63 inside a PUSH32 mask from being read as a selector. A
    PUSH4 with fewer than four bytes remaining is truncated and does not count.
    """
    out = set()
    i = 0
    while i < len(code):
        op = code[i]
        if 0x60 <= op <= 0x7F:
            width = op - 0x5F
            if op == 0x63 and i + 4 < len(code):
                out.add("0x" + code[i + 1 : i + 5].hex())
            i += 1 + width
        else:
            i += 1
    return out


def main():
    with open(WORKLIST, encoding="utf-8") as f:
        W = json.load(f)

    # The tool refuses to run on an unfilled row — before any network call.
    gaps = [d["name"] for d in W["deployments"] if not d.get("address")]
    if gaps:
        die(
            "deployments.json has null addresses: %s. A prefix is not an address; "
            "fill each from a source you trust." % ", ".join(gaps),
            2,
        )
    for d in W["deployments"]:
        a = d["address"]
        ok = (
            len(a) == 42
            and a.startswith("0x")
            and all(c in "0123456789abcdefABCDEF" for c in a[2:])
        )
        if not ok:
            die("deployment %s address %r is not 0x + 40 hex" % (d["name"], a), 2)

    known = {s["selector"]: s for s in W["selectors"]}
    labels = dict(BUILTIN_LABELS)
    labels.update({s["selector"]: "%s — %s" % (s["label"], s["signature"]) for s in W["selectors"]})

    # ── fetch, agree, scan ────────────────────────────────────────────────────
    surfaces = {}
    for d in W["deployments"]:
        rpcs = W["rpcs"][d["chain"]]
        codes = []
        for rpc in rpcs:
            try:
                codes.append(fetch_code(rpc, d["address"]))
            except Exception as e:  # noqa: BLE001 — an unreachable RPC is a finding, not a crash
                codes.append("RPCFAIL:%s" % e)
        surfaces[d["name"]] = {"dep": d, "codes": codes}

    def scanned(name):
        s = surfaces[name]
        a, b = s["codes"]
        if a != b:
            return None
        if not a.startswith("0x") or a == "0x":
            return set()  # agreed, but no code — the row will say so
        return push4_immediates(strip_metadata(bytes.fromhex(a[2:])))

    # ── controls first — no row prints until both pass ───────────────────────
    if CONTROL_DEPLOYMENT not in surfaces:
        die("control deployment %s missing from worklist" % CONTROL_DEPLOYMENT, 2)
    fungi_codes = surfaces[CONTROL_DEPLOYMENT]["codes"]
    if fungi_codes[0] != fungi_codes[1]:
        die(
            "control deployment %s DISAGREES between RPCs — cannot run controls on "
            "unverifiable code" % CONTROL_DEPLOYMENT
        )
    fungi_imm = push4_immediates(
        strip_metadata(bytes.fromhex(fungi_codes[0][2:]))
    ) if fungi_codes[0].startswith("0x") and fungi_codes[0] != "0x" else set()
    if CONTROL_MUST_CARRY not in fungi_imm:
        die(
            "positive control: %s does not carry %s — the scanner is broken (or the "
            "chain moved); refusing to print a wall of absences"
            % (CONTROL_DEPLOYMENT, CONTROL_MUST_CARRY)
        )
    if CONTROL_MUST_LACK in fungi_imm:
        die(
            "negative control: %s now carries %s — a §2.2 census receipt (2026-08-20) "
            "has been falsified; re-derive before trusting anything here"
            % (CONTROL_DEPLOYMENT, CONTROL_MUST_LACK)
        )
    print("controls: FUNGI carries %s, lacks %s — both receipts re-derived this run"
          % (CONTROL_MUST_CARRY, CONTROL_MUST_LACK))
    print()

    # ── the §2.1 table ─────────────────────────────────────────────────────────
    print("== §2.1 surface census — membership ==")
    hdr = [s["label"] for s in W["selectors"]]
    print("deployment   chain     code/rpcs      " + "  ".join("%-15s" % h for h in hdr))
    verdicts = {}
    for name, s in surfaces.items():
        d = s["dep"]
        a, b = s["codes"]
        imm = scanned(name)
        if imm is None:
            status = "DISAGREE" if (a.startswith("0x") and b.startswith("0x")) else "RPCFAIL"
            note = "%d vs %d B" % (len(a) // 2 - 1, len(b) // 2 - 1) if status == "DISAGREE" else "rpc unreachable"
            print("%-12s %-8s  %-13s  no verdict (%s)" % (name, d["chain"], status, note))
            verdicts[name] = "DISAGREE"
            continue
        nbytes = (max(len(x) for x in s["codes"]) - 2) // 2
        if nbytes == 0:
            print("%-12s %-8s  %-13s  NO CODE at address" % (name, d["chain"], "agree/0B"))
            verdicts[name] = "NO CODE"
            continue
        cells = "  ".join(
            "%-15s" % ("YES" if s2["selector"] in imm else "·") for s2 in W["selectors"]
        )
        print("%-12s %-8s  %-13s  %s" % (name, d["chain"], "agree/%dB" % nbytes, cells))
        verdicts[name] = imm

    # per-deployment enumeration verdict, in family terms
    print()
    print("== enumeration verdict (the §2.1 question) ==")
    for name, v in verdicts.items():
        if isinstance(v, str):
            print("%-12s %s" % (name, v))
            continue
        fungi_pair = "0x9c216508" in v and "0x0fd9587e" in v
        item_pair = "0xc00ae885" in v and "0x92d2036d" in v
        if fungi_pair and item_pair:
            what = "BOTH pairs — unexpected; read the source before believing it"
        elif fungi_pair:
            what = "FUNGI pair (mushroomCount + mushroomOfOwnerByIndex)"
        elif item_pair:
            what = "item pair (itemCount + getOwnerItemsPage)"
        else:
            what = "neither known pair — probe per contract, degrade to 'not enumerable'"
        print("%-12s %s" % (name, what))

    # ── discovery dump — the dispatcher's own surface, its own words ──────────
    print()
    print("== discovery — every PUSH4 immediate in each dispatcher ==")
    for name, v in verdicts.items():
        if not isinstance(v, (set, frozenset)):
            continue
        known_hit = sorted(x for x in v if x in labels)
        unknown = sorted(x for x in v if x not in labels)
        print("%-12s %d immediates" % (name, len(v)))
        for x in known_hit:
            print("    %s  %s" % (x, labels[x]))
        for x in unknown:
            raw = bytes.fromhex(x[2:])
            if all(0x20 <= b <= 0x7E for b in raw):
                print("    %s  ascii %r — string fragment, not a selector" % (x, raw.decode("ascii")))
            else:
                print("    %s  ? — resolve against verified source" % x)
    print()
    print("read-only: eth_getCode only; two RPCs per chain; agreement is the control.")


if __name__ == "__main__":
    main()
