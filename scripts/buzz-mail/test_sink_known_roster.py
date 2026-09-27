#!/usr/bin/env python3
"""test_sink_known_roster.py — the roster gate, three-way: ledger <-> KNOWN <-> delivery.

v2 (laborer defect finding, ruling d16d215c): v1 pinned sink.KNOWN against a
hand-copied EXPECTED_LOCALS tuple inside this file — it caught KNOWN<->test
drift but could never catch ledger<->KNOWN drift, which is the six-vs-seven
defect class the gate was born from. v2 PARSES the roster out of
docs/agents/WALLET-LEDGER.md (THE RULED ROSTER table, mail column) and
compares three ways:

  1. ledger roster set == sink.KNOWN set   (drift in EITHER direction reddens:
                                            a ledger row without a KNOWN entry
                                            fails, and a KNOWN entry without a
                                            ledger row fails)
  2. every ledger local delivers single-RCPT (RCPT 250 -> DATA 250 -> exactly
                                            one file under <mailroot>/<local>/new)
  3. unknown addresses stay refused 550

Non-vacuity (PROVE requirement 2, ruling d16d215c): the gate prints WHICH
ledger file it read (path + byte count), HOW MANY locals it drove, and asserts
the parse is non-empty — an empty or stubbed roster cannot pass silently.

Ledger path override: BUZZ_MAIL_LEDGER env var, so a mutation harness can point
the gate at a mutated copy; the printed path is the record of what was read.

Import mode (PROVE requirement 3): the banner prints whether aiosmtpd is REAL
or STUBbed, so both environments are distinguishable in every run's output.
The stub itself is composed from #141's test_sink_multircpt.py at
zcode/bmailroom-candidate-02 tip 00b999bb.

Scope fence: multi-RCPT acceptance is #141's test territory (red on main by
design until #141 lands) — not tested here.
"""
import asyncio
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import aiosmtpd  # noqa: F401
    from aiosmtpd.controller import Controller  # noqa: F401
    from aiosmtpd.smtp import SMTP, Envelope, Session  # noqa: F401
    AIOSMTPD_MODE = "real"
except ImportError:  # stub: the handler logic needs only the names to exist
    import types
    AIOSMTPD_MODE = "stub"
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

REPO_ROOT = Path(__file__).resolve().parents[2]
LEDGER = Path(os.environ.get(
    "BUZZ_MAIL_LEDGER",
    str(REPO_ROOT / "docs" / "agents" / "WALLET-LEDGER.md")))
ROSTER_HEADING = "## THE RULED ROSTER"
MAIL_RE = re.compile(r"^([a-z0-9][a-z0-9-]*)@agents\.skaists\.buzz$")


def parse_roster(text):
    """Return the ordered [(local, address)] pairs from THE RULED ROSTER table."""
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.startswith(ROSTER_HEADING):
            start = i
            break
    if start is None:
        raise AssertionError(f"heading {ROSTER_HEADING!r} not found in ledger text")
    roster = []
    for line in lines[start + 1:]:
        if line.startswith("## "):          # next section ends the roster table
            break
        if not line.lstrip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        m = MAIL_RE.match(cells[2])
        if m:
            roster.append((m.group(1), cells[2]))
    return roster


class FakeEnvelope:
    def __init__(self):
        self.rcpt_tos = []
        self.original_content = b""
        self.content = ""


def run(coro):
    return asyncio.run(coro)


class SinkKnownRosterTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger_path = LEDGER
        cls.ledger_text = cls.ledger_path.read_text(encoding="utf-8")
        cls.roster = parse_roster(cls.ledger_text)
        cls.locals_ = [loc for loc, _ in cls.roster]
        print(f"\nroster gate: ledger={cls.ledger_path} "
              f"({len(cls.ledger_text)} bytes, aiosmtpd={AIOSMTPD_MODE}) "
              f"-> {len(cls.locals_)} locals: {cls.locals_}")

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

    def test_ledger_roster_parsed_nonempty(self):
        self.assertTrue(self.locals_,
                        f"vacuous gate: zero locals parsed from {self.ledger_path}")

    def test_known_matches_ledger(self):
        ledger_set = {addr for _, addr in self.roster}
        self.assertEqual(
            sink.KNOWN, ledger_set,
            f"roster drift between {self.ledger_path} and sink.KNOWN — "
            f"ledger-only={sorted(ledger_set - sink.KNOWN)} "
            f"KNOWN-only={sorted(sink.KNOWN - ledger_set)}")

    def test_every_roster_mailbox_receives(self):
        driven = 0
        for local, addr in self.roster:
            with self.subTest(local=local):
                env = FakeEnvelope()
                self.assertIn("250", self._rcpt(env, addr))
                self.assertIn("250", self._data(env))
                landed = list((self.mailroot / local / "new").glob("*"))
                self.assertEqual(len(landed), 1, f"{local} delivery missing")
                driven += 1
        print(f"roster gate: drove {driven} locals through RCPT+DATA")
        self.assertGreater(driven, 0, "vacuous gate: delivery loop drove zero locals")

    def test_case_folded_address_accepted(self):
        local = sorted(self.locals_)[0]
        env = FakeEnvelope()
        self.assertIn("250", self._rcpt(env, f"{local.upper()}@agents.skaists.buzz"))
        self.assertIn("250", self._data(env))
        landed = list((self.mailroot / local / "new").glob("*"))
        self.assertEqual(len(landed), 1, "case-folded RCPT must deliver into the lowercase Maildir")

    def test_unknown_recipient_refused_550(self):
        env = FakeEnvelope()
        self.assertEqual(self._rcpt(env, "nobody@agents.skaists.buzz"), "550 no such agent here")
        self.assertEqual(self._rcpt(env, "skaists@agents.skaists.buzz"), "550 no such agent here")


if __name__ == "__main__":
    unittest.main(verbosity=2)
