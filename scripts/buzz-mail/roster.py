#!/usr/bin/env python3
"""roster.py — the explicit public roster for the bMAILroom candidate.

LAW (start order d003de1f / change 26d9d346): the SMTP accept list in
sink.py (KNOWN) is the SINGLE SOURCE of truth for which addresses exist.
This module parses it out of sink.py's own bytes at load time — there is
no second copy of the roster in this tree to drift. roster.json carries
only what sink.py cannot: the per-local Buzz public-key binding (npub)
and the historical, not-provisioned records (skaists@, z2.1@) that must
never be routable.

Bindings are npub strings (bech32) or null. A null binding is a REAL
STATE — "binding unverified" — and the notifier holds notification for
that mailbox instead of guessing a key. Verified bindings cite their
verification source in the JSON.
"""
import json
import re
from pathlib import Path

import bech32id

DOMAIN = "agents.skaists.buzz"


class RosterError(Exception):
    pass


def known_locals_from_sink(sink_path=None) -> set:
    """Parse the KNOWN set out of sink.py's bytes — single source, no drift.

    The expected source line (sink.py) is:
        KNOWN = {f"{a}@{DOMAIN}" for a in ("claude-code", "bzcode", ...)}
    """
    path = Path(sink_path) if sink_path else Path(__file__).resolve().parent / "sink.py"
    source = path.read_text(encoding="utf-8")
    match = re.search(r'KNOWN\s*=\s*\{f?"\{a\}@\{DOMAIN\}"\s*for a in \(([^)]*)\)', source)
    if not match:
        raise RosterError(f"cannot parse KNOWN from {path} — sink.py shape changed; update roster parsing in the same commit")
    locals_ = re.findall(r'"([^"]+)"', match.group(1))
    if not locals_:
        raise RosterError(f"empty KNOWN parsed from {path}")
    return set(locals_)


def load(path=None):
    """Load roster.json and CROSS-CHECK it against sink.py's KNOWN.

    Returns a dict: {"mailboxes": {local: {"npub": <hex or None>, "binding": str}},
                     "historical": {local: {...}}}
    Raises RosterError on any drift (fail loud, never fall back to a guess).
    """
    path = Path(path) if path else Path(__file__).resolve().parent / "roster.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    known = known_locals_from_sink()
    mailboxes = raw.get("mailboxes", {})
    historical = raw.get("historical", {})
    roster_locals = set(mailboxes)
    if roster_locals != known:
        missing = known - roster_locals
        extra = roster_locals - known
        raise RosterError(f"roster.json drifted from sink.py KNOWN — missing: {sorted(missing)} extra: {sorted(extra)}")
    overlap = roster_locals & set(historical)
    if overlap:
        raise RosterError(f"locals are both accepted and historical: {sorted(overlap)}")
    resolved = {"mailboxes": {}, "historical": {}}
    for local, entry in mailboxes.items():
        npub = entry.get("npub")
        hexkey = bech32id.npub_decode(npub) if npub else None
        resolved["mailboxes"][local] = {"npub": hexkey, "binding": entry.get("binding", "unverified")}
    for local, entry in historical.items():
        resolved["historical"][local] = dict(entry)
    return resolved


def accepted_address(local: str, resolved=None) -> bool:
    resolved = load() if resolved is None else resolved
    return local.lower() in resolved["mailboxes"]


if __name__ == "__main__":  # manual helper: print the npub for a hex pubkey
    import sys
    print(bech32id.npub_encode(bytes.fromhex(sys.argv[1])))
