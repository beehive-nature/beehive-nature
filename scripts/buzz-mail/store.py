#!/usr/bin/env python3
"""store.py — durable state for the bMAILroom candidate (sqlite, one file).

Ported law from the hash-verified triage baseline (d9ff30d6):
  - claim-before-side-effect: a row is committed BEFORE any external
    effect (publish attempt, model call), so a crash retries from state
    instead of duplicating effects;
  - the db holds NO mail content: digests, statuses, counts and pointers
    only. Message bytes live where the sink put them (the Maildir), draft
    bytes live under state/drafts/ as files with 0600.
  - state directory is 0700, db file 0600.

DEDUPE HORIZON (coordinator correction 1e18cbf8 #1): the mail table is
keyed on (mailbox, digest) — the same CONTENT delivered to the same
RECIPIENT local is one row forever; the same content delivered to two
different recipients is two rows. Keying on digest alone silently undid
the sink's multi-RCPT fix one layer down. The outbox carries the same
(mailbox, digest) uniqueness: one signed event per mail per recipient,
so a resumed or retried pass can never mint a second event for the same
delivery.

RESUME, DON'T SKIP: mail rows with notify='none' are INCOMPLETE (crash
between insert and notification completion) and are re-entered by the
next scan; the outbox lookup prevents any re-sign (stored bytes only).
"""
import os
import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS mail (
  mailbox TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL,
  notify TEXT NOT NULL DEFAULT 'none', result TEXT, error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt REAL NOT NULL DEFAULT 0,
  updated REAL NOT NULL,
  PRIMARY KEY (mailbox, digest));
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, mailbox TEXT NOT NULL, digest TEXT NOT NULL,
  recipient TEXT NOT NULL, event_json TEXT NOT NULL, status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL, updated REAL NOT NULL,
  UNIQUE (mailbox, digest));
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY, from_local TEXT NOT NULL, to_addr TEXT NOT NULL,
  subject_sha256 TEXT NOT NULL, status TEXT NOT NULL, path TEXT,
  created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, calls INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


class Store:
    def __init__(self, state_dir):
        self.state = Path(state_dir)
        self.state.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.state, 0o700)
        self.db = sqlite3.connect(self.state / "mailgate.sqlite3")
        self.db.executescript(SCHEMA)
        if os.name == "posix":
            os.chmod(self.state / "mailgate.sqlite3", 0o600)
        self.db.commit()

    def close(self):
        self.db.close()

    # ---- meta ----
    def meta_get(self, key, default=None):
        row = self.db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row[0] if row else default

    def meta_set(self, key, value):
        with self.db:
            self.db.execute("INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))

    @property
    def epoch(self):
        """First-run cutoff: mail older than the service's first start is never
        backfill-notified (deploy-time courtesy; tests may set 0)."""
        value = self.meta_get("epoch")
        if value is None:
            value = time.time()
            self.meta_set("epoch", value)
        return float(value)

    # ---- mail rows (keyed (mailbox, digest); notify='none' means INCOMPLETE) ----
    def mail_row(self, mailbox, digest):
        return self.db.execute("SELECT status,notify,attempts FROM mail WHERE mailbox=? AND digest=?", (mailbox, digest)).fetchone()

    def insert_mail(self, mailbox, digest, status, now=None):
        now = time.time() if now is None else now
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO mail(mailbox,digest,status,notify,updated) VALUES(?,?,?,?,?)",
                            (mailbox, digest, status, "none", now))

    def set_mail(self, mailbox, digest, status=None, notify=None, result=None, error=None, attempts=None, next_attempt=None, now=None):
        now = time.time() if now is None else now
        sets, args = ["updated=?"], [now]
        if status is not None:
            sets.append("status=?"); args.append(status)
        if notify is not None:
            sets.append("notify=?"); args.append(notify)
        if result is not None:
            sets.append("result=?"); args.append(result)
        if error is not None:
            sets.append("error=?"); args.append(error)
        if attempts is not None:
            sets.append("attempts=?"); args.append(attempts)
        if next_attempt is not None:
            sets.append("next_attempt=?"); args.append(next_attempt)
        args.extend([mailbox, digest])
        with self.db:
            self.db.execute(f"UPDATE mail SET {','.join(sets)} WHERE mailbox=? AND digest=?", args)

    def count_mail(self, status=None, notify=None, mailbox=None):
        q = "SELECT COUNT(*) FROM mail"
        conds, args = [], []
        if status is not None:
            conds.append("status=?"); args.append(status)
        if notify is not None:
            conds.append("notify=?"); args.append(notify)
        if mailbox is not None:
            conds.append("mailbox=?"); args.append(mailbox)
        if conds:
            q += " WHERE " + " AND ".join(conds)
        return self.db.execute(q, args).fetchone()[0]

    def mail_digests(self, mailbox=None, notify=None):
        q = "SELECT mailbox,digest FROM mail"
        conds, args = [], []
        if mailbox is not None:
            conds.append("mailbox=?"); args.append(mailbox)
        if notify is not None:
            conds.append("notify=?"); args.append(notify)
        if conds:
            q += " WHERE " + " AND ".join(conds)
        return self.db.execute(q, args).fetchall()

    # ---- outbox (signed bytes before first publish; ONE event per (mailbox, digest)) ----
    def enqueue_event(self, event, mailbox, recipient, digest, now=None):
        import json as _json
        now = time.time() if now is None else now
        payload = _json.dumps(event, ensure_ascii=False, separators=(",", ":"))
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO outbox(id,mailbox,digest,recipient,event_json,status,attempts,created,updated) "
                            "VALUES(?,?,?,?,?,?,?,?,?)",
                            (event["id"], mailbox, digest, recipient, payload, "pending", 0, now, now))

    def event_for_mail(self, mailbox, digest):
        row = self.db.execute("SELECT id FROM outbox WHERE mailbox=? AND digest=?", (mailbox, digest)).fetchone()
        return row[0] if row else None

    def event_row(self, event_id):
        return self.db.execute("SELECT event_json,status,attempts FROM outbox WHERE id=?", (event_id,)).fetchone()

    def event_bytes(self, event_id):
        row = self.event_row(event_id)
        return row[0].encode("utf-8") if row else None

    def set_event_status(self, event_id, status, bump_attempts=True, now=None):
        now = time.time() if now is None else now
        with self.db:
            if bump_attempts:
                self.db.execute("UPDATE outbox SET status=?,attempts=attempts+1,updated=? WHERE id=?", (status, now, event_id))
            else:
                self.db.execute("UPDATE outbox SET status=?,updated=? WHERE id=?", (status, now, event_id))

    def events(self, status=None):
        q = "SELECT id,mailbox,digest,recipient,event_json,status,attempts FROM outbox"
        args = []
        if status is not None:
            q += " WHERE status=?"; args.append(status)
        return self.db.execute(q + " ORDER BY created", args).fetchall()

    # ---- drafts (outbound seam; pointers + subject hash only) ----
    def insert_draft(self, draft_id, from_local, to_addr, subject_sha256, status, path, now=None):
        now = time.time() if now is None else now
        with self.db:
            self.db.execute("INSERT INTO drafts VALUES(?,?,?,?,?,?,?)",
                            (draft_id, from_local, to_addr, subject_sha256, status, path, now))

    def drafts(self, status=None):
        q = "SELECT id,from_local,to_addr,subject_sha256,status,path FROM drafts"
        args = []
        if status is not None:
            q += " WHERE status=?"; args.append(status)
        return self.db.execute(q + " ORDER BY created", args).fetchall()

    # ---- budget (ported model-stage caps) ----
    def budget_used(self, day):
        row = self.db.execute("SELECT calls FROM budget WHERE day=?", (day,)).fetchone()
        return row[0] if row else 0

    def budget_claim(self, day):
        with self.db:
            self.db.execute("INSERT INTO budget VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1", (day,))
