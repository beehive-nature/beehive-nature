#!/usr/bin/env python3
"""test_outbound.py — the draft-only seam: nothing is ever sent.

Laws: unknown senders refused; historical, not-provisioned recipients
refused; ambiguous recipients HELD for reconciliation (no draft bytes);
drafts land as 0600 .eml files with draft-only markers; send_draft is a
policy refusal, not an unimplemented TODO; and the package carries no SMTP
client anywhere (source-scanned).
"""
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import outbound  # noqa: E402
from store import Store  # noqa: E402


class OutboundTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = Path(self.tmp.name) / "state"

    def tearDown(self):
        self.tmp.cleanup()

    def test_draft_written_with_markers_and_pointer_row(self):
        result = outbound.create_draft(self.state, "bzcode", "friend@example.org", "hello", "a draft body")
        self.assertEqual(result["status"], "draft")
        path = Path(result["path"])
        self.assertTrue(path.exists())
        raw = path.read_bytes()
        self.assertIn(b"From: bzcode@agents.skaists.buzz", raw)
        self.assertIn(b"To: friend@example.org", raw)
        self.assertIn(b"X-Buzz-Mail: draft-only", raw)
        if sys.platform != "win32":
            import stat
            mode = stat.S_IMODE(path.stat().st_mode)
            self.assertEqual(mode, 0o600, f"draft not 0600: {oct(mode)}")
        db = Store(self.state)
        try:
            drafts = db.drafts(status="draft")
            self.assertEqual(len(drafts), 1)
            self.assertEqual(drafts[0][1], "bzcode")
        finally:
            db.close()

    def test_unknown_sender_refused(self):
        with self.assertRaises(outbound.OutboundRefused):
            outbound.create_draft(self.state, "not-a-local", "x@example.org", "s", "b")

    def test_historical_recipient_refused(self):
        with self.assertRaises(outbound.OutboundRefused):
            outbound.create_draft(self.state, "bzcode", "z2.1@agents.skaists.buzz", "s", "b")
        with self.assertRaises(outbound.OutboundRefused):
            outbound.create_draft(self.state, "bzcode", "skaists@agents.skaists.buzz", "s", "b")

    def test_malformed_recipient_refused(self):
        with self.assertRaises(outbound.OutboundRefused):
            outbound.create_draft(self.state, "bzcode", "not an address", "s", "b")

    def test_ambiguous_recipient_held_not_drafted(self):
        """Fixture roster with two case-insensitive colliding identities: the
        draft is HELD for reconciliation and no .eml bytes are written."""
        import roster as roster_mod
        resolved = roster_mod.load()
        resolved["mailboxes"]["BZCode"] = dict(resolved["mailboxes"]["bzcode"])  # deliberate collision
        result = outbound.create_draft(self.state, "bclaude", "bzcode@agents.skaists.buzz", "ambiguous?", "b", resolved_roster=resolved)
        self.assertEqual(result["status"], "held_reconciliation")
        db = Store(self.state)
        try:
            held = db.drafts(status="held_reconciliation")
            self.assertEqual(len(held), 1)
            self.assertIsNone(held[0][5], "held draft wrote a file path")
        finally:
            db.close()
        drafts_dir = self.state / "drafts"
        self.assertFalse(drafts_dir.exists() or any(drafts_dir.glob("*.eml")), "held draft wrote bytes")

    def test_send_draft_always_refuses(self):
        for args in ((), ("x",), (self.state, "x", "y")):
            with self.assertRaises(outbound.OutboundDisabled):
                outbound.send_draft(*args)

    def test_no_smtp_client_anywhere_in_the_package(self):
        package = Path(__file__).resolve().parent
        banned = re.compile(r"^\s*(import\s+smtplib|from\s+smtplib|import\s+smtpd|from\s+smtpd)\b", re.M)
        for py in package.glob("*.py"):
            if py.name.startswith("test_"):
                continue
            source = py.read_text(encoding="utf-8")
            self.assertIsNone(banned.search(source), f"{py.name} imports an SMTP client")
            self.assertNotIn("sendmail(", source, f"{py.name} calls sendmail")
            self.assertNotIn("smtplib.SMTP", source, f"{py.name} constructs an SMTP client")


if __name__ == "__main__":
    unittest.main(verbosity=2)
