#!/usr/bin/env python3
"""test_notify.py — the notification ledger laws, at the module seam.

Covers what the scan-level battery drives past: payload whitelist opacity
(no mail content can enter, structurally), signed-bytes-before-publish
ordering, uncertain retry reusing stored bytes verbatim, binding holds,
and the disabled-seam refusal being the named exception.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import notify  # noqa: E402
from store import Store  # noqa: E402

FIXTURE = bytes(range(32))  # programmatic fixture bytes — not key material


class ScriptedTransport:
    def __init__(self):
        self.payloads = []

    def sign_and_seal(self, recipient_hex, payload_json):
        self.payloads.append(payload_json)
        return json.dumps({"id": f"synthetic-{len(self.payloads):04d}", "synthetic": True,
                           "pubkey": "00" * 32, "sig": "synthetic", "kind": 9,
                           "tags": [["h", "fixture"], ["p", recipient_hex.hex()]], "content": "fixture"}).encode()


class OpacityTest(unittest.TestCase):
    def test_payload_is_whitelisted_reference_only(self):
        captured = {}

        class Cap(ScriptedTransport):
            def sign_and_seal(self, recipient, payload_json):
                captured["payload"] = payload_json
                return super().sign_and_seal(recipient, payload_json)

        with tempfile.TemporaryDirectory() as tmp:
            store = Store(Path(tmp))
            try:
                notifier = notify.Notifier(store, transport=Cap(), publisher=None)
                outcome = notifier.notify("bzcode", "ab" * 32, 123, "received",
                                          {"npub": FIXTURE, "binding": "verified:fixture"}, now=1_800_000_000)
                self.assertEqual(outcome, "uncertain")  # no publisher wired: honest hold
                payload = json.loads(captured["payload"])
                self.assertEqual(set(payload), notify.PAYLOAD_KEYS)
                self.assertNotIn("subject", payload)
                self.assertNotIn("body", payload)
                self.assertNotIn("from", payload)
            finally:
                store.close()

    def test_unverified_binding_holds_even_with_npub(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(Path(tmp))
            try:
                notifier = notify.Notifier(store, transport=ScriptedTransport(), publisher=None)
                outcome = notifier.notify("bzcode", "ab" * 32, 123, "received",
                                          {"npub": FIXTURE, "binding": "unverified"})
                self.assertEqual(outcome, "binding_unverified")
                self.assertEqual(store.events(), [], "event minted for unverified binding")
            finally:
                store.close()

    def test_no_transport_is_signer_unprovisioned(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(Path(tmp))
            try:
                notifier = notify.Notifier(store, transport=None, publisher=None)
                self.assertEqual(notifier.notify("bzcode", "ab" * 32, 1, "received",
                                                 {"npub": FIXTURE, "binding": "verified:x"}),
                                 "signer_unprovisioned")
            finally:
                store.close()

    def test_bytes_committed_before_publish_and_retry_reuses_them(self):
        class Ordering:
            def __init__(self, store_dir):
                self.store_dir = store_dir
                self.order = []

            def publish(self, event_bytes):
                store = Store(self.store_dir)
                try:
                    committed = any(row[4].encode() == event_bytes for row in store.events())
                finally:
                    store.close()
                self.order.append(("publish", committed))
                return False  # always fail: stays uncertain

        with tempfile.TemporaryDirectory() as tmp:
            store = Store(Path(tmp))
            try:
                ordering = Ordering(Path(tmp))
                notifier = notify.Notifier(store, transport=ScriptedTransport(), publisher=ordering)
                outcome = notifier.notify("bzcode", "ab" * 32, 5, "received",
                                          {"npub": FIXTURE, "binding": "verified:x"}, now=1)
                self.assertEqual(outcome, "uncertain")
                self.assertTrue(all(committed for _, committed in ordering.order),
                                "publish attempted before bytes were committed to the outbox")
                first_bytes = store.event_bytes(store.events()[0][0])
                # restart: a fresh notifier retries the SAME bytes, no re-sign
                transport2 = ScriptedTransport()
                notifier2 = notify.Notifier(store, transport=transport2, publisher=ordering)
                notifier2.retry_uncertain()
                self.assertEqual(transport2.payloads, [], "retry re-signed the payload")
                self.assertEqual(store.event_bytes(store.events()[0][0]), first_bytes)
            finally:
                store.close()

    def test_disabled_transport_refuses_by_name(self):
        disabled = notify.DisabledTransport()
        with self.assertRaises(notify.SeamDisabled):
            disabled.sign_and_seal(FIXTURE, "{}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
