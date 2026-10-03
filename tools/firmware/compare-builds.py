"""Fail-closed byte comparison of two pinned firmware checkouts.

This checks source pins and artifact equality, not signing authority, device
safety, independent builders, or whether a build command actually ran. Keep
the two build logs and exit codes with the generated receipt.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def inspect(root, revision, artifacts):
    if git(root, "rev-parse", "HEAD") != revision:
        raise ValueError(f"Wrong source revision: {root}")
    if git(root, "status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"):
        raise ValueError(f"Dirty source: {root}")
    # Preserve the leading status character: '-' means uninitialized, '+' means
    # a different commit, and 'U' means a conflict.
    modules = subprocess.check_output(
        ["git", "-C", str(root), "submodule", "status", "--recursive"], text=True
    ).splitlines()
    if any(not line.startswith(" ") for line in modules):
        raise ValueError(f"Unpinned or missing submodule: {root}")
    pins = [line.strip().split()[:2] for line in modules]
    files = {}
    for relative in artifacts:
        path = (root / relative).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"Missing artifact or path outside checkout: {relative}")
        data = path.read_bytes()
        if not data:
            raise ValueError(f"Empty artifact: {relative}")
        files[relative] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return {"checkout": str(root), "revision": revision, "submodules": pins, "artifacts": files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first", type=Path)
    parser.add_argument("second", type=Path)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--artifact", action="append", required=True)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    result = {"classification": "PUBLIC-CONSTANT", "byte_identical": False,
              "hardware_acceptance": False, "build_execution_verified_by_this_tool": False}
    try:
        first, second = args.first.resolve(), args.second.resolve()
        if first == second:
            raise ValueError("Two distinct checkouts are required")
        result["builds"] = [inspect(root, args.revision, args.artifact) for root in (first, second)]
        a, b = result["builds"]
        if a["submodules"] != b["submodules"]:
            raise ValueError("Submodule pins differ")
        if a["artifacts"] != b["artifacts"]:
            raise ValueError("Firmware bytes differ")
        result["byte_identical"] = True
    except (ValueError, subprocess.CalledProcessError, OSError) as exc:
        result["error"] = str(exc)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    # Public artifact hashes, never keys. One line retains the classification
    # alongside hashes for the repository's secret-scanning convention.
    args.receipt.write_text(json.dumps(result, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"byte_identical": result["byte_identical"], "error": result.get("error")}))
    return 0 if result["byte_identical"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
