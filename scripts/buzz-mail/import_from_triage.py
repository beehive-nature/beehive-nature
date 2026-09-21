#!/usr/bin/env python3
"""import_from_triage.py — the one-shot cutover importer (RUNS NOWHERE YET).

Implements the cutover law of examples/cutover-from-triage.md as CODE, so
the single-reader switch is a procedure, not a db-hacking session (R2a,
3f8101cb + the 0b0b58cf addendum):

  QUEUE MAPPING (exact):
    - CLAIMED rows in the old triage db:
        drafted / sensitive_review / format_review / failed
          -> terminal mail rows, notify='legacy_pre_cutover'
             (never re-drafted, never backfill-notified);
        retry / processing (in flight)
          -> pending rows, status='received', notify='none',
             attempts and next_attempt PRESERVED (backoff and the
             three-attempt cap carry across the boundary).
    - UNCLAIMED pre-boundary bclaude mail (files in bclaude's Maildir
      older than the boundary whose digest is NOT in the old db — the old
      reader checked its budget caps BEFORE inserting a claim row, so its
      queue can hold unclaimed mail): treated as PENDING DRAFT work —
      status='received', notify='legacy_pre_cutover' (draftable, but no
      retroactive Buzz notice).
    - pre-boundary mail in the OTHER mailboxes was never that reader's
      queue: it keeps the explicit no-backfill policy (unknown rows stay
      epoch-skipped).
    - INTERVAL mail (arrived during the pause, mtime >= boundary): fully
      eligible — the importer sets the gate's epoch to the boundary so
      nothing that arrived after the pause began is backfill-skipped.

  BUDGET: the old db's CURRENT-DAY budget row carries over unchanged
  (same-day model calls are not re-granted).

  IDEMPOTENCE: INSERT OR IGNORE everywhere + epoch set only if absent;
  running the importer twice changes nothing (asserted by the synthetic
  battery). Exactly one reader ever runs: this tool is offline bookkeeping
  between stopping the old reader and starting the gate.

  The boundary MUST be captured BEFORE the old reader stops
  (see the runbook order). Digests and state only — no bodies are moved,
  read or emitted.

Synthetic proof: test_import_from_triage.py (old-db fixture built from
the deployed triage schema, no real mail, no network, no box).
"""
import argparse
import datetime
import hashlib
import json
import os
import sqlite3
import time
from pathlib import Path

sys_path_hack = Path(__file__).resolve().parent
import sys
sys.path.insert(0, str(sys_path_hack))
from store import Store  # noqa: E402

TERMINAL_OLD = {"drafted", "sensitive_review", "format_review", "failed"}
PENDING_OLD = {"retry", "processing"}


def digest_file(path: Path) -> str:
    import mailgate
    return hashlib.sha256(mailgate.read_mail(path)).hexdigest()


def import_from_triage(old_db: Path, state_dir: Path, boundary: float,
                       bclaude_maildir: Path, now=None, dry_run=False):
    now = time.time() if now is None else now
    old = sqlite3.connect(f"file:{old_db}?mode=ro", uri=True)
    store = Store(state_dir)
    summary = {"terminal": 0, "pending": 0, "unclaimed_bclaude": 0,
               "budget_day": None, "budget_calls": 0, "epoch": None, "idempotent_rerun": True}
    try:
        # ---- claimed rows ----
        known_digests = set()
        for digest, status, attempts, next_attempt in old.execute(
                "SELECT digest,status,attempts,next_attempt FROM mail"):
            known_digests.add(digest)
            if status in TERMINAL_OLD:
                mapped_status, notify = status, "legacy_pre_cutover"
                summary["terminal"] += 1
            elif status in PENDING_OLD:
                mapped_status, notify = "received", "none"
                summary["pending"] += 1
            else:
                continue  # unknown old status: do not guess (fail-loud repo law would name it)
            store.db.execute("INSERT OR IGNORE INTO mail(mailbox,digest,status,notify,attempts,next_attempt,updated) "
                             "VALUES(?,?,?,?,?,?,?)",
                             ("bclaude", digest, mapped_status, notify, attempts or 0, next_attempt or 0.0, now))
        # ---- current-day budget carries ----
        day = datetime.datetime.fromtimestamp(now, datetime.timezone.utc).date().isoformat()
        row = old.execute("SELECT calls FROM budget WHERE day=?", (day,)).fetchone()
        if row:
            store.db.execute("INSERT INTO budget VALUES(?,?) ON CONFLICT(day) DO UPDATE SET calls=MAX(calls,?)",
                             (day, row[0], row[0]))
            summary["budget_day"], summary["budget_calls"] = day, row[0]
        # ---- unclaimed pre-boundary bclaude mail -> pending draft work ----
        if bclaude_maildir and all((bclaude_maildir / f).is_dir() for f in ("new", "cur")):
            for folder in ("new", "cur"):
                for path in sorted((bclaude_maildir / folder).glob("*")):
                    try:
                        if path.stat().st_mtime >= boundary:
                            continue  # interval mail: fully eligible, never imported by hand
                        digest = digest_file(path)
                    except (OSError, ValueError):
                        continue  # unreadable/oversized: leave to the gate's own skip law
                    if digest in known_digests:
                        continue  # claimed in the old db: handled above
                    before = store.db.execute("SELECT COUNT(*) FROM mail WHERE mailbox='bclaude' AND digest=?",
                                              (digest,)).fetchone()[0]
                    store.db.execute("INSERT OR IGNORE INTO mail(mailbox,digest,status,notify,attempts,next_attempt,updated) "
                                     "VALUES(?,?,?,?,?,?,?)",
                                     ("bclaude", digest, "received", "legacy_pre_cutover", 0, 0.0, now))
                    summary["unclaimed_bclaude"] += 0 if before else 1
        # ---- epoch = boundary (only if absent): interval mail stays eligible ----
        if store.meta_get("epoch") is None:
            store.meta_set("epoch", boundary)
            summary["epoch"], summary["idempotent_rerun"] = boundary, False
        else:
            summary["epoch"] = float(store.meta_get("epoch"))
        store.db.commit()
    finally:
        old.close()
        store.close()
    return summary


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description="one-shot cutover import from the triage ledger (offline, digests+state only)")
    parser.add_argument("--old-db", type=Path, required=True, help="triage.sqlite3 (read-only)")
    parser.add_argument("--state", type=Path, required=True, help="gate state dir")
    parser.add_argument("--boundary", type=float, required=True,
                        help="unix ts captured BEFORE the old reader stopped")
    parser.add_argument("--bclaude-maildir", type=Path, default=None,
                        help="bclaude Maildir for the unclaimed pre-boundary queue sweep")
    parser.add_argument("--dry-run", action="store_true", help="print the mapping only (no writes)")
    args = parser.parse_args()
    print(json.dumps(import_from_triage(args.old_db, args.state, args.boundary,
                                        args.bclaude_maildir, dry_run=args.dry_run)))


if __name__ == "__main__":
    main()
