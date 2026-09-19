#!/usr/bin/env python3
"""test_notify_adapter_cli.py — the REAL Python->Node adapter path (F2).

Astra's finding: the python caller never reached the validated Node
adapter (the binding object it sent was missing mailbox/recipient and no
roster locals were passed). This test drives NodeAdapterTransport through
the actual subprocess: a fixture room whose 39000/39002 metadata is REALLY
signed by an ephemeral relay key (minted by the adapter's own fixtureRoom
export), an ephemeral service key (runtime-generated, never committed),
and a schema-valid payload. Then proves the two mismatch rejections
through the same path.

Requires node with the adapter package installed (npm ci in
scripts/buzz-mail). Skips LOUDLY by name when node or the package is
absent — a skip is printed, never silent (AGENTS.md: skipped steps get
named).
"""
import json
import secrets
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import notify  # noqa: E402

HERE = Path(__file__).resolve().parent
ADAPTER = HERE / "notify-transport.mjs"

FIXTURE_SCRIPT = (
    "import { fixtureRoom } from "
    "'file://" + str(ADAPTER) + "';\n"
    "import { generateSecretKey as gsk, getPublicKey as gpk } from 'nostr-tools';\n"
    "const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');\n"
    "const relay = gsk(); const sender = gsk(); const recipientA = gsk(); const recipientB = gsk();\n"
    "const roomA = fixtureRoom(relay, gpk(sender), gpk(recipientA), { id: '00000000-0000-4000-8000-0000000000aa' });\n"
    "const roomB = fixtureRoom(gsk(), gpk(sender), gpk(recipientB), { id: '00000000-0000-4000-8000-0000000000bb' });\n"
    "roomA.binding_citation = 'verified:fixture-receipt-a'; roomB.binding_citation = 'verified:fixture-receipt-b';\n"
    "console.log(JSON.stringify({ rooms: { a: roomA, b: roomB }, sender: hex(sender),\n"
    "  recipientA: gpk(recipientA), recipientB: gpk(recipientB) }));\n"
)

PAYLOAD = {"v": 1, "type": "bmail.notify", "mailbox": "bzcode", "msg_sha256": "ab" * 32,
           "size": 10, "state": "received", "notified_utc": "2026-09-19T00:00:00Z"}


def node_available():
    try:
        proc = subprocess.run(["node", "--version"], capture_output=True)
        return proc.returncode == 0 and (HERE / "node_modules" / "nostr-tools").is_dir()
    except OSError:
        return False


@unittest.skipUnless(node_available(), "node + scripts/buzz-mail/node_modules required (npm ci); named skip, never silent")
class AdapterCliTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        proc = subprocess.run(["node", "--input-type=module", "-e", FIXTURE_SCRIPT],
                              capture_output=True, cwd=str(HERE))
        assert proc.returncode == 0, f"fixture mint failed: {proc.stderr.decode()}"
        fixture = json.loads(proc.stdout.decode())
        cls.rooms = fixture["rooms"]
        cls.recipient_a = fixture["recipientA"]
        cls.recipient_b = fixture["recipientB"]
        cls.service_key = fixture["sender"]  # the rooms' sender member; ephemeral per run
        cls.transport = notify.NodeAdapterTransport(
            cls.service_key, cls.rooms["a"], node="node",
            binding_citation="verified:fixture-receipt")

    def payload_for(self, mailbox):
        return json.dumps({**PAYLOAD, "mailbox": mailbox})

    def test_real_sign_path_returns_native_event(self):
        signed = self.transport.sign_and_seal(bytes.fromhex(self.recipient_a),
                                              json.dumps(PAYLOAD))
        event = json.loads(signed.decode())
        self.assertEqual(event["kind"], 9)
        self.assertTrue(any(t[0] == "h" and t[1] == self.rooms["a"]["id"] for t in event["tags"]))
        self.assertTrue(any(t[0] == "p" and t[1] == self.recipient_a for t in event["tags"]))
        self.assertEqual(len(event["id"]), 64)
        self.assertEqual(len(event["sig"]), 128)
        self.assertTrue(event["content"].startswith("bMAIL notice: mailbox=bzcode"))

    def test_mismatched_binding_refused(self):
        transport = notify.NodeAdapterTransport(
            self.service_key, self.rooms["a"], node="node", binding_citation="unverified")
        with self.assertRaises(RuntimeError) as ctx:
            transport.sign_and_seal(bytes.fromhex(self.recipient_a), json.dumps(PAYLOAD))
        self.assertIn("exit 5", str(ctx.exception))

    def test_mismatched_channel_refused(self):
        wrong_room = dict(self.rooms["a"])
        wrong_room["id"] = "00000000-0000-4000-8000-0000000000ff"  # not the signed room's d tag
        transport = notify.NodeAdapterTransport(self.service_key, wrong_room, node="node",
                                                binding_citation="verified:fixture-receipt")
        with self.assertRaises(RuntimeError) as ctx:
            transport.sign_and_seal(bytes.fromhex(self.recipient_a), json.dumps(PAYLOAD))
        self.assertIn("exit 5", str(ctx.exception))

    def test_two_recipients_route_to_their_own_rooms(self):
        """R2b: two DISTINCT recipients, separately relay-signed synthetic DMs,
        one RoutedTransport map. Each event's h must be its own room."""
        routed = notify.RoutedTransport(self.service_key, {
            self.recipient_a: self.rooms["a"],
            self.recipient_b: self.rooms["b"],
        }, node="node")
        event_a = json.loads(routed.sign_and_seal(bytes.fromhex(self.recipient_a),
                                                  self.payload_for("bclaude")).decode())
        event_b = json.loads(routed.sign_and_seal(bytes.fromhex(self.recipient_b),
                                                  self.payload_for("bzcode")).decode())
        self.assertEqual(event_a["kind"], 9)
        self.assertEqual(event_b["kind"], 9)
        self.assertTrue(any(t[0] == "h" and t[1] == self.rooms["a"]["id"] for t in event_a["tags"]))
        self.assertTrue(any(t[0] == "h" and t[1] == self.rooms["b"]["id"] for t in event_b["tags"]))
        self.assertNotEqual(event_a["id"], event_b["id"])

    def test_swapped_room_is_refused(self):
        """A deliberately swapped map (recipient A routed to B's room) is
        refused by the adapter's membership check — no cross-agent leak."""
        swapped = notify.RoutedTransport(self.service_key, {
            self.recipient_a: self.rooms["b"],  # B's room does not list A
        }, node="node")
        with self.assertRaises(RuntimeError) as ctx:
            swapped.sign_and_seal(bytes.fromhex(self.recipient_a), self.payload_for("bclaude"))
        self.assertIn("exit 5", str(ctx.exception))

    def test_unknown_destination_holds(self):
        routed = notify.RoutedTransport(self.service_key, {}, node="node")
        with self.assertRaises(notify.DestinationUnconfigured):
            routed.sign_and_seal(bytes.fromhex(self.recipient_a), self.payload_for("bclaude"))

    def test_runtime_key_is_ephemeral_not_committed(self):
        # the service key is generated at test time and lives only in this
        # process; nothing key-shaped is written to the tree by this test
        self.assertRegex(self.service_key, r"^[0-9a-f]{64}$")
        self.assertFalse(list(HERE.glob("*.key")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
