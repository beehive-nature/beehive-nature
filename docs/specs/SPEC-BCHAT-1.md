# SPEC-BCHAT-1 — the estate's messaging stack: one surface, three trust lanes

Status: GENESIS LANDED 2026-10-02 (zCode seat, branch `zcode/bchat-stack-2026-10-02`).
Founder ask 2026-10-02: start the messaging/DM/chat stack from the GrapheneOS
Messaging analysis — "integrate its UI/Android plumbing, not make GrapheneOS
Messaging itself the BNR protocol." This spec is the canon that order becomes.

## THE FINDINGS AT SOURCE (2026-10-02)

1. **The estate had no JS NIP-44.** Rust-only, and only on the unmerged
   `codex/z2b-bpay-rail` branch (`docs/agents/ADVERSARIAL-BPAY-SPECS.md`).
   The bKiMi observer blackout (2026-09-17 dispatch) pinned the deployed-cap
   lesson: NIP-44 v2's plaintext bound is implementation-deployed (nostr
   0.44.7 = 65,408 bytes; observer's own = 65,535); size before encrypt.
2. **The in-tree browser relay client was read-only and public-relay**
   (`surfaces/blight/relay.js`, v1 bX pointers). Publish + auth existed only
   in Node (`ops/join-event-publish.mjs` — the NIP-42 AUTH dance) and in
   buzz-mail (kind 9 plaintext channel wire). No DM/encrypted-message
   surface existed anywhere in the fleet.
3. **The crypto substrate was already vendored.**
   `surfaces/onboarding/vendor/bnr-sign.js` bundles @noble/secp256k1 2.3.0
   (ECDH `getSharedSecret`), @noble/curves 2.3.0 (BIP-340 `schnorr`),
   @noble/hashes 1.8.0 (sha256, hmac) — MIT, first-party load law, pinned
   self-test. NIP-44 v2 needed only HKDF + ChaCha20 on top: both pure JS,
   both now vector-pinned in `surfaces/bchat-nip44.js`.
4. **GrapheneOS Messages is MIT-licensed open source** (repo
   GrapheneOS/Messages; project apps are MIT with AGPLv3 for the Apps
   client) — reusable plumbing, checked at lane start. Cite the LICENSE
   file at any fork point.
5. **The five-primitive vocabulary (COMMIT · PROVE · RETAIN/FORGET · SETTLE)
   is NOT in-tree as a named set.** Nearest kin: GLOSSARY-BRIDGE's
   RETAIN/FORGET ruling ("publication-consent routing, not deletion — no
   deletion promise exists anywhere"). This spec adopts the five words as
   the messaging stack's vocabulary with that ruling as RETAIN/FORGET's
   definition of record.

## §layers — the three layers (the founder's architecture, verbatim in spirit)

1. **bChat Core** — transport-neutral conversation/message model.
   IN-TREE: `surfaces/bchat-core.js` (envelope v1, lanes, retention,
   measured attachment states, bMeter-shaped receipts; zero deps).
2. **Surfaces** — the conversation UI. IN-TREE: `surfaces/bchat.html`
   (browser, three registers, dual-home relay door, prove-the-encryptor
   panel). NEXT: the Android surface (§grapheneos).
3. **Adapters** — SMS/MMS bridge, BNR private transport (relay, NIP-17
   gift wrap), Autonomi attachment retrieval. IN-TREE: the BNR transport
   adapter lives in the surface today (turnkey law: page-local ROOM);
   SMS-bridge and Autonomi retrieval are named seams, not built.

## §lanes — trust is payload, never decoration

| lane | trust | what it is today |
|---|---|---|
| ▸ SMS | carrier — display-only, LOW | SIMULATED demo thread in bchat.html, labeled in place. No fake sends, ever. Real carrier text arrives only with the Android surface. |
| 🔒 BNR private | end-to-end NIP-44 v2 between nostr identities | REAL: encrypt/decrypt proven against the official vectors; NIP-17 rumor→seal→gift-wrap (kind 14 in 1059); NIP-42 AUTH at the relay door; publication proven by event id on OK true. |
| ▣ AUTONOMI | capability travels, bytes stay out | descriptor-only (autonomi://addr + bytes + sha256) rides inside the encrypted envelope; states are MEASURED: descriptor-only → retrieving → retrieved → hash-verified. Retrieval adapter is Building — capability-truth, never claimed live. |

**The boundary that does not move:** SMS is carrier transport. BNR identities
and keys never derive from phone numbers and never touch the telephony
subsystem — the handset is never an E5 root-key holder just because it
displays messages. One app may SHOW all three lanes; underneath, they never
pretend to be equivalent.

## §envelope — v1 (bchat-core.js, the COMMIT layer)

`{v:1, id, ts, lane, from:{kind:npub|phone|label, value}, body:{type:text|attachment, …},
attachment?:{addr, bytes, sha256, state}, policy:{retain: persistent|until-read|ephemeral,
forgetAt?}, claims?}` — validated before it exists; `wireEncode/wireDecode`
carry it as the NIP-17 rumor content. PROVE = `claims` (absent by default,
future credentials). RETAIN/FORGET = policy + `applyRetain()` which prunes
the LOCAL store and REPORTS what it did, per the GLOSSARY-BRIDGE ruling.
SETTLE = paid services, founder-gated, absent; receipts never carry contents.

## §wire — the BNR private transport, today

Dual-home relay (ROOM block: `wss://skaists.buzz` primary,
`wss://relay.skaists.dev` fallback; road-memory + opt-in no-cors probe —
lane G laws). Connect is a click — no request renders the page (rub law).
NIP-42 AUTH on challenge (kind 22242, relay+challenge tags). Send: envelope
→ rumor(kind 14, unsigned) → seal(kind 14, signed, NIP-44 to recipient) →
gift(kind 1059, EPHEMERAL one-time key, NIP-44 to recipient) → `["EVENT",gift]`;
the ephemeral key is used once. Receive: subscribe `{kinds:[1059], "#p":[us]}`,
unwrap with eph→us, VERIFY the seal's signature, then sender→us to the rumor.
Relay verdicts (OK false, CLOSED) render verbatim — never paraphrased as success.

## §grapheneos — the Android surface posture

REUSE (plumbing, MIT): conversation lists/views, notifications, media/camera
sharing, `ACTION_SEND`/`SEND_MULTIPLE`, contact integration, default-SMS
machinery, widgets. NEVER INHERIT: its security model — BNR chat keeps its
own envelope, identity, encryption, receipts and storage/relay; SMS stays a
visibly separate low-trust lane. The Android build lane is SEAT-OPEN: first
beat is a fork/licensing pass against GrapheneOS/Messages@HEAD, then
conversation UI bound to bChat Core with the three lane badges.

## §receipts

bMeter-shaped: `{event, ref, ts, kind?}` — publication, rejection, unwrap,
refusal, AUTH, open. Contents NEVER enter a receipt. The surface shows its
own receipt log; the economics join stays with the zBlood/bMeter lanes.

## §open — named, not hidden

- **Relay DM-kind allowlist UNVERIFIED.** Box ssh refused connections
  (reset by peer, 2026-10-02) so whether skaists.buzz accepts kinds 14/1059
  is unproven; the surface renders the relay's verdict verbatim either way.
  NEXT OWNER: box seat — read the relay's kind policy, flip the allowlist if
  1059 bounces (ops/ law: change tree and box together).
- Autonomi retrieval adapter (descriptor → stream, bview's SW is the
  candidate seam). NEXT OWNER: bData/bview seat.
- Android surface (§grapheneos). SEAT-OPEN.
- NIP-44 v2 deployed caps: our module rejects empty and >65,535-byte
  plaintexts (official invalid vectors pin exactly this); large-media stays
  an Autonomi-lane job, never a chat-payload job.
- Language: bchat.html is English-only at genesis; the 28-tongue corpus
  adopt is the language lane's beat (corpus laws govern).

## §vectors — the receipts that make the crypto claim

`e2e/bchat-core.test.mjs` (CI-wired): all official NIP-44 v2 vectors from
paulmillr/nip44 `nip44.vectors.json` (sha256
269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040 PUBLIC-CONSTANT — the pin
the NIP itself publishes), including twist-attack and invalid-MAC/padding
rejections; RFC 5869 HKDF case 1; RFC 8439 ChaCha20 §2.4.2. Claim wording
cap: "sound by construction against the pinned official vectors" — the
vectors are the receipt, in CI, on every push.
