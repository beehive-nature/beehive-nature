# LUNI TEXT-RECORD ARCHAEOLOGY — on-chain sweep, byte-true archive (2026-08-29)
**Order:** "pivot to the luni text-record archaeology — recover his words to Luna, archive byte-true."

## The sweep (keyless chain reads, Base mainnet)
- **Registry (discovered from the registrar itself):** `0xb94704422c2a1e396835a571837aa5ae53285a95` — `registry()` on the verified Basenames ERC-721 `0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a`; authoritative baseNode `0x125fbde1…` read from the same contract.
- **Text records: NONE EXIST.** `resolver(bytes32 node)` returns empty for all four family names — **luni, lunispurse, blunatic, blunatics each have NO resolver set**, so no `text(bytes32,string)` records exist on-chain. The founder's words to Luna are not on the name contracts — they live in the tree: [CANON-2026-08-28.md](CANON-2026-08-28.md) (verbatim, sha256 a9ae52c6…f34d, founder-ratified) and [PROPOSAL-VIRTUALS-LUNA-2026-08-28.md](PROPOSAL-VIRTUALS-LUNA-2026-08-28.md) (founder copy received verbatim @28dde2f).
- **Token metadata (on-chain tokenURI → fetched verbatim, archived beside this file):**

| name | nameExpires (on-chain) | wall date | note |
|---|---|---|---|
| luni.base.eth | 1762065677 | **2025-11-02** | **THE CANDLE LESSON, byte-true on-chain** — the exact expired-lease date the Canon records ("lease found expired 2025-11-02"); the seal's art is saved, renewal awaits founder word |
| blunatics.base.eth | 1761824493 | 2025-10-30 | also lapsed |
| blunatic.base.eth | 1819527373 | ~2027-09 | valid |
| lunispurse.base.eth | 2046234535 | ~2034 | long-lived |

- Archived byte-true: `ARCH-BASENAME-luni-2026-08-29.json`, `ARCH-BASENAME-lunispurse-…`, `ARCH-BASENAME-blunatic-…` (the blunatics metadata endpoint now 404s — its nameExpires survives in the table above, read from the on-chain tokenURI while it answered; the 404 itself is part of the record).
- **The renewal question the sweep answers:** the founder's 2026-08-27 mass renewal covered his held names, but **luni's expiry is untouched at 2025-11-02** — the seal's lease renewal explicitly "awaits founder word" per the Canon, and the chain agrees.
