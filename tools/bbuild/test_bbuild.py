import hashlib
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import broker
import recipe

SOURCE = "import json\n\ndef extract(raw):\n    return raw\n\ndef validate_result(value):\n    return value\n"
BASE = "a" * 40


class BuildBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(broker, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def job(self, **values):
        job = {"id": "fixture-job", "base": BASE, "worker": "laptop", "recipe": recipe.RECIPE,
               "status": "prepared", "old_hash": "fixture", "replacement": "fixture", "attempts": 1,
               "validator_hash": "fixture", "authoring": "local Qwen2.5-3B"}
        job.update(values)
        broker.save(job)
        return job

    def test_rejects_path_like_ids_and_non_commit_refs(self):
        for value in ("../escape", "--help", "a/b", "x;whoami"):
            with self.assertRaises(ValueError): recipe.valid_id(value)
        for value in ("main", "HEAD~1", "--all", "a" * 39):
            with self.assertRaises(ValueError): recipe.valid_sha(value)

    def test_model_can_only_replace_one_function(self):
        for value in ({"replacement": "def extract(raw):\n return raw\n\nimport os"},
                      {"replacement": "def different(raw):\n return raw"},
                      {"replacement": "def extract(raw):\n return raw", "run": "shell"}):
            with self.assertRaises(ValueError): recipe.replacement(value)

    def test_patch_checks_original_region_and_symlinks(self):
        path = self.root / recipe.PATH
        path.parent.mkdir(parents=True)
        path.write_text(SOURCE)
        old_hash = hashlib.sha256(recipe.region(SOURCE).encode()).hexdigest()
        with self.assertRaisesRegex(ValueError, "source_changed"):
            recipe.apply(self.root, "wrong", "def extract(raw):\n    return None")
        recipe.apply(self.root, old_hash, "def extract(raw):\n    return None")
        self.assertIn("def validate_result(value):\n    return value", path.read_text())
        path.unlink()
        path.symlink_to(self.root / "outside")
        with self.assertRaisesRegex(ValueError, "patch_path"):
            recipe.apply(self.root, old_hash, "def extract(raw):\n    return None")

    def test_lease_excludes_second_worker_and_reclaims_expired_token(self):
        self.job()
        first = broker.claim("laptop", 60)
        self.assertIsNone(broker.claim("laptop", 60))
        job = broker.load("fixture-job")
        job["lease_until"] = time.time() - 1
        broker.save(job)
        second = broker.claim("laptop", 60)
        self.assertNotEqual(first["lease_token"], second["lease_token"])
        with self.assertRaisesRegex(ValueError, "stale_worker_token"):
            broker.finish({"id": "fixture-job", "lease_token": first["lease_token"], "ok": False})

    def test_wrong_worker_and_expired_completion_refused(self):
        self.job()
        self.assertIsNone(broker.claim("vps", 60))
        lease = broker.claim("laptop", 60)
        job = broker.load("fixture-job")
        job["lease_until"] = time.time() - 1
        broker.save(job)
        with self.assertRaisesRegex(ValueError, "expired_worker_lease"):
            broker.finish({"id": "fixture-job", "lease_token": lease["lease_token"], "ok": False})

    def test_missing_checks_refused_before_bundle_import(self):
        self.job()
        lease = broker.claim("laptop", 60)
        with self.assertRaisesRegex(ValueError, "required_checks_missing"):
            broker.finish({"id": "fixture-job", "lease_token": lease["lease_token"], "ok": True,
                           "commit": "b" * 40, "checks": []})

    def test_public_status_never_contains_token_patch_or_outbox(self):
        job = self.job(lease_token="private", replacement="source", outbox={"event": "signed"})
        status = broker.public_status(job)
        self.assertNotIn("lease_token", status)
        self.assertNotIn("replacement", status)
        self.assertNotIn("outbox", status)

    def test_admission_id_conflict_refused(self):
        self.job()
        with self.assertRaisesRegex(ValueError, "job_id_scope_conflict"):
            broker.enqueue("fixture-job", "b" * 40, "laptop")

    def test_outbox_persists_before_send_and_reuses_event_after_failure(self):
        job = self.job()
        class Bridge:
            created = 0
            sent = []
            def event(self, text):
                self.created += 1
                return {"id": "fixture-event", "content": text}
            def deliver(self, event):
                self.sent.append(event)
                self_test.assertEqual(broker.load("fixture-job")["outbox"]["ack"]["event"], event)
                if len(self.sent) == 1: raise RuntimeError("network")
        self_test = self
        bridge = Bridge()
        with patch.object(broker, "buzz", return_value=bridge):
            with self.assertRaises(RuntimeError): broker.notify(job, "ack", "hello")
            broker.notify(broker.load("fixture-job"), "ack", "different text")
        self.assertEqual(bridge.created, 1)
        self.assertEqual(bridge.sent[0], bridge.sent[1])
        self.assertTrue(broker.load("fixture-job")["outbox"]["ack"]["delivered"])

    def test_prepare_retry_budget_survives_crash_state(self):
        self.job(status="preparing", attempts=2, prepare_until=time.time() - 1)
        broker.tick()
        self.assertEqual(broker.load("fixture-job")["status"], "needs_attention")

    def test_supervision_preserves_failed_proposal_and_author(self):
        self.job(status="needs_attention", error="worker_checks_failed")
        with patch.object(broker, "notify"):
            broker.supervise("fixture-job", {"replacement": "def extract(raw):\n    return None"})
        job = broker.load("fixture-job")
        self.assertEqual(job["authoring"], "Codex supervisor")
        self.assertEqual(job["supervision"][0]["prior_replacement"], "fixture")
        self.assertEqual(job["base"], BASE)

    def test_result_retry_after_verification_does_not_repeat_import(self):
        self.job(status="verified", lease_token="fixture-token", commit="b" * 40)
        result = broker.finish({"id": "fixture-job", "lease_token": "fixture-token", "commit": "b" * 40})
        self.assertEqual(result["status"], "verified")

    def test_publication_requires_independent_verification(self):
        self.job(status="returned", commit="b" * 40)
        with self.assertRaisesRegex(ValueError, "job_not_verified"):
            broker.publish("fixture-job", "b" * 40)


if __name__ == "__main__":
    unittest.main()
