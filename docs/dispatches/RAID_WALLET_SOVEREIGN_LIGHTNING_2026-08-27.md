# RAID — WALLET × LIGHTNING × THE SECRET ADDRESS (zA, acting captain)
**Source:** live sites + `gh api` license/README pulls + Base RPC on-chain reads (2026-08-27)
**Doctrine:** L-VERIFY at source, four axes (code/community/compatibility/synergy), capture-pattern test, TAKE / PATTERN / LEAVE. Pirate rule per founder order: *take visions/knowledge/code where sustainable synergy exists; central failable servers get torn out.*
**Scale target:** 10 billion users, 1,000 years (DESIGN-BRIEF-03 §8.8 — unchanged, now extended to the BTC/LN axis).
**Companions:** DESIGN-BRIEF-03-wallet-operations-mvp.md · RULING_KISS_BDID_PASSKEY_WALLET · SPEC_SOVEREIGN_WALLET_FUNDING · RAID_WALLET_PAYMENT_PIPELINE (2026-08-09, the Arweave-axis raid — same laws, new territory)

---

## Executive Summary (≤ 5 lines)
Twenty-six sources assessed across seven families. The haul: **four ADOPT standards** (BIP-353 DNS payment instructions — the PR the founder linked is BIP 353, merged 2024-06-10; BOLT12 offers; BIP-352 silent payments — "the secret address"; BIP-321 URIs as the one envelope), **four TAKE-eligible codebases** (Cashu `cdk` dual MIT/Apache Rust; LDK dual MIT/Apache Rust; `boltz-core` MIT swap library; `lightning-detective` MIT Rust), **two ADOPT specs** (Avathor deterministic node avatars; Cashu NUTs), and PATTERNs everywhere else — because the BTC wallet world is AGPL/GPL-heavy (Zeus, Boltz backend, Plasma) and unlicensed at the edges (payto, ElTor daemon, covenant-zapper). The single most important design finding: **the founder's "secret address" already exists as BIP-352 silent payments, and the three standards compose** — one static `sp1q…` + one `lno1…` offer ride a single BIP-321 URI resolved from a name, giving static-address UX with zero on-chain linkage; the missing piece (phone scanning cost, "an open research problem" per silentpayments.net) is exactly what our operator network can sell as a 24/7 service. The central-failable-server tear-out: `.b` names on our registry replace twelve.cash/silentpayments.net's hosted DNS naming; our operators run the mints/scanners/swappers the custodial world runs for itself.

---

## 1. STANDARDS FAMILY — ADOPT (these are the spine)

### 1.1 BIP 353 — DNS Payment Instructions *(the PR the founder linked: bitcoin/bips#1551, merged 2024-06-10)*
- **What:** `₿user@domain` → DNSSEC-signed TXT at `user._bitcoin-payment.domain` carrying a BIP-21/321 URI (BOLT12 offer, silent-payments address, on-chain address — any combination). Author lineage: Matt Corallo; approvals incl. murchandamus, t-bast.
- **Key properties (quoted from PR/site):** "providing for the ability to query such resolutions privately"; DNSSEC gives "compact and simple to verify proofs of mappings" — hardware-wallet-verifiable offline proofs, which "TLS cannot offer"; resolver can censor or log "but never give you the wrong address" (validation is client-side).
- **Verdict: ADOPT, with the .b registry as our zone.** Our kingbeelovis registry (13 names held, suffixless `.b`) becomes the payment-name zone: a `.b` record carries the BIP-321 URI directly (on-chain proof, no DNS needed) **and** we publish DNSSEC TXT for any `.b` owner who also holds DNS — interop with every BIP-353 wallet (satsto-style resolvers, payto-class payers) without running a twelve.cash.
- **Receipt:** PR read live (title/author/merge date/mechanism quoted above). Interop path verified via satsto.me's resolver description and twelvecash's "API for creating BIP-353 usernames" repo description.
- **UNVERIFIED:** BLIP-32 onion-message resolution path not read at spec level (named in PR discussion only).

### 1.2 BOLT 12 — offers *(bolt12.org, LN-Zap/bolt12-playground MIT, strike blog)*
- **What:** reusable payment requests replacing per-payment BOLT11 invoices; route blinding + onion messaging = receiver privacy ("my IP address remains hidden").
- **Verdict: ADOPT.** The `lno1…` offer is the Lightning half of every `.b` payment record; offers are static like silent payments, so name→URI is fully static. bolt12.org's UX storytelling (tip-jar user stories) is the pattern for how we *explain* it — the site is a masterclass of one-idea-per-persona education.
- **PATTERN:** LN-Zap/bolt12-playground (MIT, Shell) — regtest playground shape for our own onboarding demos.

### 1.3 BIP 352 — silent payments, **the secret address** *(silentpayments.xyz education; silentpayments.net live naming service)*
- **What:** one static `sp1q…` address; each payer ECDH-derives a unique output address; "only the sender and receiver can connect it with on-chain activity"; "No server required"; infinite derived addresses, ends the "send me a new address!" cycle.
- **The cost, honestly stated by the ecosystem:** scanning is "an open research problem on a phone" (silentpayments.net). Send-only support is broad (BitBox02, Wasabi, Nunchuk, BlueWallet); full receive support is Sparrow (desktop), Cake/Dana (mobile); Bitcoin Core: "Nothing shipped to users yet."
- **Verdict: ADOPT AS THE DEFAULT RECEIVE POSTURE.** This is the founder's "secret address" — it exists, it's standard, and its one weakness (scan cost) is our operator opportunity (§Rulings R3). Design note: the two silent-payment naming platforms the founder flagged (silentpayments.net / .xyz) are **btc-only by construction** — extending the *pattern* to `.b` (where a name can also carry EVM/Autonomi records) is greenfield and ours.
- **PATTERN (honesty engineering, silentpayments.net):** append-only hash-chained public change log, fingerprints checkpointed to third-party **nostr relays every six hours**, StartOS self-host package, "Do not trust us. Run it yourself," live counters you're told to verify with `curl`/`delv`. This is the estate's own receipt-culture, already proven in the wild — steal the whole posture for the `.b` registry's change log (ours checkpoints to **buzz** relays).

### 1.4 BIP 321 — the envelope
One URI carrying `sp` + `lno` (+ on-chain params) — "Both ride in one BIP 321 URI as sp and lno… The sender's wallet chooses Lightning or on-chain" (silentpayments.net). **ADOPT** as the canonical `.b` payment-record format.

---

## 2. E-CASH FAMILY — community custody without a company

### 2.1 Cashu *(cashu.space · cashubtc org)*
- **What:** Chaumian e-cash over Lightning. "Mints issue bearer tokens against Lightning, wallets hold them"; "blind signatures keep a mint from tying the withdrawal to the spend that follows it"; tokens carry DLEQ proofs; v4 CBOR token format; NUTs are the version-controlled spec; "no company, no token, no treasury."
- **Custody truth (their own words, twice):** "Ecash is a claim on its mint, not a deposit."
- **License (verified how):** `gh api repos/cashubtc/cdk` → `license: NOASSERTION`, root listing shows **LICENSE-MIT + LICENSE-APACHE + LICENSE.md** = dual MIT/Apache-2.0 (GitHub can't classify dual-file). Rust, pushed 2026-08-27 (today), 226★.
- **Verdict: TAKE `cdk`.** The Chaumian kernel for wallet-relay's value-transfer lane: bearer tokens "small enough to fit anywhere text goes" — which for us means *buzz messages, midi.blue pages, QR plates*. Nutshell (Python) = reference reading only.
- **BNR action:** vendor `cdk` primitives into the wallet-relay crate lane; our mints are BNR operators (§R4); token format stays NUT-compatible so the outside Cashu world interops.

### 2.2 Fedimint *(fedimint.org · fedimint/fedimint)*
- **What:** "Open-source federated e-cash for Bitcoin" — "Community Custody, Private by Design"; guardians "set up and operate a Fedimint federation on your own hardware"; deposits via Lightning or on-chain; Fedi (the company) appears only in a supporters list.
- **License (verified how):** `gh api repos/fedimint/fedimint` → **MIT**, Rust, pushed 2026-08-27 (today), 695★.
- **Verdict: TAKE-eligible + PATTERN.** The federation consensus layer when single-mint trust is not enough: a `.b`-community (or the DAO) runs guardians on their own boxes. LEAVE every Fedi-company product surface.
- **Synergy:** Fedimint federation-of-guardians is the *funded, sovereign* version of what Lexe does with attested hosted nodes (§3.4) — same UX promise ("always online"), different trust root (our boxes vs their company).

---

## 3. NODE / WALLET / CUSTODY FAMILY

### 3.1 LDK — lightningdevkit/rust-lightning
- **License (verified how):** root listing shows **LICENSE-APACHE + LICENSE-MIT + LICENSE.md** = dual MIT/Apache-2.0. Active 2026-08-27. (Mirror note: "Active development happens on git.rust-bitcoin.org.")
- **Verdict: TAKE.** The Lightning core we build the BNR node on — Rust, library-first, same one-codebase-one-audit law as DESIGN-BRIEF-03. boltz-client (MIT) and lampo (BSD-3) both sit on it — proof it composes.

### 3.2 lampo.rs *(vincenzopalazzo, BSD-3-Clause, 66★, "experimental… tiny lightning node", LDK-powered)*
- **Verdict: WATCH / PATTERN the shape** (LDK core + thin daemon + SDK), not a dependency — experimental, spare-time project ("Built with love & free time"). Our node = LDK directly, lampo as reading material.

### 3.3 Zeus *(ZeusLN/zeus)*
- **License (verified how):** LICENSE file read via API — **GNU AGPL-3.0** ("Copyright (C) 2019, Evan Kaloudis… GNU Affero General Public License"). GitHub classifies NOASSERTION; the text is unambiguous. TypeScript/React Native, 1400★, pushed today.
- **Verdict: PATTERN ONLY (copyleft).** The self-custody wallet that *connects to your own node* — the UX law for our Tier-3 operators. No code enters our tree (AGPL contaminates).
- **PATTERN:** node-connection UX (LND/CLN/core-LN), embedded Tor, account-like LNURL handling — all mapped onto wallet.html + the ops panel.

### 3.4 Lexe *(lexe.app)*
- **What:** "Easy Lightning ⚡️ payments, 24/7" — hosted always-online Lightning nodes; keys "managed inside secure hardware that Lexe cannot access"; remotely attested; BOLT12 tip boxes; "Infinite inbound liquidity" with interest-only-on-use; **0.5% fee per payment**; recovery independent of the company.
- **Verdict: PATTERN the economics + attestation story.** This is the closest commercial shape to our operator model — but Lexe is *their* company's nodes; ours are federation/estate boxes. The 0.5%-per-payment number is the market-rate anchor for BNR operator pricing (§R4).
- **UNVERIFIED:** repo/license not located this session (site claims "open-source, reproducible, remotely attested").

### 3.5 Phoenix / lightning-kmp *(ACINQ)*
- **License (verified how):** `gh api repos/ACINQ/phoenix` and `ACINQ/lightning-kmp` → both **Apache-2.0**, active (2026-07 / 2026-08). phoenix-kmm archived 2022 = old home, not dead project.
- **What (README, quoted):** "self-custodial… **you hold the keys**"; 12-word seed; lightning-kmp does "everything Lightning/Bitcoin"; three modules (shared Kotlin logic + per-platform UI).
- **Verdict: PATTERN.** The proof that a full self-custodial Lightning node hides inside a "simple and clean UX" wallet — splicing for channel management, swap-in on-chain addresses. Kotlin doesn't enter our Rust stack, but the *shape* (one shared core, thin per-platform UI) is exactly our wallet-relay law.
- **lightning-detective cross-link (§6.3):** Phoenix users are identifiable via LSP hints — privacy workarounds matter to this demographic (BOLT12 blinding is the fix).

### 3.6 Ride the Lightning *(RTL)*
- **License:** **MIT** (verified via gh api), TS, 798★, active 2026-08-21.
- **Verdict: PATTERN + reference.** The operator console (LND/CLN/Eclair) — the direct ancestor of our Tier-3 ops panel (DESIGN-BRIEF-03 §4 already speccs it: Autonomi/ar-io/buzz status). We build htmx, not Angular — pattern the panel taxonomy, don't port the app.

### 3.7 BitBanana *(michaelWuensch, MIT, Java/Android, active)* — Zeus-lineage node management, founder praised the UI. **PATTERN** the mobile ops UX. **Plasma** *(Fonta1n3, GPL-3.0, C, stale 2024-10, 14★)* — LEAVE the code (copyleft + dead); PATTERN the LNSocket direct-to-CLN connection (no intermediary server between wallet and node — that's the tear-out-the-server instinct in code).

---

## 4. SWAP / INSTANCY FAMILY

### 4.1 Boltz *(boltz.exchange · BoltzExchange)*
- **License (verified how):** org listing via gh api — **boltz-core MIT** ("Boltz Reference Library in TypeScript"), **boltz-client MIT** ("Boltz Client for CLN & LND", active 2026-08-24), **boltz-backend AGPL-3.0**, boltz-frontend AGPL-3.0.
- **What:** non-custodial submarine swaps (LN↔on-chain), the oldest live swap house.
- **Verdict: TAKE boltz-core, PATTERN the backend.** boltz-core is the MIT swap-math library; the AGPL backend never enters our tree — our operators run the swap service themselves (auto-rebalancing channels via submarine swaps is the RTL channel-bot's job, done properly).

### 4.2 Second / Ark / bark *(second.tech)*
- **What:** "The simple way to add bitcoin payments to your app" — **bark**, "an open-source Rust wallet" with "native bindings for React Native, Web (WASM), Swift, Kotlin, Flutter, Go, and Rust. One Rust core. Native bindings for every platform." Ark VTXOs: "share UTXOs and transact them off-chain, so payments are instant and cheap"; pay BOLT11 "from an Ark balance — no channels, liquidity, or LSPs required"; "Infinite inbound"; self-custodial with "cryptographic assurances that you can broadcast your transaction on-chain even if your Ark isn't available" (unilateral exit).
- **The failable server, in their own words:** "Instead of relying on a network of nodes, Ark users connect to an Ark server."
- **Verdict: WATCH + PATTERN, possible TAKE pending license.** "Made for us" is right at the *shape* level: Rust core → WASM → our htmx surfaces is literally our build law. Tear-out rule: the Ark server must be a **BNR-operator-runnable** artifact before Ark becomes a rail we advertise; until then it's a pattern (instant off-chain without channels = the 10B-user scaling story Lightning alone can't tell).
- **UNVERIFIED:** bark license (lives on GitLab, not fetched this session) — **license check is a gate before any vendor.**

### 4.3 bolt12-covenant-zapper *(gudnuf, NONE license, Python hackathon 2024)*
- **What (README, quoted):** forked nostrudel, "add a bolt12 offer to your Kind 0 metadata, and then zap users to their bolt12" — three zap methods, two via bitcoin-connect, one via **cashu**.
- **Verdict: PATTERN ONLY (unlicensed).** This is the buzz×wallet bridge proven in the wild: **nostr profile metadata carries the offer; zaps pay it; cashu is one of the transports.** Our version: bzDiD/kind-0 carries the `.b`-resolved offer; zap lane rides cdk tokens over buzz. Don't vendor the code.

---

## 5. NAMING / IDENTITY / MESH FAMILY

### 5.1 twelve.cash *(ATLBitLab/twelvecash)*
- **License:** **MIT** (verified via gh api) — "API for creating BIP-353 usernames." Landing page: single screen, one sentence, two buttons ("Make a Pay Code" / "Check a Pay Code") — the domain-UI simplicity the founder flagged.
- **ATLBitLab org (verified):** nostream (MIT nostr relay in TypeScript), create-ln-app (MIT), nostr-meetup + relay, ln-issuer (MIT, VC issuer w/ LN payments) — a nostr-native bitcoin shop.
- **Verdict: PATTERN the one-screen law; TAKE-eligible code if we want a bridge service.** Their product *is* a central failable server (they host the DNS); our `.b` registry is the sovereign replacement. The nostr integration the founder asked about = real but modest (their relays/meetups); the *valuable* nostr integration for us is §4.3's offer-in-metadata pattern + silentpayments.net's nostr-checkpointed transparency log.

### 5.2 satsto.me *(Bitcoin Design Community volunteers)*
- **What:** BIP-353 resolver — one ₿ search field, three resolver buttons (Google 8.8.8.8 / native proof server / Cloudflare 1.1.1.1); "names are fully validated locally on your machine using DNSSEC… They can never give you the wrong address!"
- **Verdict: PATTERN the resolver-choice UX.** Trust-minimized resolution as a *user-visible choice of resolver* — our wallet surfaces the same: registry read / DNS path / peer proof, all verified client-side.

### 5.3 silentpayments.net *(Bitsaga, Turnhout BE)* — live BIP-353+BIP-352 naming service; see §1.3 for the honesty-engineering pattern. **PATTERN; our registry replaces the service.**

### 5.4 payto *(urza, C#, NONE license, stale 2024-06)* — CLN companion that pays "lightning address, LNURL, BIP353 (DNS Payment Ins[tructions])", BOLT12. **LEAVE the code (unlicensed + dead); PATTERN the one-field-pays-anything input** — one box that accepts any payment grammar is the correct wallet input for 10B users.

### 5.5 nostrudel *(nostrudel.ninja)* — the client the zapper forked; sign-in page offers extension (NIP-07), bunker/nostr-connect, key paths *(signin page 404'd on fetch; capability attested via covenant-zapper README + client's known surface — UNVERIFIED at page level this session)*. **PATTERN: NIP-07/bunker remote-signer sign-in** = the bzDiD keychain's browser story without extensions.

### 5.6 Avathor *(michaelWuensch/avathor-rfc)*
- **What (README, quoted):** "a specification that generates unique avatar images for nodes on the Bitcoin Lightning network… the same Lightning node will have the same Avatar image in all the applications supporting it." Kills clipboard-swap attacks (visual pubkey check); contact lists from pubkeys only, "without leaking any data."
- **License:** spec open; artwork CC-BY-3.0/4.0 + free-use sets **with attribution required**.
- **Verdict: ADOPT THE SPEC, REGENERATE THE ART.** The founder's uniPeg-vibes read is exactly right: deterministic identity art for **BNR node/relay operators** — same operator, same avatar, every surface. We implement the spec (deterministic from pubkey) but render in the estate's hex medium with our generative-art stack; we do not ship their CC-BY asset sets (attribution friction), we generate ours.

### 5.7 El Tor *(bitbucket eltordev · github el-tor)*
- **What (repo descriptions, verified):** `eltor` = "Fork of the Tor network (in C). Adds paid circuit handling"; `eltord` = "Main daemon that runs El Tor, connects to wallets, listens f…"; `eltor-app` = "VPN-like client to connect to El Tor and remote wallets"; `libeltor`/`libeltor-sys` = **MIT** Rust crates bundling the C lib; pushed through 2026-01.
- **Verdict: PATTERN the economics, TAKE libeltor, LEAVE the daemon/app code (NO license).** "Heavy like gold" is right: **paid circuits = a bandwidth market over Lightning** — the sustainable-synergy candidate for bMeshNETwork/bMeshAsi transport (traffic pays bandwidth providers at the protocol layer; no subsidy, no ads). Before any commitment: read the C fork's license status (Tor-lineage licensing is per-file — UNVERIFIED) and the circuit-payment design (UNVERIFIED — bitbucket workspace is JS-gated).

---

## 6. ACCOUNTING / OBSERVABILITY / TREASURY

### 6.1 Clams *(clams.tech)*
- **What:** "Bitcoin's Accounting Layer" — double-entry bookkeeping for BTC/LN/Liquid; "Accounting records are stored either on your machine or on your self-hosted server"; "Data stays on your machine by default"; CLI + REST, one binary; connect via "Native node connections, xpub and descriptor scans"; handles "channel opens, closes, and force-closes, not just payments."
- **The tear-out, honestly:** hosted auth/licensing/billing/rates services exist but "do not receive accounting records."
- **Verdict: PATTERN the whole shape.** Our wallet's spend-view (KISS ruling: one number, itemized one click down, resource-denominated) grows into this: double-entry, local-first, channel-event accounting. The founder's "beautiful UI/UX for that subject matter" = the four numbered steps (Connect → Transform → Analyze → Report) and terminal-native austere branding — the visual law for our accounting panels.
- **UNVERIFIED:** source repo/license not located this session (curl-install product page only).

### 6.2 Sparrow *(sparrowwallet/sparrow, Apache-2.0, 2112★, active today)*
- **Verdict: PATTERN + TAKE-eligible reference.** The desktop privacy-wallet gold standard (descriptors, silent payments receive support). Java never enters the Rust stack; the *interaction design* (descriptor-first, PSBT flow, privacy warnings) is the pattern book for our Tier-2/3 receive flows.

### 6.3 lightning-detective *(andrei-21, MIT, Rust, 4★, active 2026-07)*
- **What (README, quoted):** "deduce the recipient of a lightning payment… identifies whether the payee is a user of a non-custodial wallet, custodial exchange, or something else" — via invoice hints + graph knowledge (e.g. ACINQ LSP hint ⇒ Phoenix).
- **Verdict: TAKE.** Tiny, MIT, Rust — drops into wallet-relay as the classifier that makes our spend-view say *who* (custodial vs self-custodial) without a chain-analysis vendor. Small enough to audit line-by-line; rewrite-into-crate after reading.

### 6.4 A third party's Safe on Base *(base:0x37Caccb1611CE564c064555cc97770fF14FcA440)* — ON-CHAIN RECEIPT, STUDY MATERIAL
- `eth_getCode` → canonical Safe-proxy bytecode shape (`0x6080604052…` masterCopy-read-from-slot-0, solc 0.7.6 — Safe 1.3.0-generation; **version UNVERIFIED**, impl naming API errored).
- `eth_getStorageAt(0)` → implementation `0xfb1bffc9d739b8d520daf37df666da4c687191ea`.
- `eth_call getOwners()` → **3 owners** (raw hex, decoded):
  `0x927604e15866259f3a25948804afe306ba2f1db4`, `0x5fed072ab05b0fd64c0c9a0f7ab51b4e7b66ab63`, `0x73c5f4294544ba9d37c348790c5de05736550702`
- `getThreshold()` selector attempt reverted — **threshold UNVERIFIED** (selector not recomputed this session).
- **CORRECTED 2026-08-28 (founder statement):** this Safe is **NOT the estate's — it belongs to Sam, TRUFFi's dev.** A boarding fact about a third party's treasury, read as study material. The original §6.4 verdict wrongly called it "the DAO's treasury" and asked the founder to confirm the owners — that ask is VOID, and no estate surface wires, displays, or labels this Safe as ours, ever. Read-back rule now explicitly covers Safe addresses: any order touching one states WHOSE Safe it is, confirmed against a founder statement, before executing.

---

## CROSS-AXIS FINDINGS
- **The composition nobody ships yet:** BIP-353 (name) + BOLT12 (Lightning half) + BIP-352 (secret-address half) + BIP-321 (envelope) + Cashu tokens (bearer transport) + nostr metadata (identity surface). Every piece is standard or MIT/Apache; the stack that composes them for a *multi-rail, named, private-by-default* wallet does not exist. That's the build.
- **The demographic's revealed preferences (what this raid's sources keep proving):** self-custody that hides node complexity (Phoenix, Lexe, Zeus); static payment identity (BOLT12/353/352 all converge on "post it once"); no address reuse, no linkage (silent payments); fees visible and honest (Lexe prints 0.5%; Phoenix's 2024 fee-model change caused a user revolt — UNVERIFIED, training knowledge); servers that can be self-hosted or replaced (Clams, silentpayments.net's "run it yourself"); terminal-native austere UI as trust signal (Clams, twelve.cash, hadrian's notes).
- **License haul table (the only code that may enter our tree):**
  | Code | License | Role |
  |---|---|---|
  | cashubtc/cdk | MIT/Apache-2.0 dual | Chaumian e-cash kernel → wallet-relay |
  | lightningdevkit/rust-lightning | MIT/Apache-2.0 dual | LN node core → BNR node |
  | BoltzExchange/boltz-core | MIT | Submarine-swap math |
  | BoltzExchange/boltz-client | MIT | Swap client patterns (CLN/LND) |
  | fedimint/fedimint | MIT | Federation layer (community custody) |
  | andrei-21/lightning-detective | MIT | Payee classifier → spend-view |
  | Ride-The-Lightning/RTL | MIT | Ops-panel reference (pattern-first) |
  | el-tor/libeltor (+ -sys) | MIT | Tor bundling for mesh experiments |
  | ACINQ/lightning-kmp, phoenix | Apache-2.0 | Kotlin reference only |
  | sparrowwallet/sparrow | Apache-2.0 | Desktop privacy-wallet reference |
  | ATLBitLab/twelvecash, nostream | MIT | BIP-353 API + nostr relay reference |
  **Never enters the tree:** Zeus (AGPL-3.0), boltz-backend/frontend (AGPL-3.0), Plasma (GPL-3.0), payto / covenant-zapper / eltord / eltor-app (NO license). Pattern freely; vendor never.
- **To the performance/scalability triage (founder's "pick best first, rewrite what boosts us"):** (1) cdk primitives into wallet-relay — Rust-native, no FFI; (2) LDK as the only LN engine — one implementation, one audit, WASM-bindable for surfaces (bark's binding matrix is the proof this works); (3) boltz-core swap math vendored behind our Rail trait (RAID 2026-08-09 law); (4) lightning-detective absorbed as a module; (5) everything AGPL/GPL is read-and-rewrite, with the rewrite landing in our crates so the license never touches us.
- **To the buzz lane:** the zap pattern (offer-in-metadata + cashu transport) is the wallet's social-rail integration; silentpayments.net's nostr-checkpointed log is the transparency pattern for the `.b` registry; nostream (MIT) is the reference if our relay needs features the Rust relay lacks.

---

## STACK RULINGS (for founder ratification)

### R1 — The secret address is BIP-352, and it is the default
Every wallet gets one static `sp1q…` at creation; it rides the `.b` record; on-chain linkage dies by default, not by opt-in. BOLT12 offer is the always-on Lightning sibling in the same URI. Hardware-verifiable DNSSEC/registry proofs follow the payer-side trust model of BIP-353.

### R2 — `.b` is the payment-name zone
kingbeelovis registry record = BIP-321 URI (`sp` + `lno` + optional chain addresses), owner-signed, on-chain provable. DNSSEC TXT publication for DNS-holding owners = interop with the whole BIP-353 world without hosting anyone's names. Append-only, hash-chained change log checkpointed to buzz relays every N hours (silentpayments.net pattern, our rails).

### R3 — Continuous automatic availability = the operator service
The wallet's honest weakness is scanning/uptime; the operator's product is exactly that: 24/7 silent-payment scanners (non-custodial — they scan, they never hold keys), watchtowers, offer-listeners, Autonomi replica maintenance for the user's private TX log (AES-GCM key in the user keychain — the midivault pattern, now for money), and public proof publication. "Data/Tx private/public, continuously available" = private ciphertext replicated publicly; only the keychain opens it.

### R4 — One BNR operator box, five revenue ears
LN routing fees · e-cash mint/guardian fees (Cashu mint solo or Fedimint federation) · swap fees (boltz-core submarine service) · scanner/watchtower subscription · Ark round fees + ElTor-class paid bandwidth when those rails mature. Market anchor: Lexe charges 0.5%/payment; our operators price against that, in sats, resource-denominated in the spend-view. The box runs: LDK node · cdk mint · buzz relay · Autonomi node · scanner. **Autonomy law: every service on the box must be runnable by any other operator without permission — no BNR-only chokepoints.**

### R5 — Custody tiers unchanged
Passkey → FIDO2 → Trezor (DESIGN-BRIEF-03) stays the spine; this raid adds rails, not custodians. The relay still never signs.

### R6 — Identity art for operators (Avathor, our way)
Deterministic avatar per operator pubkey, rendered by our generative stack in the hex medium; same operator = same art on every surface (contact lists, channel peers, museum exhibits). Spec-compatible, art-ours.

---

## OPEN QUESTIONS FOR FOUNDER
1. **Safe owners — VOID (corrected 2026-08-28):** the Safe read on-chain (§6.4) is Sam, TRUFFi's dev's — NOT the estate's, founder-confirmed. Nothing waits on the founder; the address is third-party study material only. Read-back rule extended: any order touching a Safe states whose it is, founder-confirmed, first.
2. **Fedimint guardianship** — do we seed the first federation with estate boxes (bNr, Oracle VPS, yours), or ship Cashu-mint-solo first and federate later? (Recommendation: cdk first, Fedimint when a community asks.)
3. **Ark** — adopt-as-pattern only until bark's license is read and an operator-runnable ASP exists; or commit earlier? (Recommendation: pattern-only for now.)
4. **ElTor** — green-light a paid-circuit reading room for bMeshAsi (license archaeology on the C fork + circuit-payment design), or shelf? Founder called it "heavy like gold" — recommend the reading room, no code.
5. **Scanner pricing** — flat sats/month vs per-find fee vs free-for-.b-holders? (Recommendation: free tier for names, sats for volume — liquidity flows to operators either way.)
6. **Clams** — locate + license the source; if closed, our Rust double-entry ledger is greenfield (it likely is greenfield either way).

---

*zA, acting captain. Haul verified at source; UNVERIFIED markers stand where they stand. The schematic companion lives beside this file: `RAID_WALLET_SOVEREIGN_LIGHTNING_schematic.html` — open it in any browser, zero outbound, and see the whole stack breathe.*
