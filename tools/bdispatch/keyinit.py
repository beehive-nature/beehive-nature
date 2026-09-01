#!/usr/bin/env python3
"""keyinit — mint (once) the `bclaude` Nostr key straight into the OS keyring
(Windows Credential Manager: service `bnr/bclaude/nsec`, user `bclaude`).
Prints ONLY the public key (npub, then hex). The secret is never printed, never
written to disk by this script, never placed in an env var. Idempotent."""
import keyring
from nostr_sdk import Keys

SVC, USR = "bnr/bclaude/nsec", "bclaude"
if not keyring.get_password(SVC, USR):
    k = Keys.generate()
    keyring.set_password(SVC, USR, k.secret_key().to_bech32())
    del k
pub = Keys.parse(keyring.get_password(SVC, USR)).public_key()
print(pub.to_bech32())
print(pub.to_hex())
