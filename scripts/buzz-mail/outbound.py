#!/usr/bin/env python3
"""outbound.py — the DRAFT-ONLY outbound email seam (candidate).

START ORDER: "Draft-only outbound email seam. Nothing is ever sent."

THE SEAM, NOT A SENDER: this module composes an RFC-5322 message and
stores it as a draft file plus a pointer row. There is no SMTP client
anywhere in this package — send_draft() exists so callers can discover
the policy refusal at the API boundary instead of somewhere further down
a wire that does not exist. No socket, no smtplib, no relay: the module
is import-time-incapable of network (asserted by test_outbound.py's
source scan).

AMBIGUOUS SENDS ARE HELD, NOT GUESSED (room acceptance law): a recipient
whose local part resolves to more than one roster identity is parked at
held_reconciliation — the row records the hashes, no draft file is
written, and a human reconciles. Unknown senders (a from_local outside
the sink's KNOWN set) and historical, not-provisioned addresses are
refused outright.

Drafts carry X-Buzz-Mail: draft-only headers so no downstream tool can
mistake them for queued mail.
"""
import hashlib
import json
import re
import secrets
import time
from email.message import EmailMessage
from email.utils import formatdate
from pathlib import Path

import roster as roster_mod

DOMAIN = roster_mod.DOMAIN
ADDR_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


class OutboundRefused(Exception):
    """Refusal with a reason — unknown sender, bad address, historical."""


class OutboundDisabled(Exception):
    """The seam's permanent answer to any request to send."""


def create_draft(state_dir, from_local, to_addr, subject, body, resolved_roster=None):
    """Compose and durably store one draft. Returns the draft row (dict).

    Never sends; there is no code path from this function to a socket.
    """
    resolved = resolved_roster if resolved_roster is not None else roster_mod.load()
    from_local = from_local.lower()
    if from_local not in resolved["mailboxes"]:
        raise OutboundRefused(f"unknown sender local {from_local!r}: not in sink KNOWN")
    if not isinstance(to_addr, str) or not ADDR_RE.match(to_addr):
        raise OutboundRefused("recipient address malformed")
    to_local = to_addr.split("@", 1)[0].lower()
    # F6 (adfb6d9e): historical refusal compares the FULL estate address —
    # skaists@agents.skaists.buzz is refused, skaists@example.org is not
    # ours to refuse (and drafts to external addresses are the seam's job).
    if to_addr.lower() in {f"{loc}@{DOMAIN}" for loc in resolved["historical"]}:
        raise OutboundRefused("recipient address is historical, not provisioned for receiving mail")
    matches = [loc for loc in list(resolved["mailboxes"]) + list(resolved["historical"])
               if loc.lower() == to_local]
    if len(matches) > 1:
        # ambiguous recipient: HOLD for reconciliation, write no draft bytes
        draft_id = f"{int(time.time())}-{secrets.token_hex(4)}"
        store_dir = Path(state_dir)
        store_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        import store as store_mod
        db = store_mod.Store(store_dir)
        try:
            db.insert_draft(draft_id, from_local, to_addr,
                            hashlib.sha256(subject.encode()).hexdigest(),
                            "held_reconciliation", None)
        finally:
            db.close()
        return {"id": draft_id, "status": "held_reconciliation"}
    # compose the draft
    msg = EmailMessage()
    msg["From"] = f"{from_local}@{DOMAIN}"
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False, usegmt=True)
    msg["Message-ID"] = f"<{secrets.token_hex(12)}.{from_local}@{DOMAIN}>"
    msg["X-Buzz-Mail"] = "draft-only"
    msg["X-Buzz-Mail-State"] = "draft"
    msg.set_content(body)
    drafts_dir = Path(state_dir) / "drafts"
    drafts_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    draft_id = f"{int(time.time())}-{secrets.token_hex(4)}"
    path = drafts_dir / f"{draft_id}.eml"
    tmp = drafts_dir / f".{draft_id}.tmp"
    tmp.write_bytes(msg.as_bytes())
    import os
    os.chmod(tmp, 0o600)
    tmp.replace(path)
    import store as store_mod
    db = store_mod.Store(state_dir)
    try:
        db.insert_draft(draft_id, from_local, to_addr,
                        hashlib.sha256(subject.encode()).hexdigest(),
                        "draft", str(path))
    finally:
        db.close()
    return {"id": draft_id, "status": "draft", "path": str(path)}


def send_draft(*_args, **_kwargs):
    raise OutboundDisabled(
        "draft-only seam: outbound sending is not implemented by policy "
        "(room acceptance: outbound draft-first; activation is founder-gated)")
