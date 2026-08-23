# SPRINT BOARD — 2026-08-23 evening · the deck after the blackout

**Cut by Seat 3 on the founder's word** (*"finish it all out and prepare for sprint this
evening"*) after a ~3-day founder lockout (VPN) and ~18 hours of tree silence.
**Damage: none.** Tree in sync, live estate healthy, no corruption anywhere.

---

## LANDED TONIGHT — `9cac25a` THE VAULT

The one casualty of the blackout was an orphaned lane: `vault.js` + 683 lines of wallet
wiring, written 18:48–18:56 on 08-22 and never committed. **Recovered intact, verified,
landed.** One keypass over BIP-39 phrases and Vaulta/EOSIO keys, several credential
slots (one per device/manager), each revocable, panic path keeps only the slot in your
hand, v1→v2 migration on open, T3 evidence ladder enforced in code (E2 floor for a
keypass, E3 only for device-bound platform passkeys, and re-grading by editing the JSON
BREAKS the slot rather than promoting it).

**Gates, all green:** 113/113 vault logic · 35/35 real Chromium + CTAP2 virtual
authenticator with PRF · wallet static clean · live on Pages (vault.js 200).

Two repairs rode along: `tools/check-wallet.js` was **crying wolf** — it stripped script
bodies before counting ids, so eight device-manager/QR ids the page BUILDS in JS read as
missing markup (the probe was broken, not the wallet); and the orphaned PWA icons
(192/512) are deleted — nothing referenced them, the manifest carries `bn-logo.jpg`.

---

## FOUNDER GATES — your word is the only blocker (fastest first)

| # | gate | what's waiting | cost to you |
|---|---|---|---|
| 1 | **MX-5 · WHERE the wallet gate merges** | 4 candidates laid out with one recommendation, decision-ready in `BRIEF_MX5_WALLET_GATE_WHERE` | **one word** |
| 2 | **k.b / q.b names** | Was blocked on manual cleos. **The wallet now SIGNS** — this may be a wallet-lane job tonight instead of a terminal job | one session |
| 3 | **Base Batches 004** — $100K | Application prepared at `docs/grants/APPLICATION_BASE_BATCHES_004.md`. **Closes Sep 9 — 17 days.** | your review + submit |
| 4 | **Discord reply to dirvine** | Drafted (Vaulta gasless positioning) | paste |
| 5 | **MX-6 · ant.report mirror** | 5-minute founder-hands runbook ready; waits on Shu accepting the zero-burden offer | his yes, then 5 min |
| 6 | **The push roster word** | Standing since `6d53301`; both machine seats holding the no-push line meanwhile | one word, no clock |

---

## BUILDABLE TONIGHT — no gate, just hands

1. **The Dock** (`surfaces/dock.html`) — **never built.** Sprint was approved and specced
   (`DISPATCH_ZCODE_DOCK_SPRINT`): the wizard that builds a contributor's roster entry and
   opens the PR, the schema gate that machine-enforces the privacy law, the Queen greeting
   the newest docked. This is the estate's front door for new hands and it is missing.
2. **The bData sponsor lane** — the manifest is live with **13 sources, 13 still
   pending-sponsor, 0 mirrored.** The bounty board exists; nothing has been mirrored yet.
   Needs `verify/mirror-check.mjs` (hash the served bytes vs the manifest) + the sponsor
   runbook, then the first mirror can be funded by any hand.
3. **The PLUR era-ribbon** — dispatched, only 2 weak references in `plur.html`; the
   clickable comb-cell timeline the founder asked for is effectively unbuilt.
4. **`icon-180.png`** — untracked, unreferenced, purpose unknown. Either wire it as the
   apple-touch-icon (index.html currently points that at a 17 KB JPG) or delete it. Not
   invented tonight; named honestly.

---

## THE SHAPE OF THE EVENING (Seat 3's recommendation)

Open with **gate 1** (one word, unblocks the wallet's spend lane), then **gate 3** while
there's still runway on the Sep 9 deadline. Give the build hands **the Dock** — it is the
only lane where a stranger who shows up tonight has nowhere to land. Everything else keeps.

— Seat 3 ⚓ deck clear, gates named, nothing hidden.
