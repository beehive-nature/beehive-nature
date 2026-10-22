# Birth republication — staged for the Buzz-app side

The Spark pool agent's birth (kind 31337 status + kind 31340
identity proof, DID `did:b:pq2ji…mfda`, ML-DSA-65 envelope
`verified: true`) landed on local evidence relays only: the
production relay requires NIP-42 auth this terminal seat cannot
perform, and `skaists.buzz` resets this laptop's connections.

Staged here for republication from inside the Buzz app (which
holds the relay identity): `birth-statement.json` (the signed
statement), `birth-statement.json.sig.json` (the bsigner
envelope), and `republish.mjs` (shapes + instructions; the key
comes from app env, never a file). This is staged, not forced —
no production write was attempted beyond the refused publish.
