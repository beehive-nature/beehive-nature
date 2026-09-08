"""Independent regression check, mounted read-only outside the editable worktree."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("triage", Path.cwd() / "scripts/buzz-mail/triage.py")
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)


class AttachmentBoundary(unittest.TestCase):
    def check_mail(self, attached_type, attachment_body):
        raw = ("Subject: Outer\nContent-Type: multipart/mixed; boundary=outer\n\n"
               "--outer\nContent-Type: text/plain\n\nVisible body\n"
               "--outer\nContent-Type: " + attached_type + "\n"
               'Content-Disposition: attachment; filename="example.eml"\n\n' +
               attachment_body + "\n--outer--\n").encode()
        text, hold = t.extract(raw)
        self.assertIsNone(hold)
        self.assertIn("Visible body", text)
        self.assertNotIn("ATTACHMENT_PRIVATE", text)

    def test_attached_email_body_excluded(self):
        self.check_mail("message/rfc822", "Subject: Inner\nContent-Type: text/plain\n\nATTACHMENT_PRIVATE")

    def test_attached_multipart_subtree_excluded(self):
        self.check_mail("multipart/mixed; boundary=inner",
                        "--inner\nContent-Type: text/plain\n\nATTACHMENT_PRIVATE\n--inner--")

    def test_inline_alternative_still_keeps_plain_text(self):
        text, hold = t.extract(b"Subject: Hello\nContent-Type: multipart/alternative; boundary=a\n\n"
                               b"--a\nContent-Type: text/plain\n\nVisible body\n"
                               b"--a\nContent-Type: text/html\n\n<b>html</b>\n--a--")
        self.assertIsNone(hold)
        self.assertIn("Visible body", text)
        self.assertNotIn("<b>", text)


if __name__ == "__main__":
    unittest.main()
