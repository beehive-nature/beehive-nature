# SPEC-MIRROR-COMMONS-1 — mirror the cited record before it moves again

**Status: ACTIVE — phase 1 runs today; phase 3 gated on AT-2.** Seat 3 (Fable 5), 2026-08-21.
**Founder's order, verbatim:** *"we should start mirroring all the open BeGin (for example)
like surfaces with source hyperlinks to AR/ANT-bigfile-most effeciant to general commons
all the data before the next gov admin deletes it all"*

**Why this lane exists is already receipted in this tree:** both whitehouse.gov citations
on the bSymposium died within a year because slugs changed between administrations, and
the MAHA Assessment PDF now served was produced the evening of 2025-05-29 — hours after
the citation reporting — replacing the original with no correction notice. The record
moves. The mirror is how our surfaces stay checkable anyway.

---

## 1 · THE COPYRIGHT FENCE — what may be mirrored vs what may only be witnessed

- **MIRRORED (payload + hash):** works of the United States federal government —
  Federal Register documents, govinfo statute and court texts, FDA/USDA/NIH pages, the
  MAHA Assessment, the DGA, the *Aragon* opinion. Public domain under 17 U.S.C. §105.
  International-government documents (FSANZ, Health Canada, WHO) are mirrored where the
  publisher's terms permit reproduction with attribution, and **witness-only otherwise**.
- **WITNESSED ONLY (hash + archive pointer, never republished):** news reporting
  (NOTUS, PBS, Baltimore Sun), journal pages, McGill OSS — copyrighted. For these the
  lane records the URL + fetch date + sha256 of what this host received, and requests a
  **Wayback Machine capture** (archive.org carries its own rights regime). We prove what
  the page said without redistributing it.

## 2 · THE THREE PHASES

1. **HARVEST (now, free, no ceremony):** `scripts/mirror-harvest.mjs` fetches every
   registered source, writes payloads to the **off-repo staging vault**
   (`C:\Users\travi\beehive-mirror\`), and commits only
   `docs/mirror/MANIFEST.json` — url · class (mirror/witness) · fetch date · sha256 ·
   bytes · content-type. **The manifest is the ground truth**: when the AR/ANT uploads
   land, anyone can verify the stored bytes are the bytes this host fetched today.
2. **WAYBACK (now, free):** a save request fires for every registered URL, mirror-class
   and witness-class alike — a second, independent custodian that costs nothing.
3. **PERMANENT COMMONS (gated on AT-2, the Trezor ceremony):** mirror-class payloads
   upload to **Arweave and/or Autonomi** under `SPEC-AUTONOMI-TREZOR-1`'s flow — the
   founder signs, the seat prepares. "Most efficient" is measured, not assumed:
   `ant file cost` vs current AR pricing on the actual staging vault, both numbers into
   the receipt, the founder picks at signing time. Addresses land back in the manifest
   as `permanent[]` entries, making every surface's citation row upgradeable to
   `source · archive · permanent` triples.

## 3 · THE REGISTER — what gets harvested first

The initial register is the **verified citation set of the evidence surfaces**: every
government-primary URL on bSymposium (EO 14212 FR + whitehouse copies, both Assessment
PDF slugs, the Strategy releases, the FDA Red 3 + dye-programme pages, the *Aragon*
opinion PDF, the SNAP waiver tracker), the DGA 2025–2030 PDF, the NASEM/NBK DRI pages
bFood's requirements rest on, and the FSANZ hemp survey PDF the cannabinoid receipt
rests on. The register grows by ordinary commits; any seat may add a source with its
class stated.

## 4 · LAWS

- A mirror entry without a sha256 is not an entry.
- A witness entry never carries a payload into any public repo — hash and pointers only.
- The manifest never claims "archived" for a Wayback request that did not return 200 —
  requests are recorded as requested/confirmed, two different words.
- Personal data never enters this lane; it has its own (SPEC-AUTONOMI-TREZOR-1, AT-3).
- Re-harvest on change: if a re-fetch hashes differently, the old entry is **kept** and
  the new one appended — the manifest is an append-only history of what the record said
  when. A government PDF silently changing is precisely the event this lane exists to
  catch, and the MAHA Assessment has already demonstrated it once.
- **The public-upload disclosure (T5, 2026-08-25).** A `--public` Autonomi upload stores
  its root data map as a **plaintext chunk** on the network — any node operator can
  trawl chunks for valid maps and read the whole file (the reason Watch-It dropped
  public XOR addresses as an entry type in alpha.40; `docs/ARCHITECTURE.md` carries the
  mechanism). A private upload writes the same encrypted chunks and keeps the map local,
  where the chunks are unlinkable noise. **"We uploaded it to Autonomi" is therefore not
  a privacy claim and this spec never lets it sound like one:** every `--public` act
  names itself as a deliberate publication rather than a default. For this lane that is
  the honest description — mirror-class payloads are public-domain government works and
  publication is the intent, recorded as such at signing time. Witness-class payloads
  never ride a `--public` upload (they never leave hash + pointers), and anything with a
  person in it has its own ceremony and is not mirrored here at all. Read-path receipts
  from public files (antget's address is a public file by design) are unaffected.

🐝
