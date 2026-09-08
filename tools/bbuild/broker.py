#!/usr/bin/env python3
"""VPS job broker. Admission is the authenticated operator CLI, never email.

Only reviewed recipes run. Model output can replace one pinned function. The
laptop pulls leased work; no remote shell commands come from mail or the model.
"""
import argparse
import base64
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import uuid

from recipe import RECIPE, REPO_URL, PATH, INSTRUCTION, region, replacement, valid_id, valid_sha

ROOT = Path(os.environ.get("BBUILD_STATE", "/var/lib/bnr-build"))
CONFIG = Path(os.environ.get("BBUILD_CONFIG", "/etc/bnr-build/config.json"))


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = path.with_name(path.name + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(value, stream, ensure_ascii=False, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(tmp, path)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def load(job_id):
    return json.loads((ROOT / "jobs" / (valid_id(job_id) + ".json")).read_text())


def save(job):
    job["updated"] = time.time()
    atomic(ROOT / "jobs" / (valid_id(job["id"]) + ".json"), job)


def jobs():
    return [json.loads(p.read_text()) for p in sorted((ROOT / "jobs").glob("*.json"))]


def git(*args):
    result = subprocess.run(["git", "-C", str(ROOT / "repo"), *args],
                            capture_output=True, timeout=120)
    if result.returncode:
        raise RuntimeError("git_operation_failed")
    return result.stdout.decode()


def ensure_base(base):
    valid_sha(base)
    repo = ROOT / "repo"
    if not repo.exists():
        subprocess.run(["git", "init", "--bare", "--quiet", str(repo)], check=True)
    try:
        git("cat-file", "-e", base + "^{commit}")
    except RuntimeError:
        git("fetch", "--quiet", "--depth=1", REPO_URL, base)


def buzz():
    from buzz_bridge import Buzz
    config = json.loads(CONFIG.read_text())
    creds = Path(os.environ.get("CREDENTIALS_DIRECTORY", "/etc/bnr-build/credentials"))
    return Buzz(creds / "buzz.nsec", config["channel"], config["owner"])


def notify(job, phase, text):
    bridge = buzz()
    outbox = job.setdefault("outbox", {})
    if phase not in outbox:
        outbox[phase] = {"event": bridge.event(text), "delivered": False}
        save(job)  # persist the signed event before sending it
    item = outbox[phase]
    if not item["delivered"]:
        bridge.deliver(item["event"])
        item["delivered"] = True
        save(job)


def generate(old):
    creds = Path(os.environ.get("CREDENTIALS_DIRECTORY", "/etc/bnr-build/credentials"))
    key = (creds / "model.key").read_text().strip()
    schema = {"type": "object", "properties": {"replacement": {"type": "string"}},
              "required": ["replacement"], "additionalProperties": False}
    payload = {"model": "qwen2.5-3b-instruct", "temperature": 0, "max_tokens": 1400,
               "stream": False, "response_format": {"type": "json_schema", "json_schema": {
                   "name": "repair", "strict": True, "schema": schema}},
               "messages": [{"role": "system", "content": "Repair Python code and follow the supplied JSON schema exactly."},
                            {"role": "user", "content": "Existing function:\n" + old + "\n\nTask:\n" + INSTRUCTION}]}
    request = urllib.request.Request("http://172.18.0.1:8091/v1/chat/completions",
                                     data=json.dumps(payload).encode(), headers={
                                         "Authorization": "Bearer " + key,
                                         "Content-Type": "application/json"})
    # Do not permit a proxy or redirect to move source/bearer off this endpoint.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=180) as response:
        raw = response.read(65537)
    if len(raw) > 65536:
        raise ValueError("model_response_limit")
    data = json.loads(raw)
    code = replacement(json.loads(data["choices"][0]["message"]["content"]))
    usage = {k: v for k, v in data.get("usage", {}).items()
             if k in {"prompt_tokens", "completion_tokens", "total_tokens"} and type(v) is int}
    return code, usage


def public_status(job):
    return {k: job[k] for k in ("id", "status", "worker", "base", "attempts", "error", "commit", "published", "updated") if k in job}


def enqueue(job_id, base, worker):
    valid_id(job_id)
    valid_sha(base)
    path = ROOT / "jobs" / (job_id + ".json")
    if path.exists():
        job = load(job_id)
        if (job["base"], job["worker"]) != (base, worker):
            raise ValueError("job_id_scope_conflict")
        return public_status(job)
    ensure_base(base)
    source = git("show", base + ":" + PATH)
    old = region(source)
    job = {"id": job_id, "base": base, "worker": worker, "recipe": RECIPE,
           "status": "queued", "attempts": 0, "created": time.time(),
           "admission": "Codex via authenticated operator SSH; founder authorized this coding sprint",
           "old": old, "old_hash": hashlib.sha256(old.encode()).hexdigest()}
    job["validator_hash"] = hashlib.sha256(Path(__file__).with_name("acceptance_mail_attachments.py").read_bytes()).hexdigest()
    save(job)
    notify(job, "ack", f"bBUILD acknowledged {job_id}. Authorized by the founder in Codex; admitted through operator SSH. "
           f"Local Qwen will repair the mail attachment boundary; {worker} will run isolated tests. Base {base[:12]}. "
           "Email contents cannot authorize jobs.")
    return public_status(job)


def tick():
    for job in jobs():
        # Repair outbox delivery after a crash without generating a new event.
        for item in job.get("outbox", {}).values():
            if not item["delivered"]:
                buzz().deliver(item["event"])
                item["delivered"] = True
                save(job)
        if job["status"] in {"returned", "verified", "published"} and "result" not in job.get("outbox", {}):
            notify(job, "result", f"bBUILD {job['id']}: {job['worker']} returned tested commit {job['commit'][:12]}. Awaiting/reconciled with Codex publication.")
        if job["status"] == "published" and "published" not in job.get("outbox", {}):
            notify(job, "published", f"bBUILD {job['id']} published: https://github.com/beehive-nature/beehive-nature/commit/{job['published']}")
        if job["status"] == "needs_attention" and "failed" not in job.get("outbox", {}):
            notify(job, "failed", f"bBUILD {job['id']} needs attention ({job.get('error', 'retry_limit')}). No automatic publication.")
        if job["status"] not in {"queued", "preparing"}:
            continue
        if job["status"] == "preparing" and job.get("prepare_until", 0) > time.time():
            continue
        maximum = job.get("max_attempts", 2)
        if job["attempts"] >= maximum:
            job["status"] = "needs_attention"
            save(job)
            continue
        notify(job, "ack", f"bBUILD acknowledged {job['id']}. Authenticated operator job; recipe {RECIPE}.")
        job.update(status="preparing", attempts=job["attempts"] + 1, prepare_until=time.time() + 240)
        save(job)
        try:
            code, usage = generate(job["old"])
            job.update(status="prepared", replacement=code, usage=usage, authoring="local Qwen2.5-3B")
            job.pop("error", None)
        except Exception as error:
            job.update(status="needs_attention" if job["attempts"] >= maximum else "queued", error=type(error).__name__)
        save(job)
        return public_status(job)  # one generation per activation
    return {"idle": True}


def claim(worker, seconds):
    if not 1 <= seconds <= 600:
        raise ValueError("lease_limit")
    now = time.time()
    for job in jobs():
        if job["worker"] != worker or job["status"] not in {"prepared", "leased"}:
            continue
        if job["status"] == "leased" and job["lease_until"] > now:
            continue
        # A crashed worker's token becomes invalid on a replacement lease.
        job.update(status="leased", lease_token=uuid.uuid4().hex, lease_until=now + seconds)
        save(job)
        return {k: job[k] for k in ("id", "base", "worker", "recipe", "old_hash", "replacement", "lease_token", "lease_until", "validator_hash", "authoring")}
    return None


def finish(result):
    job = load(result["id"])
    if not hmac.compare_digest(str(result.get("lease_token", "")), job.get("lease_token", "")):
        raise ValueError("stale_worker_token")
    if job["status"] in {"returned", "verified", "published"} and result.get("commit") == job.get("commit"):
        return public_status(job)
    if job["status"] != "leased" or job["lease_until"] < time.time():
        raise ValueError("expired_worker_lease")
    if result.get("ok") is not True:
        job.update(status="needs_attention", error="worker_checks_failed")
        job["checks"] = result.get("checks", [])
        save(job)
        notify(job, "failed", f"bBUILD {job['id']} needs attention: worker checks failed. No commit was published.")
        return public_status(job)
    commit = valid_sha(result["commit"])
    if result.get("checks") != ["baseline-regression-red", "mail-suite-pass", "attachment-regression-pass", "sandbox-boundaries-pass"]:
        raise ValueError("required_checks_missing")
    if result.get("validator_hash") != job["validator_hash"]:
        raise ValueError("validator_version_changed")
    bundle = base64.b64decode(result["bundle"], validate=True)
    if len(bundle) > 2 * 1024 * 1024:
        raise ValueError("bundle_limit")
    artifact = ROOT / "artifacts" / (job["id"] + ".bundle")
    artifact.parent.mkdir(mode=0o700, exist_ok=True)
    artifact.write_bytes(bundle)
    git("bundle", "verify", str(artifact))
    git("fetch", "--quiet", str(artifact), "refs/heads/codex/bbuild/" + job["id"])
    if git("rev-parse", "FETCH_HEAD").strip() != commit or git("rev-parse", commit + "^").strip() != job["base"]:
        raise ValueError("bundle_commit_scope")
    if git("diff", "--name-only", job["base"], commit).strip() != PATH:
        raise ValueError("worker_modified_unapproved_paths")
    source = git("show", job["base"] + ":" + PATH)
    expected = source.replace(region(source), job["replacement"].rstrip(), 1)
    if git("show", commit + ":" + PATH) != expected:
        raise ValueError("worker_patch_changed")
    job.update(status="returned", commit=commit, checks=result["checks"], worker_seconds=result.get("seconds"))
    job.pop("error", None)
    save(job)
    notify(job, "result", f"bBUILD {job['id']}: {job['worker']} returned commit {commit[:12]}. "
           "Existing mail tests and attachment regression passed in the isolated worker. "
           "Awaiting Codex review/publication; production is unchanged.")
    return public_status(job)


def publish(job_id, commit):
    job = load(job_id)
    if job["status"] not in {"verified", "published"}:
        raise ValueError("job_not_verified")
    valid_sha(commit)
    # The commit must actually be fetchable from the fixed public repository,
    # even if its object already exists locally from the worker's private bundle.
    git("fetch", "--quiet", "--depth=1", REPO_URL, commit)
    if git("show", commit + ":" + PATH) != git("show", job["commit"] + ":" + PATH):
        raise ValueError("published_source_differs")
    job.update(status="published", published=commit)
    save(job)
    notify(job, "published", f"bBUILD {job_id} reviewed and published: https://github.com/beehive-nature/beehive-nature/commit/{commit} "
           "Local-model repair, laptop checks, and Codex review completed. Production deployment is a separate receipt.")
    return public_status(job)


def retry(job_id):
    job = load(job_id)
    if job["status"] != "needs_attention":
        raise ValueError("retry_requires_attention_state")
    job.setdefault("operator_retries", []).append({"at": time.time(), "prior_error": job.get("error"),
                                                   "prior_attempts": job["attempts"],
                                                   "reason": "operator repaired adapter; bounded retry"})
    job.update(status="queued", max_attempts=job["attempts"] + 2)
    save(job)
    return public_status(job)


def supervise(job_id, value):
    job = load(job_id)
    if job["status"] != "needs_attention":
        raise ValueError("supervision_requires_failed_job")
    code = replacement(value)
    job.setdefault("supervision", []).append({"at": time.time(), "prior_error": job.get("error"),
        "prior_replacement": job.get("replacement"), "prior_authoring": job.get("authoring", "local Qwen2.5-3B"),
        "prior_checks": job.get("checks", [])})
    job.update(status="prepared", replacement=code, authoring="Codex supervisor")
    job.pop("error", None)
    job["validator_hash"] = hashlib.sha256(Path(__file__).with_name("acceptance_mail_attachments.py").read_bytes()).hexdigest()
    save(job)
    notify(job, "supervised", f"bBUILD {job_id}: the local model's repair failed the laptop tests. "
           "Codex supplied a repair within the same pinned function scope. The worker will rerun all checks; failed proposal retained.")
    return public_status(job)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["enqueue", "tick", "claim", "finish", "status", "publish", "retry", "supervise"])
    parser.add_argument("--id")
    parser.add_argument("--base")
    parser.add_argument("--commit")
    parser.add_argument("--worker", choices=["laptop", "vps"], default="laptop")
    parser.add_argument("--seconds", type=int, default=600)
    args = parser.parse_args()
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if args.action == "status":
        print(json.dumps([public_status(j) for j in jobs()]))
        return
    with open(ROOT / "broker.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == "enqueue":
            result = enqueue(args.id, args.base, args.worker)
        elif args.action == "tick":
            result = tick()
        elif args.action == "claim":
            result = claim(args.worker, args.seconds)
        elif args.action == "retry":
            result = retry(args.id)
        elif args.action == "supervise":
            raw = sys.stdin.buffer.read(20001)
            if len(raw) > 20000:
                raise ValueError("supervisor_patch_limit")
            result = supervise(args.id, json.loads(raw))
        elif args.action == "finish":
            raw = sys.stdin.buffer.read(3 * 1024 * 1024 + 1)
            if len(raw) > 3 * 1024 * 1024:
                raise ValueError("worker_result_limit")
            result = finish(json.loads(raw))
        else:
            result = publish(args.id, args.commit)
        print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": type(error).__name__}), file=sys.stderr)
        raise SystemExit(1)
