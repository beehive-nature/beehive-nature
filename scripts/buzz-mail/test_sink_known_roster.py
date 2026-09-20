#!/usr/bin/env python3
"""test_sink_known_roster.py — the roster gate: every KNOWN mailbox receives; unknowns refused.

Additive gate born from the bMAILroom six-vs-seven drift (laborer ruling
2026-09-20, event 3dd2ed5c): WALLET-LEDGER's 'seven provisioned mailboxes'
line and sink KNOWN must never drift apart again. The KNOWN set is pinned
to the ledger roster, every local-part in it is driven through the REAL
handler classes single-RCPT (RCPT 250 -> DATA 250 -> exactly one message
under <mailroot>/<local>/new), case-folded addresses land lowercased, and
unknown addresses stay refused 550. A roster change must therefore land
consciously: ledger row + KNOWN + this pin, together.

Scope fence: multi-RCPT acceptance is NOT tested here — that is #141's
test_sink_multircpt.py territory (red on main by design until #141 lands).
The aiosmtpd import stub below is composed from that file at
zcode/bmailroom-candidate-02 tip 00b999bb.
"""
import asyncio
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


EXPECTED_LOCALS = (
    "bgrokbot",       # bMAILroom routing 2026-09-20 (this slice)
    "bclaude",
    "bfuzz",
    "bqueenbee",
    "bzcode",
    "claude-code",
    "honeybee",
)


class FakeEnvelope:
    def __init__(self):
        self.rcpt_tos = []
        self.original_content = b""
        self.content = ""


def run(coro):
    return asyncio.run(coro)


class SinkKnownRosterTest(unittest.TestCase):
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
        return run(self.sink.handle_RCPT(None, None, env, address, None))

    def _data(self, env, body=b"Subject: roster gate\r\n\r\nbody\r\n"):
        env.original_content = body
        return run(self.sink.handle_DATA(None, None, env))

    def test_known_set_matches_ledger_roster(self):
        expected = {f"{a}@{sink.DOMAIN}" for a in EXPECTED_LOCALS}
        self.assertEqual(sink.KNOWN, expected,
                         "sink KNOWN drifted from the ledger roster (docs/agents/WALLET-LEDGER.md)")

    def test_every_known_mailbox_receives(self):
        for local in EXPECTED_LOCALS:
            with self.subTest(local=local):
                env = FakeEnvelope()
                self.assertIn("250", self._rcpt(env, f"{local}@{sink.DOMAIN}"))
                self.assertIn("250", self._data(env))
                landed = list((self.mailroot / local / "new").glob("*"))
                self.assertEqual(len(landed), 1, f"{local} delivery missing")

    def test_case_folded_address_accepted(self):
        env = FakeEnvelope()
        self.assertIn("250", self._rcpt(env, "BGROKBOT@agents.skaists.buzz"))
        self.assertIn("250", self._data(env))
        landed = list((self.mailroot / "bgrokbot" / "new").glob("*"))
        self.assertEqual(len(landed), 1, "case-folded RCPT must deliver into the lowercase Maildir")

    def test_unknown_recipient_refused_550(self):
        env = FakeEnvelope()
        self.assertEqual(self._rcpt(env, "nobody@agents.skaists.buzz"), "550 no such agent here")
        self.assertEqual(self._rcpt(env, "skaists@agents.skaists.buzz"), "550 no such agent here")


if __name__ == "__main__":
    unittest.main(verbosity=2)
