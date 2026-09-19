#!/usr/bin/env python3
"""notify.py — durable, opaque private Buzz notification (candidate).

START ORDER (d003de1f, relayed founder dispatch; change 26d9d346 keeps this
half): "Private Buzz notification: durable and opaque. It carries no mail
contents; the message stays in the existing mailbox. Uncertain-publish
state and the stored signed bytes survive a restart."

STEER 83a2a264 (founder-signed): no homemade cryptography in this package;
all signing/sealing lives in the PINNED nostr-tools adapter
(notify-transport.mjs, nostr-tools 2.25.2 — the version the repo already
pins in tools/connect-store) behind the narrow Transport seam below. The
notification TARGETS the native Buzz private-room protocol; that protocol's
exact event shape is an integration decision (Astra's integration
contract), so the candidate ships the seam EXPLICITLY DISABLED: no service
key is provisioned, no transport is wired in production, and every mail row
parks at the durable signer_unprovisioned hold. Tests drive the LEDGER
LAWS with synthetic fixtures only.

LAWS ENCODED HERE (transport-independent — they hold whatever signer sits
behind the seam):

  OPACITY — the notification payload is a fixed whitelist of fields
  (version, type, mailbox, sha256 of the stored message, its size, the
  triage state, timestamp). No header, subject, sender or body value from
  the mail can enter: the composer takes (mailbox, digest, size, state)
  only. The mail itself never moves out of its Maildir.

  SIGNED BYTES BEFORE FIRST PUBLISH — whatever the transport returns as
  the signed event is serialized canonically and COMMITTED to the outbox
  table before any publish attempt exists. Retries (including after a
  crash) re-publish the STORED bytes verbatim: same id, same sig, never a
  re-sign.

  UNCERTAIN-PUBLISH — a publish attempt that neither acks nor cleanly
  fails leaves the row 'uncertain'; the next pass retries the stored
  bytes. There is deliberately no "assume it failed" transition.

  HOLD, DON'T GUESS — a mailbox whose roster binding is not a CITED,
  VERIFIED binding parks its notification at binding_unverified EVEN
  WHEN AN NPUB IS PRESENT (coordinator correction 1e18cbf8 #2: room
  membership proves a Buzz key, not authority over a mailbox — a binding
  is usable only with binding status 'verified:<receipt>' and an npub).
  An unprovisioned signer parks at signer_unprovisioned. Durable holds,
  never drops, never a guess at a recipient key.

  RESUME, NEVER RE-SIGN — before asking the transport to sign, the
  notifier looks for an existing outbox row for (mailbox, digest). If
  one exists (a crash after enqueue, or an uncertain publish), the
  STORED bytes are re-attempted; a new event is never minted for the
  same delivery.
"""
import json
import os
import subprocess
import time
from pathlib import Path

PAYLOAD_KEYS = {"v", "type", "mailbox", "msg_sha256", "size", "state", "notified_utc"}
ADAPTER = Path(__file__).resolve().parent / "notify-transport.mjs"


class SeamDisabled(Exception):
    """The transport seam is intentionally not configured in this candidate."""


class DestinationUnconfigured(Exception):
    """No channel descriptor exists for this recipient — the notice is HELD
    (never guessed, never routed to another agent's room)."""


class Transport:
    """Narrow seam: recipient binding + opaque payload IN, signed event bytes
    and a publish attempt OUT. All cryptography lives behind implementations."""

    def sign_and_seal(self, recipient_hex: bytes, payload_json: str) -> bytes:
        raise NotImplementedError

    def publish(self, event_bytes: bytes) -> bool:
        raise NotImplementedError


class DisabledTransport(Transport):
    """Candidate default: no key provisioned, nothing wired. Named refusal."""

    def sign_and_seal(self, recipient_hex, payload_json):
        raise SeamDisabled("notify transport seam is disabled: no service key provisioned (founder-gated activation)")

    def publish(self, event_bytes):
        raise SeamDisabled("notify transport seam is disabled: no publisher wired (founder-gated activation)")


class NodeAdapterTransport(Transport):
    """The intended production transport: the pinned nostr-tools adapter,
    in its TYPED NATIVE shape (kind 9, h = private channel UUID, plaintext
    reference-only content — no caller kind, no encryption switch).

    Invoked as a subprocess (never imported into python), key delivered via
    the BUZZ_MAILGATE_KEY environment variable — the key never appears in
    argv, stdin payloads or logs. The channel descriptor is configuration
    (relay-signed private room, exact membership, verified mailbox binding
    citation); the adapter independently re-validates all of it before
    building (rejection rules V1-V4 + fixed kind). The self-describing
    binding is constructed HERE from the notice's own mailbox/recipient so
    a mismatched pairing cannot be handed in, and the roster locals are
    parsed from sink.py's own bytes (single source) for the adapter's
    value-level payload check.
    """

    def __init__(self, key_hex: str, channel: dict, node="node", binding_citation=None, cwd=None):
        if not isinstance(channel, dict) or not channel.get("id"):
            raise ValueError("native transport requires a channel descriptor (relay-signed private room UUID)")
        self.key_hex = key_hex
        self.channel = channel
        self.node = node
        self.binding_citation = binding_citation if binding_citation is not None \
            else channel.get("binding_citation", "")
        self.cwd = str(cwd) if cwd else str(ADAPTER.parent)
        import roster as _roster
        self.roster_locals = sorted(_roster.known_locals_from_sink())

    def sign_and_seal(self, recipient_hex, payload_json):
        payload = json.loads(payload_json)
        request = {
            "channel": self.channel,
            "recipient": recipient_hex.hex(),
            "payload": payload,
            "binding": {"mailbox": payload["mailbox"], "recipient": recipient_hex.hex(),
                        "authorized": True, "citation": self.binding_citation},
            "rosterLocals": self.roster_locals,
        }
        proc = subprocess.run([self.node, str(ADAPTER)], input=json.dumps(request).encode(),
                              capture_output=True, cwd=self.cwd,
                              env=_adapter_env(self.key_hex))
        if proc.returncode != 0:
            raise RuntimeError(f"notify adapter refused (exit {proc.returncode}): {proc.stderr.decode(errors='replace').strip()}")
        return proc.stdout.strip()


def _adapter_env(key_hex: str) -> dict:
    """Minimal child environment for the node adapter: the key plus PATH,
    and SystemRoot ONLY on Windows — without it Node's CSPRNG cannot
    initialize (3f8101cb small fix). Nothing else is inherited."""
    env = {"BUZZ_MAILGATE_KEY": key_hex, "PATH": os.environ.get("PATH", "/usr/bin:/bin")}
    if os.name == "nt":
        env["SystemRoot"] = os.environ.get("SystemRoot", r"C:\Windows")
    return env


class SpoolLogPublisher:
    """Zero-network publisher for the disabled-seam candidate: appends the
    stored bytes to a local, 0600 spool log and returns the DISTINCT state
    'spooled' — a local write is durable but is NOT a relay acknowledgement
    and must never be labelled one (Astra F4, adfb6d9e; her source map: a
    fake transport acceptance is not a live relay ack). Rows it touches sit
    at 'spooled', visibly separate from 'acked'."""

    def __init__(self, spool_path):
        self.spool_path = Path(spool_path)

    def publish(self, event_bytes: bytes):
        with open(self.spool_path, "ab") as spool:
            spool.write(event_bytes + b"\n")
        return "spooled"


class RoutedTransport(Transport):
    """Per-recipient channel routing (R2b, 3f8101cb): a native DM room
    carries only the signer and ONE recipient, so a single shared channel
    descriptor can never serve a second agent. This transport holds a
    protected, explicit per-recipient descriptor map — {recipient_hex:
    channel descriptor} — and selects a route ONLY after the notifier has
    verified the roster binding (the binding check happens before the
    transport is ever called). An unknown or mismatched destination raises
    DestinationUnconfigured and the mail row parks at the durable
    destination_unconfigured hold — never a guess, never another agent's
    room."""

    def __init__(self, key_hex: str, channels: dict, node="node"):
        self._routes = {}
        for recipient, channel in (channels or {}).items():
            citation = channel.get("binding_citation", "") if isinstance(channel, dict) else ""
            self._routes[str(recipient).lower()] = NodeAdapterTransport(
                key_hex, channel, node=node, binding_citation=citation)

    def sign_and_seal(self, recipient_hex, payload_json):
        route = self._routes.get(recipient_hex.hex().lower())
        if route is None:
            raise DestinationUnconfigured("no channel descriptor for this recipient")
        return route.sign_and_seal(recipient_hex, payload_json)


class Notifier:
    def __init__(self, store, transport=None, publisher=None, bindings=None):
        """transport None = seam disabled (candidate default).

        bindings: optional callable mailbox -> current resolved roster entry
        {"npub": <hex bytes or None>, "binding": <status>}. When provided,
        EVERY publish of stored bytes is re-checked against the CURRENT
        binding first (8adf9b3b blocker 2): if the binding is no longer
        verified, or its key no longer equals the recipient the stored
        event was sealed to, the stored bytes are HELD (status
        'binding_changed') and never published."""
        self.store = store
        self.transport = transport
        self.publisher = publisher
        self.bindings = bindings

    def notify(self, mailbox, digest, size, state, binding, now=None):
        """Compose + seal + sign + store + (attempt) publish. Returns the
        notify state recorded on the mail row.

        binding is the RESOLVED roster entry {"npub": <hex bytes or None>,
        "binding": <status string>}. Enforcement (correction 1e18cbf8 #2):
        the notification is refused — held at binding_unverified — unless
        the binding status is a cited 'verified:<receipt>' AND an npub is
        present. An npub without a verified citation is not authority over
        a mailbox."""
        now = time.time() if now is None else now
        if not isinstance(binding, dict) or binding.get("npub") is None \
                or not str(binding.get("binding", "")).startswith("verified:"):
            return "binding_unverified"
        binding_hex = binding["npub"]
        if self.transport is None:
            return "signer_unprovisioned"
        existing = self.store.event_for_mail(mailbox, digest)
        if existing is not None:
            # RESUME: a previous pass already signed and committed bytes for
            # this delivery — attempt the stored event, never re-sign.
            return self.attempt(existing, now=now)
        payload = {
            "v": 1,
            "type": "bmail.notify",
            "mailbox": mailbox,
            "msg_sha256": digest,
            "size": size,
            "state": state,
            "notified_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
        }
        assert set(payload) == PAYLOAD_KEYS  # opacity whitelist — no mail content can ride along
        payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        try:
            signed_bytes = self.transport.sign_and_seal(binding_hex, payload_json)
        except DestinationUnconfigured:
            return "destination_unconfigured"  # durable hold: route the descriptor later, never guess
        # COMMIT the signed bytes before any publish attempt (uncertain-publish law)
        event = json.loads(signed_bytes.decode("utf-8"))
        self.store.enqueue_event(event, mailbox, binding_hex.hex(), digest, now=now)
        return self.attempt(event["id"], now=now)

    def attempt(self, event_id, now=None):
        """One publish attempt of the STORED bytes. Returns the resulting
        notify state (acked | uncertain | binding_changed | spooled)."""
        now = time.time() if now is None else now
        row = self.store.db.execute("SELECT mailbox,recipient,status FROM outbox WHERE id=?", (event_id,)).fetchone()
        if row is None:
            return "uncertain"
        if row[2] == "binding_changed":
            return "binding_changed"  # sticky hold: explicit resolution, never a roster-churn republish
        if row[2] == "spooled":
            return "spooled"  # sticky local-durability state: one spool line per event, never re-labelled acked
        if self.bindings is not None:
            current = self.bindings(row[0]) or {}
            npub = current.get("npub")
            verified = str(current.get("binding", "")).startswith("verified:")
            if npub is None or not verified or npub.hex() != row[1].lower():
                # The binding changed (or lost its citation) after these
                # bytes were sealed: HOLD them — never publish a notice
                # sealed to a recipient the roster no longer authorizes.
                self.store.set_event_status(event_id, "binding_changed", now=now)
                return "binding_changed"
        raw = self.store.event_bytes(event_id)
        if self.publisher is None:
            return "uncertain"  # no publisher wired: hold, never assume
        try:
            ok = self.publisher.publish(raw)
        except Exception:
            ok = False
        if ok == "spooled":
            # local durability only — distinct from a relay ack, never
            # labelled 'acked' (F4, adfb6d9e)
            self.store.set_event_status(event_id, "spooled", now=now)
            return "spooled"
        status = "acked" if ok is True else "uncertain"
        self.store.set_event_status(event_id, status, now=now)
        return "acked" if ok is True else "uncertain"

    def retry_uncertain(self, now=None):
        """Re-attempt every uncertain row with the stored bytes (same id/sig).
        binding_changed rows are deliberately NOT retried here: a held
        notice sealed to a superseded binding needs explicit resolution."""
        results = {}
        for event_id, _mailbox, _digest, _recipient, _json, _status, _attempts in self.store.events(status="uncertain"):
            results[event_id] = self.attempt(event_id, now=now)
        return results
