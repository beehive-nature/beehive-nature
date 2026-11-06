"""Independent B9 frozen-manifest checker (stdlib only).

Recomputes the raw-byte SHA-256 of manifest.json WITHOUT parsing or
reserializing it, then parses a separate decoded copy solely to count
the elements of the top-level object's "items" array (duplicates
included; anything else fails closed), and compares hash, count and
byte length against EXPECTED.json.

This checker does not invoke the production counting function (a Rust
item in the harness crate, unreachable from here): it is the
independent record of hash + count. Exit 0 means MATCH; exit 1 means
MISMATCH (or missing/unparsable file) -- never a pass.
"""

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def count_items(raw: bytes) -> int:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("manifest is not UTF-8")
    value = json.loads(text)
    if isinstance(value, dict) and isinstance(value.get("items"), list):
        return len(value["items"])
    if isinstance(value, list):
        return len(value)
    raise ValueError("not a B9 manifest: no top-level array or items array")


def main() -> int:
    manifest_path = HERE / "manifest.json"
    expected_path = HERE / "EXPECTED.json"
    try:
        raw = manifest_path.read_bytes()
    except OSError as exc:
        print(f"MISSING manifest.json: {exc}")
        return 1
    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    try:
        item_count = count_items(raw)
    except ValueError as exc:
        print(f"MANIFEST REJECTED: {exc}")
        return 1
    actual = {
        "input_sha256": hashlib.sha256(raw).hexdigest(),
        "item_count": item_count,
        "input_bytes": len(raw),
    }
    ok = all(actual[key] == expected[key] for key in actual)
    print(f"input_bytes:  {actual['input_bytes']} (expected {expected['input_bytes']})")
    print(f"input_sha256: {actual['input_sha256']}")
    print(f"              expected {expected['input_sha256']}")
    print(f"item_count:   {actual['item_count']} (expected {expected['item_count']})")
    print(f"order_id:     {expected['order_id']}")
    print("MATCH" if ok else "MISMATCH")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
