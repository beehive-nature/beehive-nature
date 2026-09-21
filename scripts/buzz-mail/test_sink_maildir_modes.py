#!/usr/bin/env python3
"""test_sink_maildir_modes.py — mailbox privacy modes are enforced, not inherited.

Live defect (coordinator ruling 8662d27d, 2026-09-20): handle_DATA's
mkdir(parents=True, exist_ok=True) passed no mode, so auto-created Maildirs
inherited the process umask — the deployed sink runs Umask=0022 and the first
auto-created mailbox (bee-laborer) landed 0755, contradicting the sink's own
docstring fence. Message files were already 0600, so bodies stayed protected;
the leak was directory traversal — names, counts, sizes, timestamps.

The fix enforces 0700 explicitly on the mailbox dir and cur/new/tmp:
mkdir(mode=0o700) caps creation under any umask (POSIX masks with ~umask,
which can only remove bits), and the follow-up chmod enforces the mode on
pre-existing directories too (chmod is neither umask-masked nor
skipped-when-existing) — healing any wide dir on delivery.

Red-first: against pre-fix sink.py under umask 022 the asserts fail (0755);
post-fix they hold under the deployed umask 022 AND the fully permissive 000,
and a pre-created 0755 tree is healed by delivery.

Run note: mode asserts need a real POSIX filesystem — on this seat the
worktree lives on a Windows mount whose stat modes are not faithful, so the
authoritative runs copy sink.py + this file to /tmp (ext4) before executing.
The aiosmtpd import stub is composed from #141's test_sink_multircpt.py at
zcode/bmailroom-candidate-02 tip 00b999bb (same as test_sink_known_roster.py).
"""
import asyncio
import os
import stat
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


class FakeEnvelope:
    def __init__(self):
        self.rcpt_tos = []
        self.original_content = b""
        self.content = ""


def run(coro):
    return asyncio.run(coro)


class SinkMaildirModesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.mailroot = Path(self.tmp.name)
        self.sink = sink.Sink()
        self.original_mailroot = sink.MAILROOT
        sink.MAILROOT = self.mailroot
        self.original_umask = os.umask(0o022)   # the deployed sink's Umask=0022

    def tearDown(self):
        os.umask(self.original_umask)
        sink.MAILROOT = self.original_mailroot
        self.tmp.cleanup()

    def _deliver(self, local, body=b"Subject: modes\r\n\r\nbody\r\n"):
        env = FakeEnvelope()
        reply = run(self.sink.handle_RCPT(None, None, env, f"{local}@agents.skaists.buzz", None))
        self.assertIn("250", reply)
        env.original_content = body
        reply = run(self.sink.handle_DATA(None, None, env))
        self.assertIn("250", reply)

    def _assert_private(self, local):
        md = self.mailroot / local
        for d in (md, md / "cur", md / "new", md / "tmp"):
            mode = stat.S_IMODE(os.stat(d).st_mode)
            self.assertEqual(mode, 0o700,
                             f"{d} mode {oct(mode)} != 0700 (umask leak, aiosmtpd={AIOSMTPD_MODE})")
        files = list((md / "new").glob("*"))
        self.assertEqual(len(files), 1)
        fmode = stat.S_IMODE(os.stat(files[0]).st_mode)
        self.assertEqual(fmode, 0o600, "message file mode must stay 0600")

    def test_fresh_maildir_private_under_deployed_umask_022(self):
        self._deliver("bzcode")
        self._assert_private("bzcode")

    def test_fresh_maildir_private_under_fully_permissive_umask_000(self):
        os.umask(0o000)
        self._deliver("honeybee")
        self._assert_private("honeybee")

    def test_preexisting_wide_dir_healed_on_delivery(self):
        md = self.mailroot / "bfuzz"
        md.mkdir(mode=0o755)
        for sub in ("cur", "new", "tmp"):
            (md / sub).mkdir(mode=0o755)
        self._deliver("bfuzz")
        self._assert_private("bfuzz")

    # MAILROOT slice (2026-09-21): the root itself is enforced too. The
    # startup mkdir lived inline in __main__ and passed no mode, so
    # /var/mail-agents inherited the process umask (0755 under the deployed
    # Umask=0022) — the same leak class as the mailbox dirs, one level up.
    # The fix is prepare_mailroot(): mkdir(mode=0o700) + chmod heal, called
    # from __main__ — named and callable so this gate exercises the real
    # code path, not a copy of it (drift-gate law).
    def _assert_root_private(self):
        mode = stat.S_IMODE(os.stat(self.mailroot).st_mode)
        self.assertEqual(mode, 0o700,
                         f"MAILROOT mode {oct(mode)} != 0700 (umask leak at the root, aiosmtpd={AIOSMTPD_MODE})")

    def test_mailroot_private_under_deployed_umask_022(self):
        sink.prepare_mailroot()
        self._assert_root_private()

    def test_mailroot_private_under_fully_permissive_umask_000(self):
        os.umask(0o000)
        sink.prepare_mailroot()
        self._assert_root_private()

    def test_preexisting_wide_mailroot_healed(self):
        os.chmod(self.mailroot, 0o755)   # today's production state: wide root
        sink.prepare_mailroot()
        self._assert_root_private()


if __name__ == "__main__":
    unittest.main(verbosity=2)
