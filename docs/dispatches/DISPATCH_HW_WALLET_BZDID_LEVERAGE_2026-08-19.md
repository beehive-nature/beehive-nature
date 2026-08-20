# DISPATCH — open-source hardware wallets × bzDiD/BEELOG × `.b`: the four seams

**From:** Seat 3 (Claude Code) · **2026-08-19** · founder-directed (mobile relay), against
`docs/bzdid-architecture-decision.md`
**Status:** OPEN — §1–§5 are receipted facts; §6 is the honest-limits shelf; §7 is options,
not rulings.

Founder: *"so how can we leverage our open source hardware wallets with this and
bzDiD/bDiD-\*.b"*

**Headline: the architecture and the code already reserve every seam.** The hardware wallet
is not an accessory to bzDiD — it can occupy each trust anchor the decision doc names, and
in four places the tree has already typed the slot it plugs into. Nothing below requires an
architecture change; two items require firmware work, one requires a mainnet receipt that
does not yet exist.

---

## 1 · The passkey seam — a Trezor can BE the free-tier authenticator (verified in the fork)

The free tier signs up via WebAuthn with the PRF (`hmac-secret`) extension
(`bzdid-architecture-decision.md:49` — "the seed never leaves the authenticator"). Verified
this session in the fork:

- `core/src/apps/webauthn/README.md` — the firmware is a *"first-factor roaming
  authenticator usable for passwordless login"* and its Extensions section lists exactly
  one extension: **hmac-secret**. The exact one bzDiD needs.
- `fido2.py:1943` advertises `hmac-secret` in getInfo; `:1892-1896` refuses to reveal it
  during **silent** authentication — the bzDiD root seed is withheld until a physical touch
  on dedicated hardware, isolation a platform passkey living inside the host OS does not
  provide by design.
- `credential.py:373-380` — CredRandom derives from the device seed via SLIP-0022, so **the
  bzDiD root recovers from the BIP-39 mnemonic with no vendor in the loop** —
  vendor-independent by construction, which platform passkey sync does not offer (their
  recovery routes through the vendor's account system).

**Bounded by two standing rules:** SPEC-ONBOARDING-IDENTITY-1:32 separates device classes —
the Trezor's FIDO2 is a *"SECONDARY backup, not the primary authenticator"* (one compromise
must not cascade across rails) — and hardware is **never required**
(`onboarding::AuthenticatorKind`'s own comment: "access is a preference, never a
credential"; `Enrolment::complete` makes a hardware-only enrolment without the written-code
floor unrepresentable).

## 2 · The rotation seam — `r2` is a hardware slot by name

`bzdid-architecture-decision.md:50` reserves `r2` = "optional second device" among the
genesis rotation keys, and `onboarding::RecoveryPath::SecondAuthenticator { credential_id }`
already models it. A Trezor-held rotation key gives any phone-passkey identity a
hardware recovery/rotation path with **zero chain bytes**. The escalation is already on the
live hardware page: a 2-of-3 quorum across different makers and firmware lineages
(Safe 7 + Passport Prime + SeedSigner), fully air-gapped over QR — heterogeneous hardware
as the rotation-key *set*.

## 3 · The signing seam — paid `.b` claims and the honesty flag

Paid `.b` claims are ordinary Vaulta actions (`commit`/`reveal`/`forcecommit`, decision doc
§3.2), and the pipeline's unsigned half is built: `wallet-relay/tx_prep.rs` prepares
`updateauth`/`linkauth`/`newaccount`+`buyrambytes` and a mint walkthrough that writes
**device-read addresses** (`payload.source = "trezor-device-read"`, custody tier T-H) into
the identity record per SPEC-VAULTA-IDENTITY-1. `bsigner` defines the exact seam
(`SignerChannel::sign`) it deliberately refuses today, with the honesty gate written into
the acceptance criterion: *"a rail may be called working only with a logged request →
**on-device confirm** → broadcast → chain receipt."* And `wallet-relay/trezor_bridge.rs` is **built** to
speak to a physical Trezor over the local Bridge (127.0.0.1:21325, v1 framing, stock
firmware, no third-party page) — the founder-ruled "never wait on someone else's
integration schedule" lane — but the THP matrix marks that lane **UNVERIFIED-on-device**:
no physical device was attached when it was built, and **one device receipt is owed**.

Fork state, verified: the EOS→Vaulta promotion is **done and current** (`BEEHIVE.md`;
`core/src/apps/base.py:150` — *"Vaulta IS EOS. This fork exists to sign for it, so T3W1
announces it"*; Eckhart strings filled; the zano/CLSAG objects compile for thumbv8m — the
older build-inventory link blocker is fixed and a T3W1 image has been built).

**The honesty flag (receipt rule):** `b-domain/README.md` says *"Every action is signed by
the Trezor EOS app (proven on Safe 7)"* — but that proof traces to the **emulator pubkey
harness**, and a sweep found **zero on-chain mainnet/testnet Trezor-signed EOS transaction
receipts** anywhere in the tree. The claim is ahead of its receipt. Additionally, custom
contract actions (`registeracc`, and BEELOG's future `commit`/`reveal`/`forcecommit`) sign
today only through the **unknown-action path** — the device shows a bare sha256 checksum,
not the name being claimed. The two highest-value firmware adds fall straight out:
**named confirm screens for `.b` actions** (the user reads `alice.b` on the trusted
display), and **a first landed hardware-signed transaction** (§7).

## 4 · The trusted-display seam — rule 9/10 in firmware is the strongest single leverage

Send-time resolution ends with a 2-word checksum "for out-of-band confirmation" (decision
doc `:120`), and *"Rule 10 is load-bearing… Fail closed"* (`:127`). On a compromised host,
a host-rendered checksum is worthless — and honest risk #2 (`:490`) is precisely that the
wallet reads root and proof from one trust domain. The hardware wallet answers both at
once:

- The whole verification is **40 sha256 folds plus one comparison** (`:104-105`) — trivial
  in firmware. The device re-verifies the Merkle path itself and becomes the independent
  trust domain risk #2 demands.
- The device screen displays `alice.b` + the 2-word checksum computed **on-device from the
  verified leaf** — WYSIWYS for names, out of the host's repainting reach by construction.
- Granted-set firmware (UX-OPTICAL-PAIRING-1:260-264: *"even a fully harvested seed phrase
  cannot make the DEVICE sign outside the pre-approved set"*) is the device-side twin of
  fail-closed rule 10 — a differentiator we have found in no stock wallet, and the reason
  the fork exists.
- The optical lane closes the loop with no cable and no host trust: the Safe 7 touchscreen
  as bcomb/QR **transmitter** is already a named firmware-lane candidate — with its return
  leg explicitly **UNVERIFIED** (flagged in UX-OPTICAL-PAIRING-1 open item 3; verify before
  speccing). The directional law binds: *"the UNTRUSTED/new device DISPLAYS; the TRUSTED
  device SCANS and signs."*

## 5 · The Zano seam — the firmware IS the reference implementation

`chain-zano` is declared **Trezor-native at the crate root** ("the spend secret `s` lives
on the device and never enters host RAM in production"), its derivation is ported
byte-for-byte from hyle-team source (cite-or-stop satisfied), and its SLIP-0010 step
deliberately diverges from the standard — *no stock tool can reproduce this wallet*, so the
fork's firmware is not an implementation of a spec, it **is** the reference. The end-to-end
test stays `#[ignore]`d until a firmware-minted seed→view_public vector exists, and
`dro-signer` names the landing in code: *"Real implementations (`SoftwareSigner` Tier 1,
`TrezorSigner` Tier 2) … land with the firmware crypto track"* (CLSAG_GGX, BP+, tx-prefix —
the fork's ported CLSAG_GGX feeds this seam directly).

## 6 · Honest limits

- **The free tier needs no hardware, by arithmetic and by law** (decision doc `:61`; ladder
  seam: "a Larva user has real identity; T-H signing arrives at Bee"). Hardware raises the
  custody floor; marketing it as required would betray the architecture's whole point.
- **Device loss never rebinds Layer-0** (SPEC-VAULTA-IDENTITY-1:26-29) — the wallet is an
  adapter anchor, additive, never authoritative over the identity.
- **PQ-readiness constrains the envelope, not the device** (PAY-ONCE #1 +
  SPEC-VAULTA-IDENTITY-1:62-65): classical secp256k1 device keys stay valid; ML-DSA-65
  succession is additive at the envelope layer. No device swap, no re-mint.
- **The 60-minute watchdog** (`iwdg_start(60*60)`, unsafe-vendor-header images) bounds host
  flows: commit→reveal spans epochs by design and is fine, but keep any signing ceremony
  under ~55 minutes for margin.
- **Blocked on Trezor:** the Safe 7 authenticity root (`t3w1/authenticity.json`) is a 404
  (VERIFIED-FACTS A37) — device-genuineness attestation waits on a publication BNR does not
  control. Custom-firmware install itself is vendor-sanctioned (A18).
- **Two small reconciliations owed:** hardware/index.html's shelf labels Safe 5 "the bSAFE
  target rung" while its ladder row and build.html say bSAFE 7 — one of them is stale; and
  the "Trezor bSAFE 7" naming clearance (flagged in UX-OPTICAL-PAIRING-1 §7 open item 4)
  is still open.

## 7 · Options, in leverage order (research + options; nothing here is a ruling)

| | option | why this order |
|---|---|---|
| **O-1** | **Land the first hardware-signed mainnet transaction** — the natural candidate is the `.b` renewal the decision doc already calendars ("the names expire 2027-07-28 and 2027-08-01. Put it on a calendar now"): a live obligation, low stakes, and it converts §3's honesty flag into a receipt. **Precondition: read `bdomain.cpp`'s renewal path first** — the renunciation ledger marks whether renewal needs admin authority as UNVERIFIED, and if it does, this candidate changes shape | receipt rule: the README's claim needs its chain receipt, and Phase 2's definition of done is a mainnet landing |
| **O-2** | **Named confirm screens for `.b` actions** in the fork (registeracc today; commit/reveal/forcecommit when BEELOG ships) | closes the bare-checksum gap — the user reads the name on the trusted display |
| **O-3** | **Checksum-on-device** (rule 9): compute and display the 2-word checksum in firmware from the device-verified leaf | the cheapest firmware change that defeats host address-swap |
| **O-4** | **Merkle fold in firmware** (rule 10 device-side): device refuses to sign a send unless the proof folds to an independently-read root | makes the load-bearing rule hardware policy; the full answer to honest risk #2 |
| **O-5** | **Research `PUB_WA`** — Antelope natively supports WebAuthn account keys (flagged in the candidates ledger: "uniquely enables Tier-A in-tab hardware signing"), so a Trezor FIDO2 credential could directly authorize a paid-tier Vaulta account with no EOS app and no bridge in the path | an unexplored second Vaulta lane; verify against the chain before speccing |

O-1 is founder-present work (mainnet, real keys — no agent touches key material, per
standing law). O-2–O-4 need no mainnet act and no key material; whether and when to build
them is the founder's pick from this table. O-5 is a read.

**Seat 3, 2026-08-19.**
