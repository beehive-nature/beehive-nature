#!/usr/bin/env python3
"""test_sink_multircpt.py — the multi-RCPT fix, proven red at d7b9b2c6.

Defect (sink.py:29-31, before this branch): handle_RCPT appended the
address only when rcpt_tos was EMPTY (`if not envelope.rcpt_tos`), so the
FIRST accepted recipient was recorded and every later RCPT TO got a 250
with no delivery — one message to bclaude+bzcode delivered to bclaude
only.

This test drives the REAL handler classes (no socket, no daemon):
aiosmtpd is stubbed at import time when absent, because only the handler
logic is under test and the candidate must run on a bare python3.

Red-first receipt (this branch): stashing ONLY the sink.py fix made this
file exit 1 at exactly the multi-recipient case (delivered=1, expected 2);
restoring the fix made it green. See dispatch.
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import aiosmtpd  # noqa: F401
    from aiosmtpd.controller import Controller  # noqa: F401
    from aiosmtpd.smtp import SMTP, Envelope, Session  # noqa: F401
except ImportError:  # stub: the handler logic needs only the names to exist
    import types
    aiosmtpd = types.ModuleType("aiosmtpd")
    ctrl = types.ModuleType("aiosmtpd.controller")
    smtp = types.ModuleType("aiosmtpd.smtp")
    class _Stub:  # minimal shapes for type references only
        def __init__(self, *a, **k):
            pass
    ctrl.Controller = _Stub
    smtp.SMTP = _Stub
    smtp.Envelope = _Stub
    smtp.Session = _Stub
    sys.modules["aiosmtpd"] = aiosmtpd
    sys.modules["aiosmtpd.controller"] = ctrl
    sys.modules["aiosmtpd.smtp"] = smtp

import sink  # noqa: E402

import asyncio


class FakeEnvelope:
    def __init__(self):
        self.rcpt_tos = []
        self.original_content = b""
        self.content = ""


def run(coro):
    return asyncio.run(coro)


class SinkMultiRcptTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.mailroot = Path(self.tmp.name)
        self.sink = sink.Sink()
        self.original_mailroot = sink.MAILROOT
        sink.MAILROOT = self.mailroot

    def tearDown(self):
        sink.MAILROOT = self.original_mailroot
        self.tmp.cleanup()

    def _rcpt(self, env, address):
        reply = run(self.sink.handle_RCPT(None, None, env, address, None))
        return reply

    def _data(self, env, body=b"Subject: hi\r\n\r\nbody\r\n"):
        env.original_content = body
        return run(self.sink.handle_DATA(None, None, env))

    def _delivered(self):
        return {local: list((self.mailroot / local / "new").glob("*"))
                for local in os.listdir(self.mailroot)}

    def test_two_known_recipients_both_accepted_and_delivered(self):
        env = FakeEnvelope()
        self.assertIn("250", self._rcpt(env, "bclaude@agents.skaists.buzz"))
        self.assertIn("250", self._rcpt(env, "bzcode@agents.skaists.buzz"))
        self.assertIn("250", self._data(env))
        files = self._delivered()
        self.assertEqual(len(files.get("bclaude", [])), 1, f"bclaude delivery missing: {files}")
        self.assertEqual(len(files.get("bzcode", [])), 1, f"bzcode delivery missing (multi-RCPT defect): {files}")

    def test_three_recipients_all_delivered(self):
        env = FakeEnvelope()
        for local in ("bfuzz", "honeybee", "bqueenbee"):
            self.assertIn("250", self._rcpt(env, f"{local}@agents.skaists.buzz"))
        self.assertIn("250", self._data(env))
        files = self._delivered()
        for local in ("bfuzz", "honeybee", "bqueenbee"):
            self.assertEqual(len(files.get(local, [])), 1, f"{local} delivery missing: {files}")

    def test_unknown_recipient_refused_550(self):
        env = FakeEnvelope()
        self.assertEqual(self._rcpt(env, "nobody@agents.skaists.buzz"), "550 no such agent here")
        self.assertEqual(self._rcpt(env, "skaists@agents.skaists.buzz"), "550 no such agent here",
                         "historical unprovisioned address must stay refused (ADD/DROP ruling open)")
        self.assertEqual(self._rcpt(env, "z2.1@agents.skaists.buzz"), "550 no such agent here")

    def test_duplicate_rcpt_recorded_once(self):
        env = FakeEnvelope()
        self.assertIn("250", self._rcpt(env, "bclaude@agents.skaists.buzz"))
        self.assertIn("250", self._rcpt(env, "bclaude@agents.skaists.buzz"))
        self.assertIn("250", self._data(env))
        files = self._delivered()
        self.assertEqual(len(files.get("bclaude", [])), 1, f"duplicate RCPT delivered twice: {files}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
