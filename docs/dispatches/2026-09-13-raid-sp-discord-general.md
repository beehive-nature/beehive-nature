# RAiD — Silent Payments Discord #general, six posts verified at source · 2026-09-13

**For:** codex, to fold into this sprint's SP picture. **Seat:** z2.profile (SP research lineage: blueprint dispatch 2026-09-12, vending map 2026-09-13). **Method:** every Discord claim re-verified at its primary source this session; nothing below rides on the Discord text alone. All six posts check out; two carry corrections the sprint should bank.

---

## post 1 · macgyver 7/28 — "Frigate for StartOS" → VERIFIED, with a name-trap

[remcoros/frigate-startos](https://github.com/remcoros/frigate-startos) (Apache-2.0, 45 commits, 7★) packages **Frigate — Sparrow Wallet's experimental Electrum server that scans the chain for Silent Payments (BIP-352)**, not the camera NVR of the same name ("It is not the Frigate NVR project" — their README's own words). Keeps the tweak index in DuckDB, can offload scanning to GPU (CUDA/ROCm variants; AMD untested by the packager). Requires an archival `bitcoind` (txindex + ZMQ, pruning off), serves the Electrum protocol on :50001, initial indexing "hours to days", index excluded from backups (rebuildable).
**Estate read:** this is the index-server spec's **"My Scanner" self-hosted tier productized** — full privacy, your own box, GPU-accelerated. Box-candidate someday (founder call, nothing staged). **LAW for every future receipt: in a Silent Payments context, "Frigate" means the Sparrow Electrum server, never the NVR.**

## post 2 · theStack 8/3 — libsecp256k1 v0.8.0 → VERIFIED, ecosystem picture updated

[Release v0.8.0](https://github.com/bitcoin-core/secp256k1/releases/tag/v0.8.0), published **2026-08-03**: "Addition of a new Silent Payments (BIP-352) module with support for sending and scanning on full nodes." Also: SHA256-compression override (HW SHA), ~11% ECDSA/Schnorr speedups, deprecated symbol removals. Build-flag vs default not stated on the release page.
**Estate read:** the hub dashboard we cited in the blueprint listed the SP module as an in-progress PR (#1765) — **that row is stale; it shipped**. Bitcoin Core's wallet path (#28386) and every binding (rust-secp256k1 → BDK's `bitcoin-silentpayments` consumption) now have a version to pin. **No change to the z2.profile SP card** — display-only law untouched; the "unsupported wallet" failure copy stays honest (most wallets still cannot pay SP today).

## post 3 · macgyver 8/24 + 9/1 — August meetup + draft notes → VERIFIED via the gist

[Meeting notes gist](https://gist.github.com/macgyver13/01b12f80687dccc03c07cf674a9c2754), meeting held 2026-08-27, next **2026-09-24 14:00 UTC**. Load-bearing updates: libsecp light-client API (PR #1912 — prevouts_summary encodings + k=0 output-pubkey APIs) and a **~25% scanning speedup** (PR #1914); DLEQ proofs PR #1802 continue; "Single Sender" API shape issue #1925; **BDK will consume the `bitcoin-silentpayments` crate**; blindbit-oracle #56 drops reused outputs from server logic; wallet fronts moving: Jade (libwally), embit #145 (full impl), SeedSigner #949 (draft), Caravan #496, kernel-node, Shroud; friglet personal scanner released; BitcoinFuzz merged a cross-implementation `silentpayments_create_outputs` target (bdk-sp, BlueWallet, spdk). Spec text unchanged — design moved into libsecp API issues.

## post 4 · nymius 8/31 — payment-name-startos → VERIFIED, answers a blueprint open question

[bitsagarob/payment-name-startos](https://github.com/bitsagarob/payment-name-startos) (MIT, 12 commits, early): publishes a **BIP-353 record for your silent payment address and tells you if anyone repoints it** — exactly the repointing monitor our blueprint's open question #1 wanted. Three modes: off / **own** (emits the TXT record for YOUR DNS provider) / **hosted** (claims the name on silentpayments.net with an irreplaceable key). "Holds no keys, moves no money, needs no Bitcoin node." Engineering receipts worth stealing: queries go over **DoH (cloudflare-dns.com, dns.google) because the StartOS resolver forwards answers without RRSIG/AD** — signed vs unsigned indistinguishable on port 53; verdicts cached 5 min; health flags unsigned records; the wallet-side DNSSEC validation stays where the spec puts it.
**Estate read:** if the founder ever rules ₿name@skaists.dev into existence, this is the reference pattern (DNSSEC-signed zone + TXT publisher + repoint monitor). No build now.

## post 5 · macgyver 9/4 — silentpayments.net + the MuSig2 first → VERIFIED, two receipts

**[silentpayments.net](https://silentpayments.net/) — Bitsaga's hosted BIP-353 name service** ("Run by Bitsaga, a bitcoin self custody practice in Turnhout, Belgium"). Free, no account; claims by recovery-secret (hash stored, never the secret) **or NIP-98 nostr events (kind 27235)** — a nostr-shaped convergence worth noting for the buzz lanes. Zone DNSSEC-signed by Cloudflare ("a key it does not keep to us"), with unusually honest caveats on-chain of trust: the delegation signer key tag collides with competitor twelve.cash, and "Cloudflare, our registrar, the .net registry and ICANN each sit above us in that chain… BIP 353 narrows who can lie to you. It does not get the number to zero." Append-only hash-chained public change log, fingerprints to third-party nostr relays every 6 h. Receiving works today in **Sparrow, Cake, Dana**; BitBox02, Wasabi, Nunchuk, BlueWallet are send-only; no exchange. **CITATION LAW: silentpayments.NET (Bitsaga's name service) ≠ silentpayments.XYZ (the dev hub our earlier research could not reach) — never blend the two in a receipt.**
**[MuSig2 × Silent Payments](https://bitsaga.be/insights/musig2-silent-payment)** (Rob Segers, 2026-09-04): claimed world-first **mainnet MuSig2 2-of-3 key-path spend to a silent payment address** (block 965485, tx `e809314c…`, 111 vB, one 64-byte signature) plus on-device BIP-353/DNSSEC verification (RFC 9102 proofs, 2580 B). The core finding: **script-based multisigs cannot pay SP at all — MuSig2 key path is the only multisig that can** — via per-signer ECDH shares (`d_i · B_scan`) carrying BIP-374 proofs ("a share nobody can check lets one co-signer send the money to an output the recipient will never find"). Rides **PSBT fields `0x21` (share) and `0x22` (proof) from macgyver13's July 2026 proposal — an extension beyond BIP-375's single-sender fields** (our blueprint's 375 documentation stays correct; note the extension exists). Caveats kept honest by the authors themselves: signers were SeedSigner firmware in a browser, not hardware; collaborative SP has no formal security proof; per-input BIP-375 fields unfilled (per-signer proofs substitute); stock Core v31.1.0 aggregated and relayed with no SP code.

## post 6 · w3irdrobot 9/8 — SP miner payouts → VERIFIED, pre-spec watch item

[Optech #421](https://bitcoinops.org/en/newsletters/2026/09/04/): average_gary's Delving Bitcoin proposal (topic 2833) for **pools paying miners via silent payments inside the coinbase transaction** — the miner hands the pool one static SP address over Stratum v2's encrypted channel (instead of an xpub that leaks if the pool's database does); the pool mints an ephemeral `A_send`, hashed with **block height** as the anti-grinding substitute for outpoint uniqueness (coinbase has no inputs to derive from); the 34-byte `A_send` rides the coinbase scriptSig where the pool tag sits today. Pre-spec, author explicitly seeking critique. **Estate read:** no lane impact; jargon-deck material and a clean demonstration that SP's design space extends past wallets.

---

## what this changes for the sprint (ranked, for codex)

1. **Stale-row fix:** any sprint doc still calling the libsecp256k1 SP module "in progress" should now read **shipped in v0.8.0 (2026-08-03)**; receive-side wallets = Sparrow, Cake, Dana; send-only = BitBox02, Wasabi, Nunchuk, BlueWallet (source: silentpayments.net scope note, read this session).
2. **z2.profile SP card: no change.** Display-only law, never-claims tests, and the unsupported-wallet failure copy all remain honest — the ecosystem is broadening, the page claims nothing.
3. **BIP-353 open question now has a reference implementation** (payment-name-startos "own" mode + silentpayments.net hosted) with the repoint monitor included — parked until a founder rules estate-domain names into existence.
4. **Two citation laws banked:** Frigate-in-SP-context = Sparrow's Electrum server; silentpayments.net ≠ silentpayments.xyz.
5. **PSBT watch:** macgyver13's `0x21`/`0x22` share/proof fields (MuSig2 senders) extend BIP-375 — flag in any future SP PSBT documentation.
6. **No build orders in this RAiD** — research only; nothing merged, nothing deployed, no wallets touched.
