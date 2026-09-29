#!/usr/bin/env python3
"""test_import_from_triage.py — synthetic proof of the cutover importer.

Five laws (R2a, 3f8101cb) plus the 0b0b58cf addendum fixture, against a
fixture OLD database built on the deployed triage schema (mail: digest PK,
status, attempts, next_attempt...; budget: day, calls) — no real mail, no
network, no box:

  1. terminal rows stay terminal and send no backfill notice;
  2. pending rows resume and respect backoff and the three-attempt cap;
  3. a restart (re-run of the importer) is idempotent;
  4. the same-day budget carries over;
  5. interval mail (mtime >= boundary) stays eligible;
  6. ADDENDUM: a pre-boundary bclaude message missing from the old db is
     imported as pending draft work — never discarded as backfill, never
     retroactively notified.
"""
import hashlib
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_from_triage  # noqa: E402
import mailgate  # noqa: E402
from store import Store  # noqa: E402

OLD_SCHEMA = """
CREATE TABLE mail (
  digest TEXT PRIMARY KEY, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt REAL NOT NULL DEFAULT 0, result TEXT, error TEXT, updated REAL NOT NULL);
CREATE TABLE budget (day TEXT PRIMARY KEY, calls INTEGER NOT NULL);
"""
RAW_TERM = b"From: x@example.org\r\nSubject: terminal fixture\r\n\r\nbody\r\n"
RAW_PENDING = b"From: x@example.org\r\nSubject: pending fixture\r\n\r\nbody\r\n"
RAW_UNCLAIMED = b"From: x@example.org\r\nSubject: unclaimed fixture\r\n\r\nbody\r\n"
RAW_INTERVAL = b"From: x@example.org\r\nSubject: interval fixture\r\n\r\nbody\r\n"
D_TERM = hashlib.sha256(RAW_TERM).hexdigest()
D_PENDING = hashlib.sha256(RAW_PENDING).hexdigest()
D_UNCLAIMED = hashlib.sha256(RAW_UNCLAIMED).hexdigest()
D_INTERVAL = hashlib.sha256(RAW_INTERVAL).hexdigest()
DAY = __import__("datetime").datetime.fromtimestamp(1_800_000_000, __import__("datetime").timezone.utc).date().isoformat()


def build_old_db(path, now):
    db = sqlite3.connect(path)
    db.executescript(OLD_SCHEMA)
    db.execute("INSERT INTO mail VALUES(?,?,?,?,?,?,?)", (D_TERM, "drafted", 1, 0.0, "{}", None, now))
    db.execute("INSERT INTO mail VALUES(?,?,?,?,?,?,?)", (D_PENDING, "retry", 2, now + 300, None, "HTTPError", now))
    db.execute("INSERT INTO budget VALUES(?,?)", (DAY, 17))
    db.commit()
    db.close()


def plant(root, raw, name, mtime):
    for sub in ("new", "cur", "tmp"):
        (root / "bclaude" / sub).mkdir(parents=True, exist_ok=True)
    p = root / "bclaude" / "new" / name
    p.write_bytes(raw)
    os.utime(p, (mtime, mtime))


class ImportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.root = self.base / "mail"
        self.state = self.base / "state"
        self.old_db = self.base / "old" / "triage.sqlite3"
        self.old_db.parent.mkdir(parents=True)
        self.now = 1_800_000_000.0
        self.boundary = self.now - 600
        build_old_db(self.old_db, self.now)
        plant(self.root, RAW_TERM, "term", self.now - 700)
        plant(self.root, RAW_PENDING, "pend", self.now - 700)
        plant(self.root, RAW_UNCLAIMED, "uncl", self.now - 650)  # ADDENDUM: absent from old db
        plant(self.root, RAW_INTERVAL, "intr", self.now - 60)    # interval: during the pause

    def tearDown(self):
        self.tmp.cleanup()

    def _import(self):
        return import_from_triage.import_from_triage(self.old_db, self.state, self.boundary,
                                                     self.root / "bclaude", now=self.now)

    def test_queue_mapping_exact(self):
        summary = self._import()
        self.assertEqual(summary["terminal"], 1)
        self.assertEqual(summary["pending"], 1)
        self.assertEqual(summary["unclaimed_bclaude"], 1)
        store = Store(self.state)
        try:
            # 1. terminal stays terminal, no notice
            row = store.mail_row("bclaude", D_TERM)
            self.assertEqual((row[0], row[1]), ("drafted", "legacy_pre_cutover"))
            # 2. pending resumes with preserved attempts + backoff
            row = store.mail_row("bclaude", D_PENDING)
            self.assertEqual((row[0], row[1]), ("received", "none"))
            self.assertEqual(store.db.execute("SELECT attempts,next_attempt FROM mail WHERE digest=?",
                                              (D_PENDING,)).fetchone(), (2, self.now + 300))
            # 6. unclaimed pre-boundary bclaude = pending draft work, no notice
            row = store.mail_row("bclaude", D_UNCLAIMED)
            self.assertEqual((row[0], row[1]), ("received", "legacy_pre_cutover"))
            # 5. interval mail has NO imported row (fully eligible via epoch)
            self.assertIsNone(store.mail_row("bclaude", D_INTERVAL))
            # 4. budget carries
            self.assertEqual(store.budget_used(DAY), 17)
            # epoch = boundary
            self.assertEqual(store.epoch, self.boundary)
        finally:
            store.close()

    def test_restart_idempotent(self):
        first = self._import()
        second = self._import()
        self.assertTrue(second["idempotent_rerun"])
        store = Store(self.state)
        try:
            self.assertEqual(store.count_mail(), 3)
            self.assertEqual(store.budget_used(DAY), 17)
            self.assertEqual(store.epoch, self.boundary)
        finally:
            store.close()

    def test_scan_respects_mapping(self):
        self._import()
        roster = {"mailboxes": {"bclaude": {"npub": None, "binding": "unverified"}}}
        calls = []

        def drafting(text):
            calls.append(text)
            return {"category": "other", "summary": "s", "draft": ""}

        counts = mailgate.scan(self.root, self.state, resolved_roster=roster, call=drafting,
                               limit=4, now=self.now + 601)  # past the preserved backoff window
        store = Store(self.state)
        try:
            # 1. terminal: not re-drafted
            self.assertEqual(store.mail_row("bclaude", D_TERM)[0], "drafted")
            # 6. unclaimed: DRAFTED (pending draft work honored)
            self.assertEqual(store.mail_row("bclaude", D_UNCLAIMED)[0], "drafted")
            # no retroactive notices anywhere (unverified binding + legacy holds)
            self.assertEqual(len(store.events()), 0)
            # 2. pending: backoff elapsed at now+601 -> drafted too
            self.assertEqual(store.mail_row("bclaude", D_PENDING)[0], "drafted")
            # 5. interval: processed fully
            self.assertEqual(store.mail_row("bclaude", D_INTERVAL)[0], "drafted")
            self.assertEqual(len(calls), 3, f"drafting calls: {len(calls)}")
        finally:
            store.close()

    def test_pending_backoff_and_cap_carry(self):
        self._import()
        roster = {"mailboxes": {"bclaude": {"npub": None, "binding": "unverified"}}}
        n = {"n": 0}

        def drafting(text):
            n["n"] += 1
            raise RuntimeError("synthetic model failure")

        # inside the preserved backoff window: no call for the PENDING row
        # (the interval + unclaimed rows draft on this pass; pending does not)
        mailgate.scan(self.root, self.state, resolved_roster=roster, call=drafting, now=self.now + 100)
        self.assertEqual(n["n"], 2, "interval+unclaimed draft; pending must stay in backoff")
        # the unclaimed row drafted (or failed) on pass 1 — check pending row specifically
        store = Store(self.state)
        try:
            self.assertEqual(store.db.execute("SELECT attempts FROM mail WHERE digest=?", (D_PENDING,)).fetchone()[0], 2,
                             "pending attempts must not advance inside the backoff window")
        finally:
            store.close()
        # after backoff: attempts 3 -> failure path (cap at >3)
        mailgate.scan(self.root, self.state, resolved_roster=roster, call=drafting, now=self.now + 400)
        store = Store(self.state)
        try:
            row = store.mail_row("bclaude", D_PENDING)
            self.assertEqual(row[0], "failed")
            self.assertEqual(row[2], 3)
        finally:
            store.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
