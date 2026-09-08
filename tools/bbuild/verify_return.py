#!/usr/bin/env python3
"""Independently rerun returned code on the VPS before publication is allowed."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

import broker
import worker


def main():
    os.umask(0o077)
    with open(broker.ROOT / "broker.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for job in broker.jobs():
            if job["status"] != "returned":
                continue
            try:
                validator = hashlib.sha256(Path(__file__).with_name("acceptance_mail_attachments.py").read_bytes()).hexdigest()
                if validator != job["validator_hash"]:
                    raise ValueError("validator_version_changed")
                commit = broker.valid_sha(job["commit"])
                tree = broker.ROOT / ("wt-verifier-" + broker.valid_id(job["id"]) + "-" + commit[:8])
                if tree.is_symlink():
                    raise ValueError("verification_path")
                if not tree.exists():
                    broker.git("worktree", "add", "--quiet", "--detach", str(tree), commit)
                actual = worker.checked(["git", "rev-parse", "HEAD"], cwd=tree).decode().strip()
                if actual != commit:
                    raise ValueError("verification_commit_changed")
                checks = []
                for name, command in [("mail-suite", ["/usr/bin/python3", "scripts/buzz-mail/test_triage.py"]),
                                      ("attachment-regression", ["/usr/bin/python3", "/acceptance.py"])]:
                    result = worker.sandbox(tree, command)
                    checks.append({"check": name, "exit": result.returncode,
                                   "output": (result.stdout + result.stderr).decode(errors="replace")[-12000:]})
                job["verification"] = {"host": "vps", "at": time.time(), "commit": commit,
                                       "validator_hash": validator, "checks": checks}
                if any(check["exit"] != 0 for check in checks):
                    raise ValueError("vps_checks_failed")
                job["status"] = "verified"
                job.pop("error", None)
                broker.save(job)
                broker.notify(job, "verified", f"bBUILD {job['id']}: the VPS independently passed the mail suite and attachment regression for {commit[:12]}. Ready for Codex review/publication.")
            except Exception as error:
                if job.get("status") != "verified":
                    job.update(status="needs_attention", error=type(error).__name__)
                    broker.save(job)
                raise
            print(json.dumps(broker.public_status(job)))
            return


if __name__ == "__main__":
    main()
