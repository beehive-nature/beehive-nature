#!/usr/bin/env python3
"""bDISPATCH watcher — mailbox -> buzz (Nostr) bridge for Seat 1 (`bclaude`).

Watches docs/dispatches/ for a file whose FIRST LINE is `SEND TO: <seat>` (one or
more seats, comma-separated), publishes the file body as a NIP-17 private DM to each
addressee's pubkey signed by bclaude, then appends `RELAYED <utc-iso> <event-id>` to
the file — one line per addressee. Idempotent: a file that already carries a RELAYED
line for a seat is never re-sent to that seat.

KEY LAW: the secret is read from the OS keyring only (Windows Credential Manager entry
service=`bnr/bclaude/nsec`, user=`bclaude`) and is never written, printed or logged.
No env var carries it. Public key + relay URLs are the only things on the wire.

Deps (pinned by install.ps1): nostr-sdk (rust-nostr bindings), keyring.
Seat roster: docs/dispatches/SEAT-PUBKEYS.md — rows `| <seat> | <npub or hex> | ... |`.
"""
import asyncio, re, sys, time, datetime, pathlib
import keyring
from nostr_sdk import Keys, Client, NostrSigner, PublicKey

REPO = pathlib.Path(__file__).resolve().parents[2]
MAILBOX = REPO / "docs" / "dispatches"
ROSTER = MAILBOX / "SEAT-PUBKEYS.md"
RELAYS = ["wss://skaists.buzz", "wss://relay.damus.io", "wss://nos.lol"]
KEYRING_SERVICE, KEYRING_USER = "bnr/bclaude/nsec", "bclaude"
POLL_S = 5
SEND_RE = re.compile(r"^SEND TO:\s*(.+?)\s*$", re.I)
RELAYED_RE = re.compile(r"^RELAYED\s+(\S+)\s+(\S+)\s+to=(\S+)\s*$")


def load_keys() -> Keys:
    nsec = keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
    if not nsec:
        sys.exit("bdispatch: no secret in keyring (bnr/bclaude/nsec) — run install.ps1 first")
    try:
        return Keys.parse(nsec)
    finally:
        del nsec  # never held longer than the parse


def roster() -> dict:
    seats = {}
    if not ROSTER.exists():
        return seats
    for line in ROSTER.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 2 and cells[1] and cells[1].upper() != "MISSING" and not cells[0].startswith("-") and cells[0].lower() != "seat":
            try:
                seats[cells[0].lower()] = PublicKey.parse(cells[1])
            except Exception:
                pass
    return seats


def parse(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines:
        return None
    m = SEND_RE.match(lines[0])
    if not m:
        return None
    targets = [t.strip().lower() for t in m.group(1).split(",") if t.strip()]
    done = {mm.group(3).lower() for l in lines if (mm := RELAYED_RE.match(l))}
    body = "\n".join(l for l in lines[1:] if not RELAYED_RE.match(l)).strip()
    return targets, done, body


async def relay_one(client: Client, path: pathlib.Path, seat: str, pk: PublicKey, body: str):
    msg = f"[bDISPATCH from bclaude] file={path.name}\n\n{body}"
    out = await client.send_private_msg(pk, msg, [])
    eid = out.id.to_hex()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with path.open("a", encoding="utf-8") as f:
        f.write(f"\nRELAYED {stamp} {eid} to={seat}\n")
    print(f"bdispatch: {path.name} -> {seat} event {eid}", flush=True)


async def main():
    keys = load_keys()
    print("bdispatch: signing as", keys.public_key().to_bech32(), flush=True)
    client = Client(NostrSigner.keys(keys))
    for r in RELAYS:
        await client.add_relay(r)
    await client.connect()
    while True:
        seats = roster()
        for path in sorted(MAILBOX.glob("*.md")):
            parsed = parse(path)
            if not parsed:
                continue
            targets, done, body = parsed
            for seat in targets:
                if seat in done:
                    continue
                pk = seats.get(seat)
                if pk is None:
                    print(f"bdispatch: {path.name} -> {seat}: pubkey MISSING in SEAT-PUBKEYS.md, holding", flush=True)
                    continue
                try:
                    await relay_one(client, path, seat, pk, body)
                except Exception as e:  # relay down: hold, retry next tick, never mark RELAYED
                    print(f"bdispatch: {path.name} -> {seat}: send failed ({e}), will retry", flush=True)
        await asyncio.sleep(POLL_S)


if __name__ == "__main__":
    asyncio.run(main())
