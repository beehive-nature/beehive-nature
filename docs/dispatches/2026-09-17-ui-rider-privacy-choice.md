# UI RIDER — the privacy choice is first-class and comes BEFORE the quote

**Date:** 2026-09-17 · **To:** the active bPay/W@tch UI seat (Max zCode session)
**From:** founder routing, relayed by the RECON-1 seat · **Main:** `5c03c6de`
**Urgency:** send-now — this affects the plan BEFORE Quote → Commitment →
Invoice. It is much cheaper to establish this UX boundary before the Bux
public path is wired as though "public" were the only possible storage mode.

## THE CHOICE, FIRST-CLASS, AT THE START OF THE PRESERVATION FLOW

Not an "advanced settings" drawer the user reaches after already creating
the wrong kind of object. The ordinary UX is extremely simple:

### Choose how this is shared

**🌐 Public**
Anyone with the address can retrieve it.
Best for videos, websites, publications, open family history.

**🔒 Private**
Encrypted for you and the people/apps you authorize.
Best for personal files, family records and private media.

**⌬ Advanced / Cypherpunk**
You control the cryptographic and network policy.
For users who want explicit custody, disclosure and routing controls.

For the Bux MP4, **Public** would naturally be selected because the source
is intended for public distribution — but that is **the user's UI choice**,
never something an agent silently infers and commits.

## ADVANCED EXPOSES POWER, NOT JARGON FOR ITS OWN SAKE

Cypherpunk expands into meaningful controls:

- **Identity & access** — recipient keys/capabilities, anonymous/pseudonymous
  publication, revocation model where supported.
- **Encryption** — explicit encryption policy, locally controlled keys, key
  export/custody choices.
- **Storage** — Autonomi object/address behavior, redundancy/preservation
  policy where controllable, immutable edition handling, pointer policy.
- **Network** — direct/P2P preference, relay/proxy allowance, metadata/
  disclosure constraints.
- **Payments** — exact asset, maximum spend, fee payer, quote expiry, bounded
  authorization, refund/credit behavior.
- **Proofs** — hashes, signatures, provenance receipts, retrieval
  verification, optional ZK/selective-disclosure policies as those adapters
  mature.

And eventually **Forgetability** — what can actually be forgotten/revoked
versus what is immutable and cannot honestly be promised deleted. That
honesty matters because "Private" must never imply "the bytes don't exist
publicly anywhere" if the underlying architecture can't prove that. Where an
adapter doesn't support a control, the UI must not offer it as a promise
(eco-adaptor-sweep discipline, 2026-09-12).

## ONE CAPABILITY/POLICY OBJECT UNDERNEATH — NOT THREE ARCHITECTURES

`Public` → a safe preset. `Private` → another safe preset. `Cypherpunk` →
the same object with its policy dimensions exposed. A user can start with
Private, open Advanced, change one property, and see:

> **Private · Customized**

— not be forced into a completely different product. And the **receipt
records the resolved policy, not merely the button label** (the
measured-states discipline: the label is never the state).

## POSITION IN THE JOURNEY — BEFORE REVIEW & PAY

1. **Choose file** → `try_autonomi.mp4`
2. **Choose privacy** → Public / Private / Cypherpunk
3. **Prepare** → storage/encryption/publishing plan derived from that choice
4. **Live quote** → quote the **actual chosen plan**
5. **Invoice** → economics bound to that plan
6. **Review & Pay** → the founder sees BOTH what is being paid for AND what
   privacy/disclosure policy is being authorized
7. → Trezor → upload → verify

**Load-bearing seam (the RECON/INVOICE reason this must come first):** the
quote prices the plan and INVOICE-1's commitment digest covers the priced
plan (carried quote set). You cannot quote a public upload and then flip it
to encrypted/private after payment — that changes bytes, storage
requirements, addressing, and economics; it would re-forge the commitment.
Privacy resolution is therefore part of the plan BEFORE
PricingCommitment → INVOICE-1 → RECON-1, and the resolved policy rides into
the receipt.

## "WHO CAN GET THIS?" — PLAIN LANGUAGE UNDER THE SELECTOR

> 🌐 **Public**
> Anyone who obtains this Autonomi address can retrieve the video.
> Your original file will be preserved unchanged.

> 🔒 **Private**
> Stored encrypted. Only identities/capabilities listed below receive
> decryption authority.
> Autonomi nodes store ciphertext, not your plaintext.

Advanced shows the cryptographic details. That gives the dual UX aimed for
everywhere: **newbee** sees Public/Private; **raver** understands permissions
and costs; **cypherpunk** can inspect and control every meaningful boundary.

## NEXT OWNER

The active Max zCode UI seat — fold into Phase A/B wiring (the choice and
the summary are Phase-A rendering; the policy object binding into the quoted
plan is Phase-B economics binding).

## HUMAN INTERACTION

NONE (docs rider, ordinary merge, agent-side). The founder's next gesture
remains the button — Review & Pay, on a plan whose privacy policy he chose
himself.
