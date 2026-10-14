#!/usr/bin/env python3
"""Build and execute the pinned x0x PQ lane, including its gate controls.

Run from the repository root: python3 scripts/btungsten/x0x-pq-check.py
Requires Python 3.11+, Rust, curl, and cargo-audit 0.22.2. Output defaults to
target/x0x-pq. Audit gate 2 is recorded verbatim; it is never ignored.
"""
import argparse
import base64
import datetime
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys
import time
import tomllib
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
CRATE = ROOT / "crates/btungsten-x0x-pq"


def tag(data):
    return "sha256:" + base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip("=")


def verify_sources(out):
    pin = json.loads((CRATE / "inventory.json").read_text())
    commit = pin["x0x"]["commit"]
    local_lock = tomllib.loads((CRATE / "Cargo.lock").read_text())
    upstream_lock = None
    for source in pin["source_files"]:
        request = urllib.request.Request(
            f"https://raw.githubusercontent.com/saorsa-labs/x0x/{commit}/{source['path']}",
            headers={"User-Agent": "btungsten-x0x-pq"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        if len(data) != source["bytes"] or tag(data) != source["sha256"]:
            raise ValueError(f"x0x source pin mismatch: {source['path']}")
        if source["path"] == "Cargo.lock":
            upstream_lock = tomllib.loads(data.decode())
    for wanted in pin["packages"]:
        for name, lock in [("x0x", upstream_lock), ("battery", local_lock)]:
            packages = [p for p in lock["package"] if p["name"] == wanted["name"] and p["version"] == wanted["version"]]
            if len(packages) != 1:
                raise ValueError(f"{name}: ambiguous or absent {wanted['name']}")
            package = packages[0]
            checksum = "sha256:" + base64.urlsafe_b64encode(bytes.fromhex(package["checksum"])).decode().rstrip("=")
            if package["version"] != wanted["version"] or checksum != wanted["checksum"]:
                raise ValueError(f"{name}: dependency pin mismatch for {wanted['name']}")
    (out / "source-pins.json").write_text(json.dumps(pin, indent=2) + "\n")
    print("X0X-PQ PIN: source files and implementation packages match x0x's pinned lock", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "target/x0x-pq")
    parser.add_argument("--cache", type=Path, default=ROOT / "target/pq-vectors")
    args = parser.parse_args()
    out, cache = args.out.resolve(), args.cache.resolve()
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def run(name, command, expected=0):
        path = out / f"{name}.log"
        print(f"X0X-PQ RUN: {name}", flush=True)
        start = time.monotonic()
        with path.open("w") as log:
            try:
                result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=2400)
                rc = result.returncode
            except (OSError, subprocess.TimeoutExpired) as e:
                log.write(str(e) + "\n")
                rc = None
        row = {"name": name, "command": command, "exit_code": rc, "expected_exit": expected,
               "seconds": round(time.monotonic() - start, 3), "log": path.name, "sha256": tag(path.read_bytes())}
        rows.append(row)
        if rc != expected:
            print(path.read_text()[-6000:], file=sys.stderr)
            raise RuntimeError(f"{name}: exit {rc}, expected {expected}")

    success = False
    error = None
    try:
        verify_sources(out)
        run("unit", ["cargo", "test", "--locked", "--release", "--manifest-path", str(CRATE / "Cargo.toml")])
        run("build", ["cargo", "build", "--locked", "--release", "--manifest-path", str(CRATE / "Cargo.toml")])
        # Honor Cargo's configured target directory, including a user override.
        meta = json.loads(subprocess.check_output(["cargo", "metadata", "--no-deps", "--format-version", "1",
            "--manifest-path", str(CRATE / "Cargo.toml")], cwd=ROOT))
        binary = str(Path(meta["target_directory"]) / "release/btungsten-x0x-pq")
        for name, flags, expected in [("honest", [], 0), ("expected-byte-teeth", ["--sabotage-expected"], 1),
                                      ("empty-vectors-teeth", ["--empty-vectors"], 1)]:
            receipt = out / f"{name}.json"
            receipt.unlink(missing_ok=True)
            run(name, [binary, "--cache", str(cache), "--receipt", str(receipt), *flags], expected)
            evidence = json.loads(receipt.read_text())
            tally = evidence["report"]
            classes = {}
            for row in tally["rows"]:
                classes[row["result_class"]] = classes.get(row["result_class"], 0) + row["executed"]
            print(f"X0X-PQ RESULT {name}: {evidence['result']}; {tally['executed']} executed, "
                  f"{tally['passed']} passed, {len(tally['failures'])} failed; "
                  f"{evidence['required_rows']} required rows, {len(evidence['missing'])} missing; "
                  f"classes {json.dumps(classes, sort_keys=True)}", flush=True)
            if evidence["errors"]:
                raise RuntimeError(f"{name}: an infrastructure failure cannot convict a control")
            if name == "expected-byte-teeth" and (not evidence["controls"]["sabotage_applied"]
                or not evidence["report"]["failures"] or evidence["missing"]):
                raise RuntimeError("expected-byte control did not convict the mutated expected result")
            if name == "empty-vectors-teeth" and (evidence["report"]["executed"] != 0 or not evidence["missing"]):
                raise RuntimeError("empty-vector control did not fail the coverage gate")
        # Audit gate 1: the new dependency does not enter BNR's default graph.
        path = out / "audit-gate1.log"
        command = ["cargo", "tree", "--locked", "--workspace", "-e", "normal", "-i", "saorsa-pqc"]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
        path.write_text(result.stdout + result.stderr)
        absent = result.returncode != 0 and "did not match any packages" in path.read_text()
        rows.append({"name": "audit-gate1", "command": command, "exit_code": result.returncode,
            "result": "PASS" if absent else "FAIL", "log": path.name, "sha256": tag(path.read_bytes())})
        if not absent:
            raise RuntimeError("audit gate 1: absence from the default graph not established")
        version = subprocess.check_output(["cargo-audit", "--version"], text=True).strip()
        if version != "cargo-audit 0.22.2":
            raise RuntimeError(f"audit tool pin mismatch: {version}")
        path = out / "audit-gate2.log"
        command = ["cargo", "audit", "--file", str(CRATE / "Cargo.lock")]
        with path.open("w") as log:
            result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=240)
        if result.returncode not in (0, 1) or "Scanning" not in path.read_text():
            raise RuntimeError(f"audit gate 2 did not execute: exit {result.returncode}")
        rows.append({"name": "audit-gate2", "command": command, "exit_code": result.returncode,
            "result": "RECORDED", "log": path.name, "sha256": tag(path.read_bytes())})
        success = True
    except Exception as e:
        error = str(e)
        print(f"X0X-PQ FAIL: {error}", file=sys.stderr)
    finally:
        sources = [CRATE / "Cargo.toml", CRATE / "inventory.json", *sorted((CRATE / "src").rglob("*.rs")),
            ROOT / "crates/btungsten-pq/kat-manifest.json", *sorted((ROOT / "crates/btungsten-pq/src").glob("*.rs")), Path(__file__).resolve()]
        evidence = {"schema": "btungsten.x0x-pq-run/1", "started_utc": started,
            "completed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "result": "PASS" if success else "FAIL", "error": error, "runs": rows,
            "host": platform.platform(), "rustc": subprocess.check_output(["rustc", "--version"], text=True).strip(),
            "battery_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "battery_worktree_diff": tag(subprocess.check_output(["git", "diff", "--", "crates/btungsten-pq"], cwd=ROOT)),
            "lock_sha256": tag((CRATE / "Cargo.lock").read_bytes()),
            "source_sha256": {str(p.relative_to(ROOT)): tag(p.read_bytes()) for p in sources},
            "scope": "local KAT, DIFFERENTIAL and TEETH; no Cryptol equivalence or full-system qualification"}
        (out / "run.json").write_text(json.dumps(evidence, indent=2) + "\n")
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
