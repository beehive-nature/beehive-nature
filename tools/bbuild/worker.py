#!/usr/bin/env python3
"""On-demand Linux/WSL worker. Pull one reviewed recipe over authenticated SSH.

The model runs on the VPS. This worker contributes actual CPU/RAM for tests and
Git work. Test code sees a read-only worktree, fresh /tmp, no home, no network,
and no inherited secrets. A user-systemd unit supplies the resource/session cap.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import uuid

from recipe import PATH, RECIPE, REPO_URL, apply, valid_id, valid_sha

STATE = Path(os.environ.get("BBUILD_WORKER_STATE", str(Path.home() / ".local/share/bnr-build")))
HERE = Path(__file__).resolve().parent


def run(args, cwd=None, timeout=120, data=None, env=None):
    result = subprocess.run(args, cwd=cwd, input=data, capture_output=True, timeout=timeout, env=env)
    return result


def checked(args, **kwargs):
    result = run(args, **kwargs)
    if result.returncode:
        raise RuntimeError("command_failed:" + Path(args[0]).name)
    return result.stdout


class Broker:
    def __init__(self, directory, worker="laptop"):
        self.worker = worker
        self.socket = directory / "ssh-control"
        self.prefix = ["ssh", "-S", str(self.socket), "-o", "ControlMaster=auto",
                       "-o", "ControlPersist=30", "-o", "BatchMode=yes",
                       "-o", "StrictHostKeyChecking=yes", "-o", "ForwardAgent=no",
                       "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15",
                       "-o", "ServerAliveCountMax=2", "oracle"]

    def call(self, action, data=None, seconds=None):
        if action not in {"claim", "finish"}:
            raise ValueError("broker_action")
        # These argv values are constants or validated decimal integers. No job
        # text, model output or email is interpolated into a remote shell command.
        cmd = ([sys.executable, str(HERE / "broker.py"), action] if self.worker == "vps"
               else [*self.prefix, "python3", "/opt/bnr-build/broker.py", action])
        if action == "claim":
            if not 1 <= seconds <= 600:
                raise ValueError("lease_limit")
            cmd += ["--worker", self.worker, "--seconds", str(seconds)]
        raw = checked(cmd, timeout=120 if action == "finish" else 45, data=json.dumps(data).encode() if data else None)
        return json.loads(raw)

    def close(self):
        if self.worker == "laptop":
            run(["ssh", "-S", str(self.socket), "-O", "exit", "-o", "BatchMode=yes", "oracle"], timeout=10)


def sandbox(worktree, command, timeout=120, extra_env=None):
    cmd = [os.environ.get("BBUILD_BWRAP", "bwrap"), "--unshare-all", "--unshare-user", "--disable-userns", "--die-with-parent", "--new-session",
           "--ro-bind", "/usr", "/usr", "--ro-bind", "/lib", "/lib"]
    if Path("/lib64").exists():
        cmd += ["--ro-bind", "/lib64", "/lib64"]
    cmd += ["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
            "--ro-bind", str(worktree), "/work",
            "--ro-bind", str(HERE / "acceptance_mail_attachments.py"), "/acceptance.py",
            "--chdir", "/work", "--clearenv", "--setenv", "PATH", "/usr/bin:/bin",
            "--setenv", "HOME", "/tmp", "--setenv", "TMPDIR", "/tmp",
            "--setenv", "PYTHONDONTWRITEBYTECODE", "1", "--", *command]
    return run(cmd, timeout=timeout, env=extra_env)


def prepare_tree(job):
    valid_id(job["id"])
    valid_sha(job["base"])
    if job["recipe"] != RECIPE or job["worker"] not in {"laptop", "vps"}:
        raise ValueError("unknown_recipe_or_worker")
    cache = STATE / "repo"
    if not cache.exists():
        checked(["git", "init", "--bare", "--quiet", str(cache)])
    if run(["git", "-C", str(cache), "cat-file", "-e", job["base"] + "^{commit}"]).returncode:
        checked(["git", "-C", str(cache), "fetch", "--quiet", "--depth=1", REPO_URL, job["base"]], timeout=180)
    suffix = uuid.uuid4().hex[:8]
    tree = STATE / ("wt-" + job["worker"] + "-" + job["id"] + "-" + suffix)
    # A local attempt branch prevents a crashed attempt from occupying the next
    # lease's branch. The exported branch is created only after tests pass.
    branch = "codex/bbuild-attempt/" + job["id"] + "-" + suffix
    checked(["git", "-C", str(cache), "worktree", "add", "--quiet", "-b", branch, str(tree), job["base"]])
    return tree


def perform(job, workdir):
    start = time.monotonic()
    validator_hash = hashlib.sha256((HERE / "acceptance_mail_attachments.py").read_bytes()).hexdigest()
    if job.get("validator_hash") != validator_hash:
        raise ValueError("validator_version_changed")
    if job.get("authoring") not in {"local Qwen2.5-3B", "Codex supervisor"}:
        raise ValueError("authoring_missing")
    tree = prepare_tree(job)
    checks = []
    logs = []
    # Prove isolation with a harmless canary and a distinct network namespace.
    canary = STATE / "private-canary"
    canary.write_text("synthetic boundary marker")
    os.chmod(canary, 0o600)
    host_net = os.stat("/proc/self/ns/net").st_ino
    probe = ("import os,pathlib,subprocess; "
             f"assert not pathlib.Path({str(canary)!r}).exists(); "
             "assert 'BBUILD_SECRET_CANARY' not in os.environ; "
             f"assert os.stat('/proc/self/ns/net').st_ino != {host_net}; "
             "assert not pathlib.Path('/run/credentials').exists()\n"
             "try:\n pathlib.Path('/work/.sandbox-write-probe').write_text('fixture')\n"
             "except OSError:\n pass\n"
             "else:\n raise AssertionError('worktree writable')\n"
             "assert subprocess.run(['/usr/bin/unshare','--user','/usr/bin/true'], capture_output=True).returncode != 0\n"
             "print('sandbox-boundaries-pass')")
    env = {**os.environ, "BBUILD_SECRET_CANARY": "synthetic-not-a-real-secret"}
    boundary = sandbox(tree, ["/usr/bin/python3", "-c", probe], extra_env=env)
    if boundary.returncode:
        raise RuntimeError("sandbox_boundary_failed")
    before = sandbox(tree, ["/usr/bin/python3", "/acceptance.py"])
    logs.append({"check": "baseline-regression", "exit": before.returncode,
                 "output": (before.stdout + before.stderr).decode(errors="replace")[-12000:]})
    # A setup/import failure is not evidence that the regression reproduced.
    if before.returncode == 0 or b"AssertionError" not in before.stderr or b"ATTACHMENT_PRIVATE" not in before.stderr:
        raise RuntimeError("baseline_regression_not_reproduced")
    checks.append("baseline-regression-red")
    apply(tree, job["old_hash"], job["replacement"])
    for name, command in [("mail-suite-pass", ["/usr/bin/python3", "scripts/buzz-mail/test_triage.py"]),
                          ("attachment-regression-pass", ["/usr/bin/python3", "/acceptance.py"])]:
        result = sandbox(tree, command)
        logs.append({"check": name, "exit": result.returncode,
                     "output": (result.stdout + result.stderr).decode(errors="replace")[-12000:]})
        if result.returncode:
            (workdir / "checks.json").write_text(json.dumps(logs))
            return {"id": job["id"], "lease_token": job["lease_token"], "ok": False, "checks": checks}
        checks.append(name)
    checks.append("sandbox-boundaries-pass")
    changed = checked(["git", "diff", "--name-only"], cwd=tree).decode().strip()
    if changed != PATH:
        raise RuntimeError("unexpected_worktree_changes")
    checked(["git", "diff", "--check"], cwd=tree)
    # Retain the estate's existing author identity and actual hooks; name the
    # local-model worker in the message instead of claiming a manual code edit.
    checked(["git", "config", "user.name", "loVis waTer"], cwd=tree)
    checked(["git", "config", "user.email", "loviswater44@gmail.com"], cwd=tree)
    checked(["git", "config", "core.hooksPath", ".githooks"], cwd=tree)
    checked(["git", "add", "--", PATH], cwd=tree)
    message = ("mail: exclude attached MIME subtrees from local triage\n\n"
               + job["authoring"] + " supplied the extract-function repair under the reviewed\n"
               "mail-attachment-boundary-v1 recipe. The worker reproduced the existing\n"
               "attachment leak, then passed the mail suite and independent attachment\n"
               "regression in a read-only filesystem/network-isolated test sandbox.\n\n"
               "Job: " + job["id"] + "\n"
               "Worker: " + job["worker"] + "; model: VPS qwen2.5-3b-instruct through the meter.\n"
               "Generated by the local bBUILD worker, coordinated by Codex.\n"
               "No email sent, no deployment, no wallet or production mutation.\n")
    message_file = workdir / "commit-message.txt"
    message_file.write_text(message)
    export_ref = "refs/heads/codex/bbuild/" + job["id"]
    # If a worker committed before a delivery crash, rerun the checks but reuse
    # that exact commit after verifying parent and content. Never force a ref.
    previous = run(["git", "show-ref", "--verify", "--hash", export_ref], cwd=tree)
    if previous.returncode == 0:
        commit = previous.stdout.decode().strip()
        parent = checked(["git", "rev-parse", commit + "^"], cwd=tree).decode().strip()
        content = checked(["git", "show", commit + ":" + PATH], cwd=tree).decode()
        paths = checked(["git", "diff", "--name-only", job["base"], commit], cwd=tree).decode().strip()
        if parent != job["base"] or content != (tree / PATH).read_text() or paths != PATH:
            raise RuntimeError("existing_export_requires_review")
        logs.append({"check": "commit-reuse-after-retest", "exit": 0})
    else:
        commit_result = checked(["git", "commit", "-F", str(message_file)], cwd=tree)
        logs.append({"check": "commit-hooks", "exit": 0, "output": commit_result.decode(errors="replace")[-5000:]})
        commit = checked(["git", "rev-parse", "HEAD"], cwd=tree).decode().strip()
        checked(["git", "update-ref", export_ref, commit, "0" * 40], cwd=tree)
    bundle = workdir / "result.bundle"
    checked(["git", "bundle", "create", str(bundle), job["base"] + ".." + export_ref], cwd=tree)
    (workdir / "checks.json").write_text(json.dumps(logs, indent=2))
    return {"id": job["id"], "lease_token": job["lease_token"], "ok": True,
            "checks": checks, "validator_hash": validator_hash, "commit": commit, "seconds": round(time.monotonic() - start, 2),
            "bundle": base64.b64encode(bundle.read_bytes()).decode()}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lease", type=int, default=580)
    parser.add_argument("--worker", choices=["laptop", "vps"], default="laptop")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if not 60 <= args.lease <= 600:
        raise ValueError("lease_limit")
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    workdir = Path(tempfile.mkdtemp(prefix="session-", dir=STATE))
    deadline = time.monotonic() + args.lease
    broker = Broker(workdir, args.worker)
    try:
        while deadline - time.monotonic() > 90:
            job = broker.call("claim", seconds=min(600, int(deadline - time.monotonic())))
            if job is None:
                if args.once:
                    return
                time.sleep(10)
                continue
            print(json.dumps({"job": job["id"], "state": "leased", "worker": args.worker}), flush=True)
            try:
                result = perform(job, workdir)
            except Exception as error:
                print(json.dumps({"job": job["id"], "error": type(error).__name__, "reason": str(error)[:100]}), flush=True)
                result = {"id": job["id"], "lease_token": job["lease_token"], "ok": False, "checks": []}
            private_result = workdir / "return.json"
            private_result.write_text(json.dumps(result))
            # If a network failure leaves delivery uncertain, retain the exact
            # return for operator retry with the same fencing token and commit.
            print(json.dumps(broker.call("finish", data=result)), flush=True)
            if not result.get("ok"):
                raise SystemExit(1)
            return
        print(json.dumps({"state": "lease_expired_idle"}), flush=True)
    finally:
        broker.close()


if __name__ == "__main__":
    main()
