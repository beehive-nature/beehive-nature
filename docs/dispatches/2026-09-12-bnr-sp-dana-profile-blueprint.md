# BNR PROFILE BLUEPRINT — silent payments + the dana handoff · 2026-09-12

**Lane:** BNR research, read-only. **Seat:** zCode. **Effort:** medium, fresh session.
**Rules honored:** no code, no wallet interaction, no deployment, no production probes. Sources read at origin this session; every load-bearing claim below carries its link, and everything else is marked PROPOSAL or UNVERIFIED. Language capped at "sound by construction" per the standing crypto-language law.

**Local read:** `AGENTS.md` — NOT FOUND in the tree (agent law lives in seat memory + `docs/agents/`); `surfaces/blight/profile.html` (the holder profile — the file this blueprint targets); `surfaces/profile.html` (the dynasty profile); `docs/RAVER-REGISTER-LAW.md` (registers). Sibling lane noted in flight: `wt-astra-house-profile` (house-profile-blueprint, 2026-09-12) — reconciliation question raised below, no coordination claimed.

---

## 0. the recommendation, first

BNR's profile may grow **one new card: "private bitcoin support"** — and in this session it ships **unconfigured**: a quiet capability line reading **"Private Bitcoin support — coming soon."** The card goes live per-artist only when that artist pastes a silent-payment address they generated in their own wallet. BNR's whole job is to **display** that address (copy + QR). BNR must not invent an address, handle keys, sign transactions, scan for funds, or claim payment receipt — each of those belongs to a wallet (Dana among the receive-side options), never to a page. And this card is a **separate rail** from the ERC20i family (FUNGI · $FROGGI · PEPI · JELLI · JEDI · MiDi · TRUFFI) and from bnr:// — no shared chips, no shared words, no cross-claims.

---

## 1. what an artist can safely publish — verified, per rail

**Silent Payment address (BIP-352) — SAFE BY DESIGN, verified at source.**
The address is bech32m, HRP `sp` mainnet / `tsp` testnet, data part = version char + the 66-byte concatenation of the receiver's two PUBLIC keys (B_scan ‖ B_spend); mainnet v0 begins `sp1q` and "a silent payment address requires at least 116 characters". Outputs are always BIP-341 taproot. The spec's goals are exactly the publish-staticly-and-stay-private shape a profile wants: "Transactions can't be linked to a silent payment address by an outside observer", "No linking of multiple payments to the same sender", "Each silent payment goes to a unique address, avoiding accidental address reuse."
Source: [BIP-352](https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki).
**One caveat, verified:** labeled addresses are publicly linkable — "an outside observer can easily deduce that each published (B_scan, B_m) pair is owned by the same entity" — so labels are "not meant as a way for Bob to manage separate identities". A profile publishes the plain address, nothing label-derived.

**Dana handoff — the receive side can live in Dana; BNR only points at it.**
Verified this session: [cygnet3/dana](https://github.com/cygnet3/dana) is "a flutter app used for accepting bitcoin donations" (README's own words), "currently still considered 'experimental'" with an explicit don't-lose-funds-you-care-about warning, Android-first (F-Droid / Zap Store / GitHub releases), Flutter+Dart over a Rust core, MIT, maintained by cygnet3 (61★, 13 forks, 928 commits, default branch `dev`, read 2026-09-12). It receives via "silent payments, a new static payments protocol". Dana's own donation identity is a BIP-353-style name: `donate@danawallet.app`.
**"Dana address" = BIP-353, verified:** "Dana addresses have the form of username@danawallet.app… Dana addresses are BIP353 addresses, also called 'Human-readable addresses'" and "the Silent Payment address is actually fairly hidden" ([wiki: What are Dana addresses](https://github.com/cygnet3/dana/wiki/What-are-Dana-addresses)). For contacts, "the app will store both the Dana address as well as the underlying silent payment address"; on every send the name is re-resolved and a mismatch **blocks the send**.
[BIP-353 "DNS Payment Instructions"](https://github.com/bitcoin/bips/blob/master/bip-0353.mediawiki) — status **Complete** — carries a BIP-21 URI in DNS TXT records at `user.user._bitcoin-payment.domain`, displayed ₿`user`@`domain`, with hard teeth: wallets "MUST fully validate DNSSEC signatures leading to the DNS root" and "MUST NOT prefer to use DNS-based resolving when methods with explicit public keys or addresses are available." An `lno=` parameter can carry a BOLT-12 offer.
**So the publishable artist identity is:** the raw `sp1…` address (primary, self-authenticating) and optionally a BIP-353 name on a domain the artist controls. The "handoff" (PROPOSAL, our word) = the profile shows the address/QR; receiving and scanning happen inside the artist's own Dana (or other wallet). BNR never resolves BIP-353 itself unless a founder rules the DNSSEC path built — today it would be display-only text.

**Lightning / BOLT-12 — publishable offer, verified at source.**
[BOLT-12 offers](https://github.com/lightning/bolts/blob/master/12-offer-encoding.md) are static, reusable payment requests: "A merchant publishes an *offer*, such as on a web page or a QR code", every payer fetches a unique invoice over the network, and the offer itself leaks no secret and needs no recipient web server. Receiver privacy rides blinded paths ("nodes connected only by private channels MUST include `offer_paths`…"), payer privacy a throwaway key ("MUST set `invreq_payer_id` to a transient public key"). Offers may set `offer_absolute_expiry`; without it they stay valid. An offer string is therefore safe to publish on a profile, with one honest line: **expiry is the artist's responsibility to keep current** (BIP-353 makes the DNS TTL follow instruction expiry for exactly this reason).
Estate context (memory-derived, verify before build): Alby Hub is live from the lightning raid lane and BOLT-12 was parked there — an offer published on the profile needs a node behind it that stays up.

**ERC20i and BNR token rails — already live, already separate.**
Verified in `surfaces/blight/profile.html` (scope note, ~line 205): "the on-chain half here is the ERC20i family on Base: FUNGI · $FROGGI · PEPI v1/v2 · JELLI · JEDI · MiDi · TRUFFI, read as balances + holder-seeded + enumerated inscriptions", behind keyless public RPC reads. The JEDI LAW stands: "the profile reads; the market sells; never the twain." bnr:// tier-1 address scheme is live off the hub footer with its resolver (ledger @06459b8, memory-derived). These rails publish themselves — an artist's holdings are read from chain, not asserted.

---

## 2. scan key vs spend key · local vs delegated scanning · what never touches a page

**The split, verified in BIP-352:** the scan keypair detects payments (sender computes `input_hash·a·B_scan`; receiver computes `input_hash·b_scan·A` and derives candidate taproot outputs), the spend keypair controls funds (`P_k = B_spend + t_k·G`, spent with `d = (b_spend + t_k + label tweak) mod n`). The overview's stated purpose: "Separate scanning and spending responsibilities" — "This allows Bob to keep b_spend in offline cold storage" while scanning with `b_scan` online. Derivation paths are hardened (`m/352'/coin'/account'/0'/0` spend, `…/1'/0` scan), and with those paths "it is safe to export the scan private key without exposing the master key or spend private key."

**Local scanning** = the wallet itself walks every candidate transaction (≥1 taproot output, eligible input types, no SegWit-v>1 inputs) with `b_scan`. Sound by construction, heavy by nature — the full walk is why indexers exist.

**Delegated scanning**, per the [BIP0352 index-server specification](https://github.com/silent-payments/BIP0352-index-server-specification) — **marked WIP**, read that way — offers three trust stacks, and the privacy line is explicit:
- **Remote Scanner (hosted):** the server is trusted; the wallet hands over **scan private key + spend public key** for a session. Spec's own words: "Privacy from all but Indexer Service", and users should rotate wallets on leaving "To preserve forward privacy".
- **Tweak Server (anonymous):** the server sees only block-range requests, never which outputs match; "Service cannot be fully trusted" — clients verify against full-node data. Public endpoints need no auth, rate-limited ~10 blocks/minute. (BlindBit is this shape; spdk ships `backend-blindbit-v1` as its BIP-352 light-client backend — [cygnet3/spdk](https://github.com/cygnet3/spdk).)
- **My Scanner (self-hosted):** full privacy, your own box.
Endpoints verified in the spec: `/getinfo`, `/tweaks/:blockheight` (+`filterSpent`, `dustLimit`), optional `/compute-index/:blockheight`, `/utxos/:blockheight`, gRPC streams, and Electrum-style `blockchain.silentpayments.subscribe`. Hosted scanning is described as "equivalent privacy to current Electrum protocol servers" — the same trust an Electrum user already accepts, no stronger.

**What must NEVER enter BNR browser storage, URLs, or logs (the card's law):**
- `b_scan` (scan private key) — it is the linkage key: whoever holds it plus chain data sees every payment to the address; label tweaks are hashes of it, so **labels leak with it** (both facts verified in BIP-352's security section).
- `b_spend`, any private key, any seed/xprv, wallet files, BIP-39/32 material of any kind.
- PSBT material — BIP-375 ([PSBT extensions, **Draft**](https://github.com/bitcoin/bips/blob/master/bip-0375.mediawiki): `PSBT_GLOBAL_SP_ECDH_SHARE = 0x07`, `PSBT_GLOBAL_SP_DLEQ = 0x08`, per-input `0x1d`/`0x1e`, per-output `PSBT_OUT_SP_V0_INFO = 0x09` carrying exactly the two PUBLIC keys from the address, and `PSBT_OUT_SP_V0_LABEL = 0x0a`) and BIP-376 ([spending side, **Draft**](https://github.com/bitcoin/bips/blob/master/bip-0376.mediawiki): per-input `PSBT_IN_SP_SPEND_BIP32_DERIVATION = 0x1f` and `PSBT_IN_SP_TWEAK = 0x20`, signer computes `d = (b_spend + tweak) mod n` and MUST fail if the key doesn't match the output) — these are wallet-to-wallet objects. BNR never constructs, signs, or displays them.
- The scan HISTORY and any indexer conversation. BNR talks to no indexer at all, ever, for any reason.
**What is public and safe:** the `sp1…` address itself (two public keys), the QR of it, and — if an artist publishes one — a BIP-353 name or BOLT-12 offer string. The existing profile surface already keeps this shape by law: "no wallet connect, no signing, no keys" and "this book lives on this device only" (`surfaces/blight/profile.html`, read this session).

---

## 3. dana's role — an external mobile wallet, and nothing more

**Verified:** Dana exists, is experimental, Android-first, MIT, by cygnet3; it receives silent payments and speaks BIP-353 names; its Rust engine is spdk, whose own README warns "SPDK currently relies on cryptography that is not professionally reviewed" — both wallets carry real experimental risk and say so themselves.
**Not found anywhere this session:** any Dana↔BNR relationship, API, SDK integration, listing, or partnership; any Dana support for ERC20i, Base, Vaulta, or bnr:// (Dana is a Bitcoin wallet; those are other chains/rails). **Therefore the blueprint asserts none.** Dana appears in BNR's future card only as one named wallet option with its repo/F-Droid link and its own "experimental" word attached — the same way the hub names tools. Any stronger wording ("BNR × Dana", "powered by Dana", "integrated with") would be an invented claim and is banned from this card. If the founder ever wants real integration, that starts with a verification lane of its own (send-side walkthrough against a testnet/signet Dana build — the Dana wiki maintains a "Test Dana on Signet" page — and only then wording changes).

---

## 4. one capability, three registers (🐝 new bee · 🎛 raver · ⚗ cypherpunk)

Registers restyle prose and density, **never numbers** (`docs/RAVER-REGISTER-LAW.md`). The unconfigured state, drafted:

- **🐝 new bee** — "this artist can also receive bitcoin privately. that support isn't set up here yet — when it is, you'll get an address to copy into your own wallet. nothing else changes on this page."
- **🎛 raver** — "private bitcoin support, coming soon. the door price is zero, the address will be yours to take to whatever wallet you already love, and nobody watching the chain can tell who tipped the artist. PLUR all the way down." (Voluntarist clause: nothing is done *to* the reader; copying is the whole gesture.)
- **⚗ cypherpunk** — "BIP-352 silent payments: not enabled for this profile. when enabled, this card displays a static sp1q bech32m address (B_scan ‖ B_spend, both public keys) and nothing else — no key material, no scanning, no indexer traffic, no receipt claims. display-only by construction."

Configured state, same registers, same law: the address, a copy button, a QR, the wallet-option line naming Dana as "experimental, Android", and the honest failure lines below. The bee register keeps zero jargon; the cypherpunk register keeps mechanism words; the raver register keeps the door open and the warmth in.

---

## 5. failure states — named, honest, non-fatal

1. **Unsupported wallet.** The payer's wallet can't send to silent payments. Ecosystem reality, verified via the [silent-payments-hub](https://github.com/macgyver13/silent-payments-hub) dashboard: Bitcoin Core wallet support is in progress (issue #28536), the libsecp256k1 SP module is an open PR (#1765), BDK support rides bdk-sp (in progress); BIP-375/376/392 are listed complete. Send-side paths documented against Dana specifically: Sparrow and BlueWallet ([Dana wiki TOC](https://github.com/cygnet3/dana/wiki)). **Card behavior:** the capability line names no wallet as "the" way; the copy action always works; a payer stuck on an unsupported wallet is told plainly to copy the address into a wallet that supports silent payments — with no preference implied.
2. **Unavailable indexer.** The ARTIST's wallet can't reach its scanning server, so detection stalls. **Funds are not lost** — the UTXOs exist on-chain and any later rescan (or a full-node wallet, or a different indexer) finds them; this is a detection delay, not a payment failure. BNR's card is unaffected by construction (it never talks to indexers) and must not display any "checking for payment" state that implies it could know.
3. **Malformed address.** Under 116 characters, wrong HRP (`sp` vs `tsp`), bad bech32m checksum, or wrong data length → the address must be REJECTED at entry, never autocorrected or guessed. (BIP-352's format rules, cited above.) BIP-353 side, verified in Dana: a name that stops pointing at the same underlying address **blocks the send** — BNR's display-only copy inherits the same discipline: show what was given, or show nothing.
4. **Abandoned handoff.** The payer copies the address, leaves, never pays; or the artist configures the card and stops running the receiving wallet. **The profile must not imply receipt or readiness**: no "waiting for payment", no spinner, no balance, no confirmation. The address stays a published fact, exactly like a BOLT-12 offer pinned on a page — valid whenever the payer's wallet and the artist's wallet say it is.
5. **Payment not confirmed.** A payment was sent but not yet confirmed / not yet scanned. Confirmation is knowable only by the two wallets (payer's mempool/confirmations; receiver's scan). BNR **never claims payment receipt** — no checkmark, no "received" state, ever. The honest maximum is the static caption: payments to this address are visible only to the address's owner.

---

## 6. acceptance contract — the future profile UI card

A build is accepted when ALL of the following hold, and not before:

1. **Unconfigured default.** With no artist address configured, the card renders exactly one capability line — "Private Bitcoin support — coming soon" — static, non-interactive, in all three registers, at 390px and desktop. No fake address, no placeholder `sp1…` string that looks real, no QR.
2. **Configured display, display-only.** The card shows the artist-supplied address verbatim, one copy button, one QR (generated first-party, no CDN), and a wallet-options line naming Dana with the word "experimental" and a link to its repo. No send button, no amount field, no invoice construction, no BIP-21 URI minting (displaying an artist-supplied URI is allowed verbatim).
3. **Validation gate.** Entry accepts only: `sp1q…` bech32m mainnet (≥116 chars, valid checksum, 66-byte data part) — testnet `tsp` rejected on the prod card with a visible reason; BIP-353 names only as display text marked "resolve in your wallet"; BOLT-12 offers only as `lno1…` display text with the expiry-honesty line. Rejection never rewrites input.
4. **Key-and-traffic purity (testable).** Zero private-key-shaped strings anywhere in storage/URLs/logs; card adds no network origin beyond the page's existing ledger (first-party-only law); localStorage gains nothing new beyond the address-book entry the artist typed; `tsp`/`sp1` values never appear in query strings. CI-side grep + e2e assertion.
5. **Rail separation.** The card is visually and semantically separate from ERC20i holdings chips and bnr:// rows: no combined "pay" surface, no mixed wording, no FUNGi/$FROGGI/PEPI/ERC20i token appearing inside the bitcoin card or vice versa. Verified by a DOM-level e2e check.
6. **No receipt claims.** No balance, confirmation, or "received" state exists in the card's state machine — asserted by test (the state enum has no such state).
7. **Estate form.** Estate tokens only, register toggle works on every string, `prefers-reduced-motion` honored, 390px screenshots clean, zero console errors, tour-bar rider law respected as on the current profile.
8. **Receipt discipline.** Any "verified with wallet X" wording in future copy requires a fresh verification lane receipt first; until then Dana is named with its own experimental label only.

---

## open questions (for the founder / next lanes)

1. **BIP-353 on estate domains?** Should artists (or the estate) publish ₿name@skaists.dev-style payment names? That requires DNSSEC-signed zones and a decision about who controls the record; BIP-353's own rule already forbids wallets preferring it over explicit addresses, so it would be sugar, never the rail.
2. **Reconciliation with the house-profile blueprint** in flight on `wt-astra-house-profile` (2026-09-12) — do the two blueprints share one card grammar or stay separate surfaces?
3. **BOLT-12:** does the estate want offers on profiles at all while the lightning lane has BOLT-12 parked (memory-derived — re-verify Alby Hub offer support before any build)? Offers need a live node behind them.
4. **Wallet naming policy:** name send-side wallets (Sparrow, BlueWallet — both documented against Dana) in the UI, or keep the card wallet-agnostic and let the hub/ecosystem pages carry that list?
5. **Index-server spec is WIP** — if the estate ever builds artist tooling beyond display (NOT proposed today), which stack (tweak-server vs self-hosted) matches the privacy bar? No indexer conversation is planned for BNR itself.
6. silentpayments.xyz was unreachable from this seat this session (two ECONNRESETs); its wallet-support tables were not re-verified — hub + Dana wiki carried the weight instead.

---

## source ledger (all read 2026-09-12, this session)

- BIP-352 Silent Payments — https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki
- BIP-353 DNS Payment Instructions (Complete) — https://github.com/bitcoin/bips/blob/master/bip-0353.mediawiki
- BIP-375 Sending Silent Payments with PSBTs (Draft v0.1.1) — https://github.com/bitcoin/bips/blob/master/bip-0375.mediawiki
- BIP-376 Spending Silent Payment outputs with PSBTs (Draft) — https://github.com/bitcoin/bips/blob/master/bip-0376.mediawiki
- BOLT-12 offer encoding — https://github.com/lightning/bolts/blob/master/12-offer-encoding.md
- BIP0352 index-server specification (WIP) — https://github.com/silent-payments/BIP0352-index-server-specification
- cygnet3/dana + wiki — https://github.com/cygnet3/dana · https://github.com/cygnet3/dana/wiki/What-are-Dana-addresses
- cygnet3/spdk — https://github.com/cygnet3/spdk
- macgyver13/silent-payments-hub — https://github.com/macgyver13/silent-payments-hub
- repo: `surfaces/blight/profile.html` · `surfaces/profile.html` · `docs/RAVER-REGISTER-LAW.md`

**No keys, wallets, transactions, indexers, or production systems were touched. Research only.**
