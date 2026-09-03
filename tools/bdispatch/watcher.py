#!/usr/bin/env python3
"""bDISPATCH watcher — mailbox -> buzz (Nostr) bridge for Seat 1, signing as the
estate's EXISTING bClaude key (buzz-acp on the Oracle VPS; pubkey abbb9dfc…, no new key).

Watches docs/dispatches/ for a file whose FIRST LINE is `SEND TO: <seat>` (one or
more seats, comma-separated), publishes the file body as a NIP-17 private DM to each
addressee's pubkey signed by bclaude, then appends `RELAYED <utc-iso> <event-id>` to
the file — one line per addressee. Idempotent: a file that already carries a RELAYED
line for a seat is never re-sent to that seat.

KEY LAW: the secret is read ONCE from the root-owned 0600 file named by BDISPATCH_NSEC_FILE
(the VPS path buzz-acp already keeps it at: /opt/buzz-bclaude/bclaude.nsec — cited from
docs/dispatches/LANE_BCLAUDE_DEPLOY_2026-08-28.md; fallback /etc/bnr/bclaude.nsec). The
env var carries the PATH, never the secret. Never written, printed or logged.
Repo sync: install.sh runs `git pull --ff-only` on a systemd timer (pick logged there).

Deps (pinned by install.sh): nostr-sdk (rust-nostr bindings).
Seat roster: docs/dispatches/SEAT-PUBKEYS.md — rows `| <seat> | <npub or hex> | ... |`.
"""
import asyncio, re, sys, os, datetime, pathlib, hashlib
from nostr_sdk import Keys, Client, NostrSigner, PublicKey

REPO = pathlib.Path(os.environ.get("BDISPATCH_REPO", pathlib.Path(__file__).resolve().parents[2]))
MAILBOX = REPO / "docs" / "dispatches"
ROSTER = MAILBOX / "SEAT-PUBKEYS.md"
RELAYS = ["wss://skaists.buzz", "wss://relay.damus.io", "wss://nos.lol"]
NSEC_FILE = pathlib.Path(os.environ.get("BDISPATCH_NSEC_FILE", "/opt/buzz-bclaude/bclaude.nsec"))
POLL_S = 5
LEDGER = pathlib.Path(os.environ.get("BDISPATCH_STATE", os.path.expanduser("~/.local/state/bnr-bdispatch"))) / "relayed.tsv"
# Idempotency has TWO records: the RELAYED line inside the file (human-visible, travels with git) and
# this local ledger keyed by sha256(body)+seat (survives a git pull that rewrites the file).
SEND_RE = re.compile(r"^SEND TO:\s*(.+?)\s*$", re.I)
RELAYED_RE = re.compile(r"^RELAYED\s+(\S+)\s+(\S+)\s+to=(\S+?)(?:\s*<!--[^>]*-->)?\s*$")  # optional trailing PUBLIC-CONSTANT marker (hex law) never breaks idempotency


def load_keys() -> Keys:
    if not NSEC_FILE.exists():
        sys.exit(f"bdispatch: key file {NSEC_FILE} not found — see install.sh")
    mode = NSEC_FILE.stat().st_mode & 0o777
    if mode & 0o027:  # no world bits, no group write: 0600 or root:<user> 0640 (install.sh) only
        sys.exit(f"bdispatch: refusing key file {NSEC_FILE} with mode {oct(mode)} (must be 0600 or 0640)")
    nsec = NSEC_FILE.read_text(encoding="utf-8").strip().split("=")[-1]  # accepts bare nsec or KEY=nsec line
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


def ledger_has(key: str) -> bool:
    return LEDGER.exists() and any(l.split("\t")[0] == key for l in LEDGER.read_text().splitlines())


def ledger_add(key: str, eid: str):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a") as f:
        f.write(f"{key}\t{eid}\n")


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
    msg = f"[bDISPATCH from bClaude · Seat 1] file={path.name}\n\n{body}"
    out = await client.send_private_msg(pk, msg, [])
    eid = out.id.to_hex()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ledger_add(f"{hashlib.sha256(body.encode()).hexdigest()}:{seat}", eid)
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
                if seat in done or ledger_has(f"{hashlib.sha256(body.encode()).hexdigest()}:{seat}"):
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
