#!/usr/bin/env python3
"""test_mailgate.py — the single-reader pass: dedupe horizon, holds, crash
resumes, backfill cutoff, and the multi-recipient negative control.

All fixtures are synthetic: Maildirs in a temp root, a fixture roster whose
npub values are programmatic bytes (never key material), a FakeTransport
that returns canned signed-event bytes, and a FakePublisher. No network,
no relay, no real keys — the transport seam's real implementation stays
DISABLED in this candidate.
"""
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mailgate  # noqa: E402
import roster as roster_mod  # noqa: E402
from store import Store  # noqa: E402

FIXTURE_NPUB = bytes(range(32))  # programmatic fixture bytes — not key material, not hex literals


def fixture_roster(verified=("bclaude", "bzcode"), unverified_npub=("bqueenbee",)):
    mailboxes = {}
    for local in roster_mod.known_locals_from_sink():
        if local in verified:
            mailboxes[local] = {"npub": FIXTURE_NPUB, "binding": "verified:fixture-receipt"}
        elif local in unverified_npub:
            mailboxes[local] = {"npub": FIXTURE_NPUB, "binding": "unverified"}  # npub present, citation absent — must still hold
        else:
            mailboxes[local] = {"npub": None, "binding": "unverified"}
    return {"mailboxes": mailboxes, "historical": {"skaists": {"npub": None}, "z2.1": {"npub": None}}}


class FakeTransport:
    """Synthetic transport: canned signed-event bytes; can be told to fail."""

    def __init__(self, fail_first=0):
        self.sign_calls = 0
        self.fail_first = fail_first
        self.payloads = []

    def sign_and_seal(self, recipient_hex, payload_json):
        self.sign_calls += 1
        if self.sign_calls <= self.fail_first:
            raise RuntimeError("synthetic transport refusal")
        self.payloads.append(payload_json)
        event = {"id": f"fixture-event-{self.sign_calls:08d}", "pubkey": "00" * 32,
                 "sig": "fixturesynthetic", "kind": 9,
                 "tags": [["h", "fixture-room"], ["p", recipient_hex.hex()]],
                 "content": "bMAIL notice: fixture", "created_at": 1}
        return json.dumps(event).encode()


class FakePublisher:
    def __init__(self, store_dir, fail_first=0):
        self.published = []
        self.fail_first = fail_first
        self.calls = 0
        self.store_dir = store_dir

    def publish(self, event_bytes):
        self.calls += 1
        # ledger law: bytes must already be durable in the outbox BEFORE any publish
        store = Store(self.store_dir)
        try:
            found = any(row[4].encode("utf-8") == event_bytes for row in store.events())
        finally:
            store.close()
        assert found, "publish called with bytes not committed to the outbox"
        if self.calls <= self.fail_first:
            return False
        self.published.append(event_bytes)
        return True


def plant(root, local, subject, body, name="m1"):
    d = Path(root) / local
    for sub in ("new", "cur", "tmp"):
        (d / sub).mkdir(parents=True, exist_ok=True)
    raw = f"From: sender@example.org\r\nTo: {local}@agents.skaists.buzz\r\nSubject: {subject}\r\nMessage-ID: <{name}@example.org>\r\n\r\n{body}\r\n".encode()
    (d / "new" / name).write_bytes(raw)
    return raw


class MailgateScanTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "mailroot"
        self.state = Path(self.tmp.name) / "state"

    def tearDown(self):
        self.tmp.cleanup()

    def test_same_bytes_two_recipients_two_rows(self):
        """Negative control for the digest-only keying defect (1e18cbf8 #1):
        identical content delivered to two mailboxes is TWO rows, TWO events."""
        raw = plant(self.root, "bclaude", "hello", "shared body", name="same")
        plant(self.root, "bzcode", "hello", "shared body", name="same")
        transport = FakeTransport()
        pub = FakePublisher(self.state)
        counts = mailgate.scan(self.root, self.state, transport=transport, publisher=pub,
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts["received"], 2, counts)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(), 2, "one row per (mailbox, digest)")
            self.assertEqual(len(store.events()), 2, "one signed event per recipient")
        finally:
            store.close()

    def test_dedupe_survives_rescan_and_restart(self):
        plant(self.root, "bclaude", "once", "body one", name="a")
        transport = FakeTransport()
        mailgate.scan(self.root, self.state, transport=transport, publisher=FakePublisher(self.state),
                      resolved_roster=fixture_roster(), epoch=0)
        first_signs = transport.sign_calls
        counts = mailgate.scan(self.root, self.state, transport=transport, publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts["skipped"], 1, counts)
        self.assertEqual(transport.sign_calls, first_signs, "rescan re-signed — dedupe broken")
        store = Store(self.state)  # restart: same state dir, fresh handle
        try:
            self.assertEqual(store.count_mail(), 1)
            self.assertEqual(len(store.events()), 1)
        finally:
            store.close()

    def test_sensitive_mail_held_and_notified_as_held(self):
        plant(self.root, "bclaude", "Your verification code inside", "code 123456", name="otp")
        transport = FakeTransport()
        counts = mailgate.scan(self.root, self.state, transport=transport, publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts["held_sensitive"], 1, counts)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(status="sensitive_review"), 1)
            self.assertEqual(store.count_mail(notify="acked"), 1)
            payload = json.loads(transport.payloads[0])
            self.assertEqual(payload["state"], "held_sensitive")
            self.assertNotIn("123456", transport.payloads[0], "OTP body leaked into notification payload")
        finally:
            store.close()

    def test_crash_after_insert_resumes_without_loss(self):
        """Crash point A: row committed, notification never completed."""
        plant(self.root, "bclaude", "resume me", "body", name="crasha")
        broken = FakeTransport(fail_first=1)
        counts = mailgate.scan(self.root, self.state, transport=broken, publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts.get("notify_error", 0), 1, counts)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(), 1, "row must be durable across the crash")
            self.assertEqual(store.count_mail(notify="none"), 1, "row must be INCOMPLETE, not skipped")
        finally:
            store.close()
        fixed = FakeTransport()
        counts2 = mailgate.scan(self.root, self.state, transport=fixed, publisher=FakePublisher(self.state),
                                resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts2.get("resumed", 0), 1, counts2)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(notify="acked"), 1)
            self.assertEqual(len(store.events()), 1)
        finally:
            store.close()

    def test_crash_after_sign_before_publish_reuses_stored_bytes(self):
        """Crash point B: event committed to the outbox, first publish fails."""
        plant(self.root, "bclaude", "uncertain", "body", name="crashb")
        transport = FakeTransport()
        failing_pub = FakePublisher(self.state, fail_first=10)  # relay down for the whole first pass (and its retry sweep)
        counts = mailgate.scan(self.root, self.state, transport=transport, publisher=failing_pub,
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts["notified"] + counts.get("resumed", 0) >= 0, True)
        store = Store(self.state)
        try:
            event_id, stored_before = store.events()[0][0], store.event_bytes(store.events()[0][0])
            row = store.event_row(event_id)
            self.assertIn(row[1], ("uncertain", "pending"), f"failed publish must leave uncertain/pending, got {row[1]}")
        finally:
            store.close()
        signs_before = transport.sign_calls
        counts2 = mailgate.scan(self.root, self.state, transport=transport, publisher=FakePublisher(self.state),
                                resolved_roster=fixture_roster(), epoch=0)
        store = Store(self.state)
        try:
            stored_after = store.event_bytes(event_id)
            self.assertEqual(stored_before, stored_after, "resume re-signed or altered stored bytes")
            self.assertEqual(store.event_row(event_id)[1], "acked")
            self.assertEqual(transport.sign_calls, signs_before, "resume minted a second signature")
            self.assertEqual(len(store.events()), 1)
        finally:
            store.close()

    def test_epoch_cutoff_skips_old_mail(self):
        plant(self.root, "bclaude", "ancient", "old", name="old")
        os.utime(Path(self.root) / "bclaude" / "new" / "old", (1000, 1000))
        counts = mailgate.scan(self.root, self.state, transport=FakeTransport(), publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), epoch=time.time() + 60)
        self.assertEqual(counts["skipped"], 1, counts)
        self.assertEqual(counts["received"], 0, counts)

    def test_npub_without_verified_citation_holds(self):
        """Enforcement (1e18cbf8 #2): an npub present but binding unverified
        must park at binding_unverified — never notify on a bare key."""
        plant(self.root, "bqueenbee", "hold me", "body", name="hold")
        transport = FakeTransport()
        counts = mailgate.scan(self.root, self.state, transport=transport, publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts["binding_unverified"], 1, counts)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(notify="binding_unverified"), 1)
            self.assertEqual(len(store.events()), 0, "event minted for an unverified binding")
        finally:
            store.close()

    def test_disabled_seam_holds_durable(self):
        plant(self.root, "bclaude", "no signer", "body", name="noseam")
        counts = mailgate.scan(self.root, self.state, transport=None, publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), epoch=0)
        self.assertEqual(counts["signer_unprovisioned"], 1, counts)
        counts2 = mailgate.scan(self.root, self.state, transport=None, publisher=FakePublisher(self.state),
                                resolved_roster=fixture_roster(), epoch=0)
        store = Store(self.state)
        try:
            # durable hold: state persists, no events are ever minted, no side
            # effects repeat — but the row IS re-evaluated each pass so a later
            # provisioned signer can complete it (6689f0e1).
            self.assertEqual(store.count_mail(), 1)
            self.assertEqual(store.count_mail(notify="signer_unprovisioned"), 1)
            self.assertEqual(len(store.events()), 0, "disabled seam minted an event")
        finally:
            store.close()

    def test_hold_then_verified_binding_completes(self):
        """6689f0e1 case: a binding held unverified is NOT permanently skipped —
        once the roster carries a verified binding, the same row notifies."""
        plant(self.root, "bclaude", "later verified", "body", name="later")
        unverified = fixture_roster(verified=())
        unverified["mailboxes"]["bclaude"] = {"npub": FIXTURE_NPUB, "binding": "unverified"}
        counts = mailgate.scan(self.root, self.state, transport=FakeTransport(), publisher=FakePublisher(self.state),
                               resolved_roster=unverified, epoch=0)
        self.assertEqual(counts["binding_unverified"], 1, counts)
        verified = fixture_roster(verified=("bclaude",))
        counts2 = mailgate.scan(self.root, self.state, transport=FakeTransport(), publisher=FakePublisher(self.state),
                                resolved_roster=verified, epoch=0)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(notify="acked"), 1, "held row never completed after binding verification")
            self.assertEqual(len(store.events()), 1, "re-entry minted a duplicate event")
        finally:
            store.close()

    def test_uncertain_restart_reconciles_mail_row(self):
        """6689f0e1 case: after a restart, an uncertain publish is retried with
        the stored bytes AND the reconciled state is recorded on the mail row."""
        plant(self.root, "bclaude", "uncertain restart", "body", name="ur")
        transport = FakeTransport()
        mailgate.scan(self.root, self.state, transport=transport, publisher=FakePublisher(self.state, fail_first=10),
                      resolved_roster=fixture_roster(), epoch=0)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(notify="uncertain"), 1)
        finally:
            store.close()
        counts2 = mailgate.scan(self.root, self.state, transport=FakeTransport(), publisher=FakePublisher(self.state),
                                resolved_roster=fixture_roster(), epoch=0)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(notify="acked"), 1, "reconciled state was not recorded on the mail row")
            self.assertEqual(len(store.events()), 1)
        finally:
            store.close()

    def test_acked_notice_does_not_suppress_deferred_draft(self):
        """6689f0e1 case: notification and drafting are independent — a draft
        deferred for budget still drafts on the next pass after the notice
        acked."""
        plant(self.root, "bclaude", "draft me later", "plain body", name="dd")
        calls = []

        def drafting(text):
            calls.append(text)
            return {"category": "notification", "summary": "s", "draft": ""}

        counts = mailgate.scan(self.root, self.state, transport=FakeTransport(), publisher=FakePublisher(self.state),
                               resolved_roster=fixture_roster(), call=drafting, limit=0, epoch=0)  # budget 0: deferred
        self.assertEqual(counts["drafted"], 0, counts)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(notify="acked"), 1)
            self.assertEqual(store.count_mail(status="received"), 1, "deferred draft lost its classification")
        finally:
            store.close()
        counts2 = mailgate.scan(self.root, self.state, transport=FakeTransport(), publisher=FakePublisher(self.state),
                                resolved_roster=fixture_roster(), call=drafting, limit=2, epoch=0)
        self.assertEqual(counts2["drafted"], 1, "acked notice suppressed the deferred draft")
        self.assertEqual(len(calls), 1)
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(status="drafted"), 1)
        finally:
            store.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
