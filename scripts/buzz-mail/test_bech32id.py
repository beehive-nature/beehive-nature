#!/usr/bin/env python3
"""test_bech32id.py — the encoding half of the identity path.

bech32 is a checksummed ENCODING, not cryptography; this module exists so
roster files can carry npub strings without hex-run false positives in the
secret scanner. Correctness is pinned to the canonical NIP-19 example
vector, plus round-trip and checksum-rejection properties.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bech32id  # noqa: E402

# Canonical NIP-19 documentation examples (public test vectors),
# cross-verified against pinned nostr-tools 2.25.2 (nip19.decode/encode):
NPUB_SNOWN = "npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9"  # PUBLIC-CONSTANT: NIP-19 example npub
HEX_SNOWN = "84dee6e676e5bb67b4ad4e042cf70cbd8681155db535942fcc6a0533858a7240"  # PUBLIC-CONSTANT: NIP-19 example hex
NPUB_180C = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"  # PUBLIC-CONSTANT: NIP-19 example npub
HEX_180C = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"  # PUBLIC-CONSTANT: NIP-19 example hex


class Bech32IdTest(unittest.TestCase):
    def test_canonical_nip19_vectors(self):
        self.assertEqual(bech32id.npub_decode(NPUB_SNOWN).hex(), HEX_SNOWN)
        self.assertEqual(bech32id.npub_encode(bytes.fromhex(HEX_SNOWN)), NPUB_SNOWN)
        self.assertEqual(bech32id.npub_decode(NPUB_180C).hex(), HEX_180C)
        self.assertEqual(bech32id.npub_encode(bytes.fromhex(HEX_180C)), NPUB_180C)

    def test_roundtrip_programmatic_bytes(self):
        for i in range(8):
            fixture = bytes((i * 7 + j) % 256 for j in range(32))  # programmatic fixtures — not key material
            self.assertEqual(bech32id.npub_decode(bech32id.npub_encode(fixture)), fixture)

    def test_checksum_tamper_rejected(self):
        tampered = NPUB_SNOWN[:-1] + ("q" if NPUB_SNOWN[-1] != "q" else "p")
        with self.assertRaises(ValueError):
            bech32id.npub_decode(tampered)

    def test_wrong_hrp_rejected(self):
        nsec_shaped = "nsec1" + NPUB_SNOWN[5:]
        with self.assertRaises(ValueError):
            bech32id.npub_decode(nsec_shaped)


if __name__ == "__main__":
    unittest.main(verbosity=2)
