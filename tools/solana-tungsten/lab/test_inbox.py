import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from inbox import Inbox


class DurableInboxTest(unittest.TestCase):
    def test_restart_replay_and_changed_payload(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/'inbox.db'
            inbox = Inbox(path)
            self.assertTrue(inbox.receive('sender','job',b'proof'))
            inbox.close()
            recovered = Inbox(path)
            self.assertFalse(recovered.receive('sender','job',b'proof'))
            with self.assertRaisesRegex(ValueError,'conflict'):
                recovered.receive('sender','job',b'changed proof')
            self.assertEqual(recovered.count(),1)
            self.assertEqual(recovered.payload('sender','job'),b'proof')
            self.assertTrue(recovered.receive('other-sender','job',b'other proof'))
            recovered.close()

    def test_two_connections_reserve_once(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/'inbox.db'
            Inbox(path).close()
            def receive(_):
                inbox = Inbox(path)
                try:
                    return inbox.receive('sender','same-job',b'same-proof')
                finally:
                    inbox.close()
            with ThreadPoolExecutor(max_workers=2) as pool:
                self.assertEqual(sum(pool.map(receive,range(2))),1)


if __name__ == '__main__':
    unittest.main()
