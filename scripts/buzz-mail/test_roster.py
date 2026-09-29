#!/usr/bin/env python3
"""test_roster.py — the roster's single-source and fail-loud laws.

The sink's KNOWN set is the ONLY accepted-address authority; roster.json
must cover it exactly and fail closed on drift. Bindings without a cited
'verified:' status are not usable, even with an npub present.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bech32id  # noqa: E402
import roster as roster_mod  # noqa: E402


class RosterTest(unittest.TestCase):
    def test_known_locals_parsed_from_sink_bytes(self):
        # the pin follows sink.py KNOWN, the single source: main grew it
        # 6 -> 11 while this branch was in review (19414582 bgrokbot,
        # 1ebee3d1 bfable+bee-laborer+bopus5, df01bdee bcodexastra);
        # reconciled 2026-09-21 onto c0ec1596
        locals_ = roster_mod.known_locals_from_sink()
        self.assertEqual(locals_, {"bclaude", "bcodexastra", "bee-laborer", "bfable", "bfuzz", "bgrokbot", "bopus5", "bqueenbee", "bzcode", "claude-code", "honeybee"})

    def test_load_matches_known_exactly(self):
        resolved = roster_mod.load()
        self.assertEqual(set(resolved["mailboxes"]), roster_mod.known_locals_from_sink())
        self.assertTrue(set(resolved["historical"]).isdisjoint(resolved["mailboxes"]))

    def test_shipped_roster_has_no_verified_binding_yet(self):
        """Every binding ships unverified — no mailbox-assignment receipt
        exists (1e18cbf8 #2); enforcement must therefore hold everything."""
        resolved = roster_mod.load()
        for local, entry in resolved["mailboxes"].items():
            self.assertIsNone(entry["npub"], f"{local} carries an npub without a receipt")
            self.assertFalse(str(entry["binding"]).startswith("verified:"))

    def test_drift_missing_local_fails_loud(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "roster.json"
            raw = json.loads((Path(__file__).parent / "roster.json").read_text())
            raw["mailboxes"].pop("bzcode")
            path.write_text(json.dumps(raw))
            with self.assertRaises(roster_mod.RosterError):
                roster_mod.load(path)

    def test_drift_extra_local_fails_loud(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "roster.json"
            raw = json.loads((Path(__file__).parent / "roster.json").read_text())
            raw["mailboxes"]["intruder"] = {"npub": None, "binding": "unverified"}
            path.write_text(json.dumps(raw))
            with self.assertRaises(roster_mod.RosterError):
                roster_mod.load(path)

    def test_npub_resolves_to_hex(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "roster.json"
            raw = json.loads((Path(__file__).parent / "roster.json").read_text())
            fixture = bytes(range(32))  # programmatic fixture bytes — not key material
            raw["mailboxes"]["bzcode"] = {"npub": bech32id.npub_encode(fixture), "binding": "verified:fixture-receipt"}
            path.write_text(json.dumps(raw))
            resolved = roster_mod.load(path)
            self.assertEqual(resolved["mailboxes"]["bzcode"]["npub"], fixture)
            self.assertTrue(str(resolved["mailboxes"]["bzcode"]["binding"]).startswith("verified:"))

    def test_bad_npub_fails_loud(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "roster.json"
            raw = json.loads((Path(__file__).parent / "roster.json").read_text())
            raw["mailboxes"]["bzcode"] = {"npub": "npub1zz-not-a-real-key-zz-not-a-real-key-zz", "binding": "verified:x"}
            path.write_text(json.dumps(raw))
            with self.assertRaises(ValueError):
                roster_mod.load(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
