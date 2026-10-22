#!/usr/bin/env python3
"""Verify pins, execute prepared-key assurance/controls and retain timings.

Experimental public-key comparator only; no dependency or system qualification.
Requires Python 3.11+, Rust and curl. No mesh connections or secret receipts.
"""
import argparse
import datetime
import importlib.util
import json
from pathlib import Path
import platform
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
CRATE = ROOT / "crates/btungsten-x0x-pq"
SPEC = importlib.util.spec_from_file_location("pins", ROOT / "scripts/btungsten/x0x-pq-check.py")
PINS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PINS)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "target/pq-speed")
    parser.add_argument("--cache", type=Path, default=ROOT / "target/pq-vectors")
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    error = None
    binary_hash = None

    def run(name, command, expected=0):
        log = out / f"{name}.log"
        start = time.monotonic()
        with log.open("w") as stream:
            result = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, timeout=1200)
        rows.append({"name": name, "command": command, "exit_code": result.returncode,
                     "expected_exit": expected, "seconds": time.monotonic() - start,
                     "log": log.name, "sha256": PINS.tag(log.read_bytes())})
        if result.returncode != expected:
            raise RuntimeError(f"{name}: exit {result.returncode}, expected {expected}; see {log.name}")

    try:
        PINS.verify_sources(out)
        manifest = str(CRATE / "Cargo.toml")
        run("build", ["cargo", "build", "--locked", "--release", "--manifest-path", manifest, "--bin", "pq-speed"])
        meta = json.loads(subprocess.check_output(["cargo", "metadata", "--no-deps", "--format-version", "1",
                                                  "--manifest-path", manifest], cwd=ROOT))
        binary = Path(meta["target_directory"]) / "release/pq-speed"
        binary_hash = PINS.tag(binary.read_bytes())
        for name, flags, expected in [("honest-1", [], 0), ("honest-2", [], 0),
                                     ("accept-teeth", ["--sabotage-accept"], 1),
                                     ("truncate-teeth", ["--sabotage-truncate"], 1),
                                     ("empty-teeth", ["--empty-vectors"], 1)]:
            receipt = out / f"{name}.json"
            receipt.unlink(missing_ok=True)
            run(name, [str(binary), "--cache", str(args.cache.resolve()), "--receipt", str(receipt), *flags], expected)
            evidence = json.loads(receipt.read_text())
            tally = evidence["assurance"]
            if name == "empty-teeth":
                if evidence["result"] != "FAIL" or evidence["coverage_complete"] or tally["executed"] != 0 or evidence["timings"] or len(evidence["missing"]) != evidence["required_rows"]:
                    raise RuntimeError("empty coverage did not refuse before timing")
                print("PQ-SPEED empty-teeth: zero cases refused; no timings", flush=True)
                continue
            if not evidence["coverage_complete"] or tally["executed"] == 0 or evidence["missing"]:
                raise RuntimeError(f"{name}: incomplete coverage")
            if flags:
                target = "TEETH empty signature" if name == "accept-teeth" else "TEETH last message byte"
                if evidence["result"] != "FAIL" or not any(f.startswith(target) for f in tally["failures"]) or evidence["timings"]:
                    raise RuntimeError(f"{name}: did not convict the specific defect before timing")
            elif evidence["result"] != "PASS" or tally["failures"] or len(evidence["timings"]) != 4:
                raise RuntimeError(f"{name}: assurance/benchmark incomplete")
            print(f"PQ-SPEED {name}: {tally['passed']}/{tally['executed']}; {len(tally['failures'])} failures", flush=True)
            for timing in evidence["timings"]:
                print(f"  {timing['message_bytes']} B: API {timing['speedup_vs_api_warm']:.3f}x; "
                      f"ANT legacy {timing['speedup_vs_ant_legacy_warm']:.3f}x; cold {timing['speedup_vs_api_cold']:.3f}x", flush=True)
        # The candidate remains outside the shipping BNR workspace.
        result = subprocess.run(["cargo", "tree", "--locked", "--workspace", "-e", "normal", "-i", "saorsa-pqc"],
                                cwd=ROOT, capture_output=True, text=True, timeout=120)
        (out / "default-graph.log").write_text(result.stdout + result.stderr)
        if result.returncode == 0 or "did not match any packages" not in result.stderr:
            raise RuntimeError("Saorsa absence from the default build not established")
    except Exception as exc:
        error = str(exc)
        print(f"PQ-SPEED ERROR: {error}", file=sys.stderr)
    finally:
        paths = [CRATE / "Cargo.toml", CRATE / "Cargo.lock", CRATE / "inventory.json",
                 *sorted((CRATE / "src").rglob("*.rs")), *sorted((ROOT / "crates/btungsten-pq/src").glob("*.rs")),
                 ROOT / "crates/btungsten-pq/kat-manifest.json", Path(__file__).resolve(),
                 ROOT / "scripts/btungsten/x0x-pq-check.py"]
        cpu = Path("/proc/cpuinfo")
        cpu_model = next((line.split(":", 1)[1].strip() for line in cpu.read_text().splitlines()
                          if line.startswith("model name")), "unknown") if cpu.exists() else "unknown"
        value = {"schema": "btungsten.pq-speed-run/1", "result": "PASS" if error is None else "FAIL", "error": error,
                 "started_utc": started, "completed_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 "runs": rows, "host": platform.platform(), "cpu_model": cpu_model,
                 "binary_sha256": binary_hash,
                 "rustc": subprocess.check_output(["rustc", "--version"], text=True).strip(),
                 "battery_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                 "source_sha256": {str(p.relative_to(ROOT)): PINS.tag(p.read_bytes()) for p in paths},
                 "files": {p.name: PINS.tag(p.read_bytes()) for p in sorted(out.iterdir()) if p.is_file() and p.name != "run.json"},
                 "scope": "experimental comparator; timings are host observations, no production performance guarantee",
                 "full_system_qualification": "UNESTABLISHED"}
        (out / "run.json").write_text(json.dumps(value, indent=2) + "\n")
    return 0 if error is None else 1


if __name__ == "__main__":
    sys.exit(main())
