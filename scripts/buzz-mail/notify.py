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
import subprocess
import time
from pathlib import Path

PAYLOAD_KEYS = {"v", "type", "mailbox", "msg_sha256", "size", "state", "notified_utc"}
ADAPTER = Path(__file__).resolve().parent / "notify-transport.mjs"


class SeamDisabled(Exception):
    """The transport seam is intentionally not configured in this candidate."""


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
    building (rejection rules V1-V4 + fixed kind).
    """

    def __init__(self, key_hex: str, channel: dict, node="node"):
        if not isinstance(channel, dict) or not channel.get("id"):
            raise ValueError("native transport requires a channel descriptor (relay-signed private room UUID)")
        self.key_hex = key_hex
        self.channel = channel
        self.node = node

    def sign_and_seal(self, recipient_hex, payload_json):
        request = {
            "channel": self.channel,
            "recipient": recipient_hex.hex(),
            "payload": json.loads(payload_json),
            "binding": {"authorized": True, "citation": self.channel.get("binding_citation", "")},
        }
        proc = subprocess.run([self.node, str(ADAPTER)], input=json.dumps(request).encode(),
                              capture_output=True, env={"BUZZ_MAILGATE_KEY": self.key_hex, "PATH": "/usr/bin:/bin"})
        if proc.returncode != 0:
            raise RuntimeError(f"notify adapter refused (exit {proc.returncode}): {proc.stderr.decode(errors='replace').strip()}")
        return proc.stdout.strip()


class SpoolLogPublisher:
    """Zero-network publisher for the disabled-seam candidate: appends the
    stored bytes to a local, 0600 spool log and acks. Exists so the outbox
    lifecycle is exercisable without any relay; activation replaces it."""

    def __init__(self, spool_path):
        self.spool_path = Path(spool_path)

    def publish(self, event_bytes: bytes) -> bool:
        with open(self.spool_path, "ab") as spool:
            spool.write(event_bytes + b"\n")
        return True


class Notifier:
    def __init__(self, store, transport=None, publisher=None):
        """transport None = seam disabled (candidate default)."""
        self.store = store
        self.transport = transport
        self.publisher = publisher

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
        signed_bytes = self.transport.sign_and_seal(binding_hex, payload_json)
        # COMMIT the signed bytes before any publish attempt (uncertain-publish law)
        event = json.loads(signed_bytes.decode("utf-8"))
        self.store.enqueue_event(event, mailbox, binding_hex.hex(), digest, now=now)
        return self.attempt(event["id"], now=now)

    def attempt(self, event_id, now=None):
        """One publish attempt of the STORED bytes. Returns the resulting
        notify state (acked | uncertain)."""
        now = time.time() if now is None else now
        raw = self.store.event_bytes(event_id)
        if raw is None:
            return "uncertain"
        if self.publisher is None:
            return "uncertain"  # no publisher wired: hold, never assume
        try:
            ok = self.publisher.publish(raw)
        except Exception:
            ok = False
        status = "acked" if ok else "uncertain"
        self.store.set_event_status(event_id, status, now=now)
        return "acked" if ok else "uncertain"

    def retry_uncertain(self, now=None):
        """Re-attempt every uncertain row with the stored bytes (same id/sig)."""
        results = {}
        for event_id, _mailbox, _digest, _recipient, _json, _status, _attempts in self.store.events(status="uncertain"):
            results[event_id] = self.attempt(event_id, now=now)
        return results
