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
  serialized output and refuses (exit 3) if sensitive markers appear
  (case-insensitively — real secrets arrive lowercase) or if any key-shaped
  hex run appears that the tool did not itself compute (computed digests
  are allowlisted at computation time; field NAMES are never exempted).
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
import errno
import grp
import hashlib
import json
import os
import pwd
import re
import socket
import sys

HEX_RUN_RE = re.compile(r"[0-9a-fA-F]{48,}")


def err_code(err):
    """OSError → its symbolic errno name (EACCES, EISDIR, …). NEVER str(err):
    the string form embeds the discovered path, and #4 forbids emitting
    discovered object names — error reports carry the operation and code,
    nothing else."""
    return errno.errorcode.get(err.errno, "ERR%s" % err.errno)

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
    "unknown-restart-dependency",
    "unreadable-restart-dependency",
    "partially-unreadable",
    "unreadable-artifact",
    "unknown-classification",
    "active-deleted-executable",
)
# Which defect a root REPORTS when it has several: recovery-critical restart
# defects outrank measurement gaps; the live-process flag stays dominant
# (assigned in main over any of these, prior_status preserved).
STATUS_PRECEDENCE = (
    "active-deleted-executable",
    "unknown-restart-dependency",
    "missing-restart-dependency",
    "unreadable-restart-dependency",
    "partially-unreadable",
    "missing-artifact",
    "unreadable-artifact",
    "unknown-classification",
    "missing",
)
# Matched CASE-INSENSITIVELY against the serialized output: real secrets
# arrive lowercase (nsec1…, "authorization: bearer", "private key"), and a
# case-sensitive guard is a guard that only catches shouted secrets.
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


def footprint(path, errors, root_id):
    """Sum st_size over a declared tree (or single file). Read-only.
    Unreadable entries are RECORDED, never silently skipped — a measurement
    that cannot be computed is an error, not a smaller number."""
    st = os.lstat(path)
    if not os.path.isdir(path) or os.path.islink(path):
        return st.st_size
    total = 0

    def on_error(err):
        errors.append({"root": root_id, "op": "listdir",
                       "code": err_code(err), "errno": err.errno})

    for dirpath, _dirnames, filenames in os.walk(path, followlinks=False,
                                                 onerror=on_error):
        for name in filenames:
            try:
                total += os.lstat(os.path.join(dirpath, name)).st_size
            except OSError as err:
                errors.append({"root": root_id, "op": "lstat",
                               "code": err_code(err), "errno": err.errno})
    return total


def scan_deleted_executables(roots):
    """Running processes whose binary file was deleted, keyed against the
    declared roots — the restart-path trap (a build tree that looks prunable
    but still backs a live process). Permission-denied reads make the scan
    PARTIAL: recorded as errors, never silently dropped."""
    proc_dir = os.environ.get("PROC_DIR", "/proc")
    findings = []
    errors = []
    entries = []
    try:
        entries = sorted(os.listdir(proc_dir))
    except OSError as err:
        return findings, [{"op": "proc-listdir", "code": err_code(err),
                           "errno": err.errno}]
    for name in entries:
        if not name.isdigit():
            continue
        exe = os.path.join(proc_dir, name, "exe")
        try:
            target = os.readlink(exe)
        except PermissionError as err:
            # A pid we cannot read = a PARTIAL scan, not an empty finding.
            # Pid + code only: no path, no discovered object names.
            errors.append({"op": "proc-readlink", "code": err_code(err),
                           "pid": int(name)})
            continue
        except OSError:
            continue  # kernel thread or gone — no exe is normal, not an error
        if not target.endswith(" (deleted)"):
            continue
        try:
            uid = os.stat(exe).st_uid
        except PermissionError as err:
            errors.append({"op": "proc-stat", "code": err_code(err),
                           "pid": int(name)})
            uid = None
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
    return findings, errors


def check_filesystem(mount, reserve_bytes):
    try:
        st = os.statvfs(mount)
    except OSError as err:
        return {"mount": mount, "reserve_bytes": reserve_bytes,
                "status": "statvfs-failed:%s" % err_code(err)}
    free = st.f_bavail * st.f_frsize
    return {
        "mount": mount,
        "reserve_bytes": reserve_bytes,
        "free_bytes": free,
        "headroom_bytes": free - reserve_bytes,
        "headroom_ok": free >= reserve_bytes,
        "status": "ok" if free >= reserve_bytes else "reserve-breach",
    }


def inventory_root(root, errors, computed_digests):
    """Resolve one declared root. Never raises — failures become statuses,
    every defect is recorded (a root with several reports the most
    recovery-critical one and carries the full list in `defects`).
    Every digest THIS TOOL computes is registered in computed_digests: the
    output guard allows exactly those hex runs and no others."""
    out = {
        "id": root.get("id", "<unnamed>"),
        "path": root.get("path"),
        "classification": root.get("classification"),
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
        # Location, permissions, recovery owner ONLY. No digest, no
        # footprint, no walk — and NO notes: config-supplied prose riding a
        # secret entry is exactly how metadata-only output leaks. The entry
        # is rebuilt from scratch so nothing else can ride along.
        return {
            "id": out["id"],
            "path": out["path"],
            "classification": out["classification"],
            "owner_user": out["owner_user"],
            "owner_uid": out["owner_uid"],
            "owner_group": out["owner_group"],
            "mode": out["mode"],
            "recovery_owner": root.get("recovery_owner"),
            "status": "secret-recorded",
        }

    out["notes"] = root.get("notes")
    defects = []
    out["footprint_bytes"] = footprint(path, errors, out["id"])
    if any(e.get("root") == out["id"] for e in errors):
        defects.append("partially-unreadable")

    out["artifacts"] = []
    for artifact in root.get("artifacts", []):
        apath = artifact.get("path")
        entry = {"path": apath, "kind": artifact.get("kind", "artifact")}
        if not apath or not os.path.exists(apath):
            entry["status"] = "missing-artifact"
            defects.append("missing-artifact")
        else:
            try:
                entry["sha256"] = digest_file(apath)
                entry["bytes"] = os.lstat(apath).st_size
                entry["status"] = "ok"
                computed_digests.add(entry["sha256"])
            except OSError as err:
                entry["status"] = "unreadable:%s" % err_code(err)
                defects.append("unreadable-artifact")
        out["artifacts"].append(entry)

    restart = root.get("restart")
    if restart is None:
        # Absent or null restart information is a DEFECT by default — the
        # census cannot assume a root needs no restart; it must be TOLD via
        # an explicit "not-applicable" designation. Silence is not "fine".
        defects.append("unknown-restart-dependency")
        out["restart"] = {"method": "undeclared"}
    elif restart.get("method") == "not-applicable":
        # The one explicit designation that a root has no restart dependency.
        out["restart"] = {"method": "not-applicable"}
    else:
        rep = dict(restart)
        exe = restart.get("executable")
        unit = restart.get("unit")
        # An explicitly-unknown (or entirely absent) restart dependency is a
        # defect to surface, never a healthy pass: "we cannot name how this
        # restarts" is recovery attention by definition.
        if restart.get("method") == "unknown" or (not exe and not unit):
            defects.append("unknown-restart-dependency")
        if exe:
            if os.path.exists(exe):
                try:
                    rep["executable_sha256"] = digest_file(exe)
                    computed_digests.add(rep["executable_sha256"])
                except OSError as err:
                    rep["executable_status"] = "unreadable:%s" % err_code(err)
                    defects.append("unreadable-restart-dependency")
            else:
                rep["executable_status"] = "missing-restart-dependency"
                defects.append("missing-restart-dependency")
        if unit:
            unit_paths = (
                os.path.join(os.environ.get("UNIT_DIR", "/etc/systemd/system"), unit),
                "/lib/systemd/system/%s" % unit,
                "/usr/lib/systemd/system/%s" % unit,
            )
            rep["unit_file_present"] = any(os.path.exists(p) for p in unit_paths)
            if not rep["unit_file_present"]:
                rep["unit_status"] = "missing-restart-dependency"
                defects.append("missing-restart-dependency")
        out["restart"] = rep

    out["defects"] = defects
    out["status"] = min(defects, key=STATUS_PRECEDENCE.index) if defects else "ok"
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
    measurement_errors = []
    computed_digests = set()
    resolved = [inventory_root(r, measurement_errors, computed_digests)
                for r in roots]

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
        "measurement_errors": measurement_errors,
    }

    text = json.dumps(report, indent=2, sort_keys=True)
    folded = text.lower()
    for marker in GUARD_MARKERS:
        if marker.lower() in folded:
            print("sensitive-content guard tripped on marker %r — "
                  "output withheld; the marker word carries no secret "
                  "value" % marker, file=sys.stderr)
            return 3
    for run in HEX_RUN_RE.findall(text):
        if run.lower() not in computed_digests:
            # Key-shaped hex that this tool did NOT compute (a digest it
            # computed is allowlisted at computation time — field NAMES are
            # never exempted). The offending value is never echoed.
            print("sensitive-content guard tripped: key-shaped hex run "
                  "matching no digest this tool computed — output "
                  "withheld, value never echoed", file=sys.stderr)
            return 3

    attention = [r["id"] for r in resolved if r.get("status") in ATTENTION_STATUSES]
    attention += [f["mount"] for f in filesystems
                  if f.get("status") not in ("ok", None)]
    if attention:
        print(json.dumps({"attention": attention}, indent=2), file=sys.stderr)
    print(text)
    incomplete = bool(attention or scan_errors or measurement_errors)
    return 2 if incomplete else 0


if __name__ == "__main__":
    sys.exit(main())
