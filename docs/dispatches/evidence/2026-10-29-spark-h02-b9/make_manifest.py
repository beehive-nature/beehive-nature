"""Deterministic generator for the frozen B9 rehearsal manifest.

Rerunning `python make_manifest.py` reproduces manifest.json byte for
byte: no randomness, no timestamps. JSON is UTF-8, LF newlines, one
trailing newline. The "items" array holds exactly 40 clearly synthetic
biomass records; entry 23 is an exact duplicate of entry 7, and the
governing count (elements of the top-level object's "items" array,
duplicates included) is therefore 40.
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLOTS = ("SYN-PLOT-A", "SYN-PLOT-B", "SYN-PLOT-C", "SYN-PLOT-D")


def record(i: int) -> dict:
    return {
        "id": f"bio-syn-{i:03d}",
        "kind": "synthetic-biomass",
        "plot": PLOTS[(i - 1) % len(PLOTS)],
        "mass_kg": round(5.0 + i * 1.25, 2),
    }


def main() -> None:
    items = [record(i) for i in range(1, 41)]
    items[22] = dict(items[6])  # entry 23 duplicates entry 7 exactly
    assert len(items) == 40
    assert items[22] == items[6]
    text = json.dumps({"items": items}, indent=2) + "\n"
    assert "\r" not in text
    (HERE / "manifest.json").write_bytes(text.encode("utf-8"))
    print(f"wrote {len(items)} items, {len(text.encode('utf-8'))} bytes")


if __name__ == "__main__":
    main()
