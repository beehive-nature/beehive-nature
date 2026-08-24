# Why changing one byte of a file causes a full re-upload in a content-addressed store

**The symptom, in the words you'd search for:** your content-addressed storage (self-encrypting /
chunked / deduplicating — IPFS, Autonomi-style networks, restic/borg-style backup stores) is
supposed to deduplicate. But editing one byte of a large file re-uploads a large fraction of it —
sometimes nearly all of it. The store isn't broken; dedup is **exact-bytes** and everything
downstream of the first changed byte legitimately no longer matches.

## Why one byte cascades

Content addressing names data by the cryptographic hash of its bytes. A large file is split into
chunks; each chunk's address is the hash of that chunk's exact bytes; the file is reassembled from
a list of chunk addresses. Dedup happens when — and only when — a chunk's bytes are identical to
a chunk the store already holds.

Change one byte and, depending on the chunking scheme:

- **Fixed-size chunking:** every chunk boundary after the change point shifts by the edit offset.
  A one-byte insertion at the front means *no* chunk after chunk 1 matches the old chunks. Nearly
  the whole file re-stores.
- **Content-defined chunking (CDC, e.g. rolling-hash boundaries at content-dependent offsets):**
  boundaries after the edit re-anchor at the next stable rolling-hash window, so the cascade
  stops some bounded distance after the change — typically a few chunk sizes, not the whole file.
  This is *mitigation*, not elimination: the affected window still re-stores, because its bytes
  genuinely differ.

The store is behaving correctly. Two byte strings hash equal only if they are equal. Any tool that
"duplicates" your data without matching bytes is matching on something weaker than content
(filenames, metadata, approximate hashes) — and none of those are dedup guarantees.

The same law cuts the other way, and it's a feature: identical bytes stored by a million
different users, under a million different names, are stored once.

## The design law: untagged stream + metadata sidecar

The failure mode to design against is *tagging the stream*. If you embed identity metadata —
owner, version, sequence numbers, timestamps, permissions — inside the bytes that get chunked and
hashed, then:

- every metadata change re-hashes the content it labels, even when the content didn't change;
- two users' copies of the *same* content hash differently because their metadata differs, so
  dedup silently dies;
- encryption that mixes metadata into the content layer makes the divergence permanent — the
  ciphertexts differ, so nothing downstream can ever match.

The law: **the stream you content-address must be the untagged bytes, and everything else lives
in a metadata sidecar that is stored/referenced alongside, never interleaved.**

Concretely:

- Chunk and hash the raw content stream — nothing prepended, nothing interleaved.
- Carry names, ownership, versions, permissions, and content-type in a separate small record
  that *references* the content's chunk list. Updating the sidecar touches only the sidecar.
- Encrypt content before addressing if the scheme requires it, but keep metadata out of the
  content ciphertext's inputs except where the scheme's security genuinely demands it (e.g.
  per-chunk authentication), and know exactly which of those inputs break byte-identity.
- If your format must be self-describing, put the description *after* the addressed payload, or
  in a header excluded from chunk hashing by construction — never mid-stream.

## Operational checklist

1. Confirm your store chunks with a content-defined algorithm if edits-then-reupload is your
   normal workload; fixed-size chunking is fine for write-once data.
2. Audit any pre/append/interleave your application does to bytes before they reach the chunker.
   Each one is a dedup break.
3. When measuring dedup ratios, change content and metadata separately. A metadata-only change
   that re-stores content means the layering is wrong.
4. Expect the cascade, size it (a few chunk lengths for CDC), and schedule uploads accordingly.

## Credits

The untagged-stream + metadata-sidecar design law and the exact-bytes cascade observations come
from the Beehive Nature Relay community diagnostics of 2026-08 (AntTP findings by **traktion**;
W@tch findings by **aautonomicc**); this article is the write-up of their findings.
