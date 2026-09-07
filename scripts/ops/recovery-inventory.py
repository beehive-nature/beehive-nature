#!/usr/bin/env python3
"""recovery-inventory.py — read-only service/state inventory for a host.

G1 (issue #4): one machine-readable census that can drive capacity admission,
deployment drift detection, backup/restore, provider handover and incident
review — never a second source of truth per service.

LAWS ENCODED HERE
-----------------
* READ-ONLY: this tool opens no file for writing, spawns no mutating command,
  and touches nothing outside the paths a config declares (plus /proc links).
* DECLARED ROOTS ONLY: no arbitrary walking. A path the config does not name
  is not inventoried; "unknown" stays explicit in the operator's report.
* SECRET-FREE BY STRUCTURE: file CONTENTS are never read except to digest an
  explicitly declared artifact. A root classified `secret-reference` emits
  location, permissions, uid/gid and recovery owner ONLY — no digest, no
  footprint, and its tree is never walked. A defensive guard then scans the
  serialized output and refuses (exit 3) if sensitive markers appear.
* FAIL CLOSED: anything that cannot be computed is an error status, never a
  silent pass. Exit codes:
    0  inventory clean
    2  recovery attention (missing root/artifact/restart dependency,
       active deleted executable, or reserve headroom breach)
    3  sensitive-content guard tripped — output withheld
    4  usage/config error
Usage:
  recovery-inventory.py --config inventory.json
Environment:
  PROC_DIR  override /proc for the deleted-executable scan (tests)
"""

import argparse
import datetime
import grp
import hashlib
import json
import os
import pwd
import socket
import sys

CLASSIFICATIONS = (
    "authoritative-state",
    "reproducible-artifact",
    "rebuildable-index-cache",
    "secret-reference",
)
ATTENTION_STATUSES = (
    "missing",
    "missing-artifact",
    "missing-restart-dependency",
    "unreadable-artifact",
    "unknown-classification",
    "active-deleted-executable",
)
GUARD_MARKERS = (
    "PRIVATE KEY",
    "BEGIN RSA",
    "BEGIN OPENSSH",
    "BEGIN EC",
    "NSEC",
    "walletpassphrase",
    "Authorization: Bearer",
)


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def owner_names(uid, gid):
    try:
        user = pwd.getpwuid(uid).pw_name
    except KeyError:
        user = None
    try:
        group = grp.getgrgid(gid).gr_name
    except KeyError:
        group = None
    return user, group


def digest_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def footprint(path):
    """Sum st_size over a declared tree (or single file). Read-only."""
    st = os.lstat(path)
    if not os.path.isdir(path) or os.path.islink(path):
        return st.st_size
    total = 0
    for dirpath, _dirnames, filenames in os.walk(path, followlinks=False):
        try:
            for name in filenames:
                try:
                    total += os.lstat(os.path.join(dirpath, name)).st_size
                except OSError:
                    continue
        except OSError:
            continue
    return total


def scan_deleted_executables(roots):
    """Running processes whose binary file was deleted, keyed against the
    declared roots — the restart-path trap (a build tree that looks prunable
    but still backs a live process)."""
    proc_dir = os.environ.get("PROC_DIR", "/proc")
    findings = []
    entries = []
    try:
        entries = sorted(os.listdir(proc_dir))
    except OSError as err:
        return findings, ["proc-scan-unavailable: %s" % err]
    for name in entries:
        if not name.isdigit():
            continue
        exe = os.path.join(proc_dir, name, "exe")
        try:
            target = os.readlink(exe)
        except OSError:
            continue  # kernel thread, permission, or gone — not computable
        if not target.endswith(" (deleted)"):
            continue
        try:
            uid = os.stat(exe).st_uid
        except OSError:
            uid = None
        findings.append({"pid": int(name), "exe": target, "uid": uid})
    for finding in findings:
        path = finding["exe"][: -len(" (deleted)")]
        finding["inside_declared_roots"] = sorted(
            r["id"] for r in roots
            if os.path.abspath(r.get("path", "")) != ""
            and path.startswith(os.path.abspath(r["path"]) + os.sep)
        )
    return findings, []


def check_filesystem(mount, reserve_bytes):
    try:
        st = os.statvfs(mount)
    except OSError as err:
        return {"mount": mount, "reserve_bytes": reserve_bytes,
                "status": "statvfs-failed: %s" % err}
    free = st.f_bavail * st.f_frsize
    return {
        "mount": mount,
        "reserve_bytes": reserve_bytes,
        "free_bytes": free,
        "headroom_bytes": free - reserve_bytes,
        "headroom_ok": free >= reserve_bytes,
        "status": "ok" if free >= reserve_bytes else "reserve-breach",
    }


def inventory_root(root):
    """Resolve one declared root. Never raises — failures become statuses."""
    out = {
        "id": root.get("id", "<unnamed>"),
        "path": root.get("path"),
        "classification": root.get("classification"),
        "notes": root.get("notes"),
    }
    path = root.get("path")
    if not path or not os.path.exists(path):
        out["status"] = "missing"
        return out
    if root.get("classification") not in CLASSIFICATIONS:
        out["status"] = "unknown-classification"
        return out
    st = os.lstat(path)
    user, group = owner_names(st.st_uid, st.st_gid)
    out["owner_user"] = user
    out["owner_uid"] = st.st_uid
    out["owner_group"] = group
    out["mode"] = format(stat_mode(st.st_mode), "04o")

    if root["classification"] == "secret-reference":
        # Location, permissions, recovery owner ONLY. No digest, no footprint,
        # no walk — a secret's size or shape is already more than needed.
        out["recovery_owner"] = root.get("recovery_owner")
        out["status"] = "secret-recorded"
        return out

    out["footprint_bytes"] = footprint(path)

    out["artifacts"] = []
    for artifact in root.get("artifacts", []):
        apath = artifact.get("path")
        entry = {"path": apath, "kind": artifact.get("kind", "artifact")}
        if not apath or not os.path.exists(apath):
            entry["status"] = "missing-artifact"
        else:
            try:
                entry["sha256"] = digest_file(apath)
                entry["bytes"] = os.lstat(apath).st_size
                entry["status"] = "ok"
            except OSError as err:
                entry["status"] = "unreadable: %s" % err
        out["artifacts"].append(entry)

    restart = root.get("restart")
    if restart is None:
        out["restart"] = None
    else:
        rep = dict(restart)
        exe = restart.get("executable")
        if exe:
            if os.path.exists(exe):
                try:
                    rep["executable_sha256"] = digest_file(exe)
                except OSError as err:
                    rep["executable_status"] = "unreadable: %s" % err
            else:
                rep["executable_status"] = "missing-restart-dependency"
        unit = restart.get("unit")
        if unit:
            unit_paths = (
                os.path.join(os.environ.get("UNIT_DIR", "/etc/systemd/system"), unit),
                "/lib/systemd/system/%s" % unit,
                "/usr/lib/systemd/system/%s" % unit,
            )
            rep["unit_file_present"] = any(os.path.exists(p) for p in unit_paths)
            if not rep["unit_file_present"]:
                rep["unit_status"] = "missing-restart-dependency"
        out["restart"] = rep
        if rep.get("executable_status") == "missing-restart-dependency" or \
                rep.get("unit_status") == "missing-restart-dependency":
            out["status"] = "missing-restart-dependency"
            return out
    if any(a.get("status") == "missing-artifact" for a in out["artifacts"]):
        out["status"] = "missing-artifact"
        return out
    if any(str(a.get("status", "")).startswith("unreadable") for a in out["artifacts"]):
        out["status"] = "unreadable-artifact"
        return out
    out["status"] = "ok"
    return out


def stat_mode(mode):
    # os.filemode exists on 3.6+; kept explicit so the octal form is obvious
    return mode & 0o7777


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--config", required=True,
                    help="JSON declaring roots, filesystems and reserves")
    args = ap.parse_args(argv)

    try:
        with open(args.config, "r", encoding="utf-8") as fh:
            config = json.load(fh)
    except (OSError, ValueError) as err:
        print("config error: %s" % err, file=sys.stderr)
        return 4
    if not isinstance(config.get("roots"), list):
        print("config error: 'roots' must be a list", file=sys.stderr)
        return 4

    roots = config["roots"]
    resolved = [inventory_root(r) for r in roots]

    deleted, scan_errors = scan_deleted_executables(roots)
    deleted_paths = [f["exe"][: -len(" (deleted)")] for f in deleted]
    for root, rres in zip(roots, resolved):
        # A live process backed by this tree is the dominant safety fact
        # (the do-not-prune flag); any softer defect is kept as prior_status.
        if rres.get("status") in ("missing", "secret-recorded",
                                  "unknown-classification"):
            continue
        rpath = os.path.abspath(root.get("path", ""))
        for dpath in deleted_paths:
            if dpath.startswith(rpath + os.sep):
                if rres["status"] != "active-deleted-executable":
                    rres["prior_status"] = rres["status"]
                rres["status"] = "active-deleted-executable"
                break

    filesystems = [check_filesystem(f.get("mount", "/"),
                                    int(f.get("reserve_bytes", 0)))
                   for f in config.get("filesystems", [])]

    report = {
        "tool": "recovery-inventory",
        "generated_utc": utcnow(),
        "host": socket.gethostname(),
        "filesystems": filesystems,
        "roots": resolved,
        "deleted_executables": deleted,
        "scan_errors": scan_errors,
    }

    text = json.dumps(report, indent=2, sort_keys=True)
    for marker in GUARD_MARKERS:
        if marker in text:
            print("sensitive-content guard tripped on marker %r — "
                  "output withheld" % marker, file=sys.stderr)
            return 3

    attention = [r["id"] for r in resolved if r.get("status") in ATTENTION_STATUSES]
    attention += [f["mount"] for f in filesystems
                  if f.get("status") not in ("ok", None)]
    if attention:
        print(json.dumps({"attention": attention}, indent=2), file=sys.stderr)
    print(text)
    return 2 if (attention or scan_errors) else 0


if __name__ == "__main__":
    sys.exit(main())
