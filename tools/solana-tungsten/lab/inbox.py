"""Durable fixture inbox. Queue identity is not proof or payment authority.

SQLite atomically binds (authenticated transport sender, logical ID) to exact
payload bytes. Replays can re-read pending work, but never enqueue a new job.
Processing/settlement remains a separate operation with its own outbox.
"""
import hashlib
import sqlite3


class Inbox:
    def __init__(self, path):
        self.db = sqlite3.connect(path, isolation_level=None, timeout=10)
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('CREATE TABLE IF NOT EXISTS inbox ('
                        'sender TEXT NOT NULL, logical_id TEXT NOT NULL, digest BLOB NOT NULL,'
                        'payload BLOB NOT NULL, PRIMARY KEY(sender, logical_id))')

    def receive(self, sender, logical_id, payload):
        if not sender or not logical_id or len(logical_id) > 128 or len(payload) > 1_048_576:
            raise ValueError('invalid or oversized inbox envelope')
        digest = hashlib.sha256(payload).digest()
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row = self.db.execute('SELECT digest,payload FROM inbox WHERE sender=? AND logical_id=?',
                                  (sender,logical_id)).fetchone()
            if row is not None:
                if row != (digest,payload):
                    raise ValueError('logical ID payload conflict')
                self.db.execute('COMMIT')
                return False
            self.db.execute('INSERT INTO inbox VALUES (?,?,?,?)',(sender,logical_id,digest,payload))
            self.db.execute('COMMIT')
            return True
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def payload(self, sender, logical_id):
        row = self.db.execute('SELECT payload FROM inbox WHERE sender=? AND logical_id=?',
                              (sender,logical_id)).fetchone()
        if row is None:
            raise KeyError(logical_id)
        return row[0]

    def count(self):
        return self.db.execute('SELECT count(*) FROM inbox').fetchone()[0]

    def close(self):
        self.db.close()
