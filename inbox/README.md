# bDroP inbox — founder drop point

Expected here, verbatim from the preparing session's card:

- `bdrop-0001-genesis.md` — the 9,735-byte genesis post body
  (reported SHA-256 `9fa6998d548e8f4afd0a7e17fa2a11ea50a0db18b1808d74f985931ff6d825e9` PUBLIC-CONSTANT)
- `bdrop-0001-genesis-packet.zip` — the publication packet (unsigned Hive operation + checksums)

Laws for anything landing here: bytes are accepted as-received, the hash is
recomputed at the point of use, and nothing under `inbox/` is committed or
broadcast until that verification passes. See
`docs/dispatches/2026-10-09-bdrop.md`.
