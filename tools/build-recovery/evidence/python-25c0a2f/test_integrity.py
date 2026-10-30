"""Decision-changing refusal controls; no compilation or network access."""
import json
from pathlib import Path
import tempfile
import unittest

from bsigner import inventory, verify_snapshot, write_json


class SnapshotIntegrity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "source").mkdir()
        (self.root / "source/input").write_text("retained fixture")
        write_json(self.root / "manifest.json", inventory(self.root))

    def test_retained_bytes_pass_and_changed_same_size_bytes_refuse(self):
        verify_snapshot(self.root)
        (self.root / "source/input").write_text("retained fixturE")
        with self.assertRaisesRegex(ValueError, "bytes changed"):
            verify_snapshot(self.root)

    def test_missing_and_extra_inputs_refuse(self):
        (self.root / "source/input").unlink()
        with self.assertRaisesRegex(ValueError, "inventory changed"):
            verify_snapshot(self.root)
        (self.root / "source/input").write_text("retained fixture")
        (self.root / "unexpected").write_text("injected configuration")
        with self.assertRaisesRegex(ValueError, "inventory changed"):
            verify_snapshot(self.root)

    def test_file_replaced_by_symlink_refuses(self):
        path = self.root / "source/input"
        path.unlink()
        path.symlink_to("../../outside")
        with self.assertRaisesRegex(ValueError, "bytes changed"):
            verify_snapshot(self.root)

    def test_manifest_cannot_name_parent_or_duplicate(self):
        manifest = self.root / "manifest.json"
        rows = json.loads(manifest.read_text())
        write_json(manifest, rows + rows)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            verify_snapshot(self.root)
        rows[0]["path"] = "../outside"
        write_json(manifest, rows)
        with self.assertRaisesRegex(ValueError, "escapes"):
            verify_snapshot(self.root)


if __name__ == "__main__":
    unittest.main()
