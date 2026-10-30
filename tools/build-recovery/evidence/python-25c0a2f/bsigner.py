#!/usr/bin/env python3
"""Bounded bSigner recovery: online preparation, then Linux network isolation.

Uses only Python's standard library. Source, Cargo.lock and crypto are never
rewritten. See README.md for the host prerequisites and acceptance limits.
"""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tarfile
import time
import tomllib


def digest(path):
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def run(argv, cwd, logs, name, env=None, timeout=1800):
    started = time.time()
    with (logs / (name + ".log")).open("w") as output:
        try:
            result = subprocess.run(argv, cwd=cwd, env=env, stdout=output,
                                    stderr=subprocess.STDOUT, timeout=timeout)
            code = result.returncode
        except subprocess.TimeoutExpired:
            # The outer offline launcher also has a process-tree timeout.
            code = 124
    row = {"command": argv, "exit": code, "seconds": round(time.time() - started, 3)}
    write_json(logs / (name + ".json"), row)
    print(f"{name}: exit {code}, {row['seconds']} s", flush=True)
    if code:
        raise RuntimeError(f"{name} failed; see {logs / (name + '.log')}")
    return row


def inventory(root):
    rows = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            rows.append({"path": str(path.relative_to(root)), "link": os.readlink(path)})
        elif path.is_file():
            rows.append({"path": str(path.relative_to(root)), "bytes": path.stat().st_size,
                         "sha256": digest(path)})
    return rows


def prepare(args):
    if not re.fullmatch(r"[0-9a-f]{40}", args.source_sha):
        raise ValueError("source-sha must be the full git archive commit")
    root = args.snapshot.resolve()
    root.mkdir(parents=True, exist_ok=False)
    logs = root / "preparation"
    logs.mkdir()
    source = root / "source"
    source.mkdir()
    with tarfile.open(args.archive) as archive:
        if archive.pax_headers.get("comment") != args.source_sha:
            raise ValueError("git archive commit does not match source-sha")
        archive.extractall(source, filter="data")
    pin = tomllib.loads((source / "rust-toolchain.toml").read_text())["toolchain"]["channel"]
    toolchain = args.toolchain.resolve()
    version = subprocess.check_output([str(toolchain / "bin/rustc"), "-Vv"], text=True)
    if f"release: {pin}\n" not in version:
        raise ValueError(f"rustc does not match source pin {pin}")
    shutil.copytree(toolchain, root / "toolchain", symlinks=True)
    cargo = root / "toolchain/bin/cargo"
    env = dict(os.environ, PATH=str(root / "toolchain/bin") + ":/usr/bin:/bin")
    env.pop("RUSTC_WRAPPER", None)
    env.pop("RUSTC_WORKSPACE_WRAPPER", None)
    env.pop("RUSTFLAGS", None)
    env.pop("CARGO_ENCODED_RUSTFLAGS", None)
    # cargo vendor's stdout includes source replacement config for git sources;
    # stderr contains progress/warnings and must not be parsed as TOML.
    argv = [str(cargo), "vendor", "--locked", "--versioned-dirs", str(root / "vendor")]
    started = time.time()
    with (root / "cargo-config.toml").open("w") as config, (logs / "vendor-config.log").open("w") as err:
        proc = subprocess.run(argv, cwd=source, env=env, stdout=config, stderr=err, timeout=1800)
    write_json(logs / "vendor-config.json", {"command": argv, "exit": proc.returncode,
                                             "seconds": round(time.time()-started, 3)})
    if proc.returncode:
        raise RuntimeError("vendor configuration failed")
    config_path = root / "cargo-config.toml"
    config_path.write_text(config_path.read_text().replace(str(root / "vendor"), "/snapshot/vendor"))
    fixtures = root / "fixtures"
    fixtures.mkdir()
    xwing = json.loads((source / "scripts/btungsten/pq05-xwing-draft.json").read_text())
    bip = json.loads((source / "scripts/btungsten/pq12-bip341.json").read_text())
    downloads = []
    for name, entry in [("xwing-draft.txt", xwing), ("bip341.json", bip),
                        ("bip174.mediawiki", bip["psbt"]["bip174"]),
                        ("bip371.mediawiki", bip["psbt"]["bip371"])]:
        # Public URLs are pinned by retained source, then checked before use.
        target = fixtures / name
        run(["curl", "--fail", "--silent", "--show-error", "--location", "--retry", "3",
             "--max-time", "120", "--output", str(target), entry["url"]],
            source, logs, "fetch-" + name, timeout=600)
        actual = base64.urlsafe_b64encode(bytes.fromhex(digest(target))).decode().rstrip("=")
        if target.stat().st_size != entry["size"] or actual != entry["sha256"]:
            raise ValueError(f"pinned fixture mismatch: {name}")
        downloads.append({"file": name, "url": entry["url"], "sha256": digest(target),
                          "bytes": target.stat().st_size})
    shutil.copy2(__file__, root / "runner.py")
    packages = tomllib.loads((source / "Cargo.lock").read_text())["package"]
    write_json(root / "dependencies.json", packages)
    host = {}
    for name in ["python3", "node", "cc", "gcc", "ld", "as", "bwrap", "timeout", "prlimit", "nice"]:
        path = Path(shutil.which(name)).resolve()
        host[name] = {"path": str(path), "sha256": digest(path)}
    write_json(root / "provenance.json", {
        "source_sha": args.source_sha, "archive_sha256": digest(args.archive),
        "archive_bytes": args.archive.stat().st_size, "rustc": version,
        "cargo": subprocess.check_output([str(cargo), "-V"], text=True).strip(),
        "lock_sha256": digest(source / "Cargo.lock"), "downloads": downloads,
        "host_tools": host, "os_release": Path("/etc/os-release").read_text(),
        "kernel": os.uname().release,
        "host_packages": subprocess.check_output(
            ["dpkg-query", "-W", "gcc", "binutils", "libc6", "libc6-dev", "libgcc-s1",
             "libstdc++6", "bubblewrap", "python3", "nodejs"], text=True),
    })
    write_json(root / "manifest.json", inventory(root))
    print(f"prepared {root}; manifest SHA-256 {digest(root / 'manifest.json')}")


def verify_snapshot(root):
    rows = json.loads((root / "manifest.json").read_text())
    names = [row["path"] for row in rows]
    if len(names) != len(set(names)):
        raise ValueError("duplicate snapshot path")
    if any(Path(name).is_absolute() or ".." in Path(name).parts for name in names):
        raise ValueError("snapshot path escapes its root")
    actual = {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file() or p.is_symlink()}
    expected = {row["path"] for row in rows} | {"manifest.json"}
    if actual != expected:
        raise ValueError("snapshot file inventory changed")
    for row in rows:
        path = root / row["path"]
        if "link" in row:
            if not path.is_symlink() or os.readlink(path) != row["link"]:
                raise ValueError(f"snapshot link changed: {row['path']}")
        elif path.is_symlink() or path.stat().st_size != row["bytes"] or digest(path) != row["sha256"]:
            raise ValueError(f"snapshot bytes changed: {row['path']}")


def offline(args):
    snapshot = args.snapshot.resolve()
    work = args.work.resolve()
    if work == snapshot or snapshot in work.parents or work in snapshot.parents:
        raise ValueError("snapshot and output must be disjoint")
    work.mkdir(parents=True, exist_ok=False)
    verify_snapshot(snapshot)
    source = snapshot / "source"
    for entry in json.loads((snapshot / "provenance.json").read_text())["host_tools"].values():
        if digest(entry["path"]) != entry["sha256"]:
            raise ValueError("prepared host tool changed")
    command = ["timeout", "--signal=TERM", "--kill-after=15s", "30m", "nice", "-n", "15",
               "prlimit", "--as=8589934592", "--cpu=1200", "--nofile=1024", "--fsize=2147483648", "--",
               "bwrap", "--unshare-all", "--die-with-parent", "--new-session", "--cap-drop", "ALL",
               "--ro-bind", "/usr", "/usr", "--ro-bind", "/bin", "/bin",
               "--ro-bind", "/lib", "/lib", "--ro-bind", "/lib64", "/lib64",
               "--dir", "/etc", "--ro-bind", "/etc/ld.so.cache", "/etc/ld.so.cache",
               "--ro-bind", "/etc/alternatives", "/etc/alternatives",
               "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
               "--ro-bind", str(snapshot), "/snapshot", "--ro-bind", str(source), "/source",
               "--bind", str(work), "/work", "--chdir", "/source", "--clearenv",
               "--setenv", "PATH", "/snapshot/toolchain/bin:/usr/bin:/bin",
               "--setenv", "HOME", "/work/home", "--setenv", "CARGO_HOME", "/work/cargo-home",
               "--setenv", "CARGO_TARGET_DIR", "/work/target", "--setenv", "CARGO_NET_OFFLINE", "true",
               "--setenv", "CARGO_BUILD_JOBS", "1", "--setenv", "RUST_TEST_THREADS", "1",
               "--setenv", "LANG", "C.UTF-8", "--setenv", "TZ", "UTC",
               "--setenv", "BPQ_XWING_DRAFT", "/snapshot/fixtures/xwing-draft.txt",
               "--setenv", "BPQ_BIP341_VECTORS", "/snapshot/fixtures/bip341.json",
               "--setenv", "BPQ_BIP174_TEXT", "/snapshot/fixtures/bip174.mediawiki",
               "--setenv", "BPQ_BIP371_TEXT", "/snapshot/fixtures/bip371.mediawiki",
               "python3", "/snapshot/runner.py", "inside"]
    if args.probe_only:
        command.append("--probe-only")
    write_json(work / "launch.json", {"command": command, "quiet_window_note": args.quiet_window_note,
                                     "host_netns": os.readlink("/proc/self/ns/net"),
                                     "snapshot_manifest_sha256": digest(snapshot / "manifest.json")})
    start = time.time()
    with (work / "outer.log").open("w") as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT,
                                env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
    write_json(work / "result.json", {"exit": result.returncode, "seconds": round(time.time()-start, 3),
                                     "started_unix": start, "finished_unix": time.time()})
    print((work / "outer.log").read_text())
    raise SystemExit(result.returncode)


def inside(probe_only=False):
    work = Path("/work")
    logs = work / "logs"
    logs.mkdir()
    for name in ["home", "cargo-home", "target"]:
        (work / name).mkdir()
    launch = json.loads((work / "launch.json").read_text())
    netns = os.readlink("/proc/self/ns/net")
    if netns == launch["host_netns"]:
        raise RuntimeError("network namespace was not isolated")
    routes = Path("/proc/net/route").read_text()
    if len(routes.strip().splitlines()) != 1:
        raise RuntimeError("unexpected IPv4 network route")
    probes = []
    for family, address in [(socket.AF_INET, ("1.1.1.1", 443)),
                            (socket.AF_INET6, ("2606:4700:4700::1111", 443))]:
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.settimeout(2)
            code = sock.connect_ex(address)
        probes.append({"address": address[0], "errno": code})
        if code != 101:  # ENETUNREACH; timeout is not sufficient evidence.
            raise RuntimeError(f"network isolation probe returned {code}, expected 101")
    write_json(work / "isolation.json", {"netns": netns, "routes": routes, "probes": probes,
                                         "interfaces": socket.if_nameindex(), "empty_target": True})
    cargo = ["cargo", "--config", "/snapshot/cargo-config.toml"]
    run(cargo + ["tree", "--frozen", "--offline", "-p", "bsigner", "--edges", "normal,build"],
        "/source", logs, "dependency-tree")
    if probe_only:
        print("ISOLATION PROBE PASS; compilation and fixture execution not attempted")
        return
    commands = [
        ("build", cargo + ["build", "--frozen", "--offline", "--release", "-p", "bsigner", "-j", "1"]),
        ("tests", cargo + ["test", "--frozen", "--offline", "--release", "-p", "bsigner", "-j", "1"]),
        ("xwing", cargo + ["test", "--frozen", "--offline", "--release", "-p", "bsigner", "-j", "1",
                            "xwing_matches_the_draft_vectors", "--", "--ignored", "--nocapture"]),
        ("bitcoin", cargo + ["test", "--frozen", "--offline", "--release", "-p", "bsigner", "-j", "1",
                              "--", "--ignored", "--nocapture", "bip341_wallet_vectors", "bip174_and_bip371_vectors"]),
        ("selftest", ["/work/target/release/bsigner", "selftest"]),
        ("law", ["sh", "scripts/verify-law-signatures-rust.sh", "/work/target/release/bsigner"]),
    ]
    for name, argv in commands:
        run(argv, "/source", logs, name)
        if name == "build":
            artifact = work / "target/release/bsigner"
            write_json(work / "artifact.json", {
                "path": "target/release/bsigner", "bytes": artifact.stat().st_size,
                "sha256": digest(artifact), "profile": "release", "features": "default",
            })
    print("RECOVERY PASS: default-feature reconstruction and existing public fixtures; no reproducibility claim")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    prep = sub.add_parser("prepare")
    prep.add_argument("--archive", type=Path, required=True)
    prep.add_argument("--source-sha", required=True)
    prep.add_argument("--snapshot", type=Path, required=True)
    prep.add_argument("--toolchain", type=Path, required=True)
    off = sub.add_parser("offline")
    off.add_argument("--snapshot", type=Path, required=True)
    off.add_argument("--work", type=Path, required=True)
    off.add_argument("--quiet-window-note", required=True,
                     help="Record observed SDK-idle evidence before starting this synchronous run")
    off.add_argument("--probe-only", action="store_true",
                     help="Check isolation and dependency resolution without compiling or running fixtures")
    inner = sub.add_parser("inside")
    inner.add_argument("--probe-only", action="store_true")
    args = parser.parse_args()
    if args.mode == "prepare":
        prepare(args)
    elif args.mode == "offline":
        offline(args)
    else:
        inside(args.probe_only)


if __name__ == "__main__":
    main()
