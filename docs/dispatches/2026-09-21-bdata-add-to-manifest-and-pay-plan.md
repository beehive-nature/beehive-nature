# DISPATCH — My Data: "Add to manifest" + Phase E pay step — the decision on how bytes reach the bridge, and the phases

**From:** Seat 3 (Claude Code, Fable 5.1), 2026-09-21. **Order:** Seat-1, Phase E order + addendum, same day.
**To:** ZcODe5.3max (bData lane owner — your app seat was not running; this is the notice), bOPus5 (MY SPACE rail 4).
**FOUNDER ACTION SURFACE:** My Data → **Add to manifest** → who can get this → price → authorize → **pay with your wallet** → receipt.
Agents spend nothing. Every gate runs against a mock bridge and a mock wallet. The first real file is chosen and paid by the founder.

## What is already true (evidence, 2026-09-21)

- `surfaces/ant-pay.js` is on main (PR #190, 8/8) and live. It refuses `no-contracts` against today's bridge.
- The CLI fallback works end to end on mainnet, run by the founder's own hand on a test recording: 56/56 chunks, 4.2126 ANT,
  0.0000445 ETH, download sha256 = original. **Founder decision, same day:** that recording is not his (a local-test-network
  demo with other people in it), so it is not published under his name and its address is not promoted — it is not recorded
  here. **Consequence for the UI demo:** the founder's first UI press uses a file the estate owns, recorded on his machine on
  the live network; that becomes ants.tub's first entry.
- **The key clause stands** (founder, same day): "no agent holds/requests/transmits private key material" is unchanged. An upload
  wallet is a narrow exception the founder writes himself — named, capped, single-purpose, never his keys. Until then no seat
  creates or uses one. Phase E needs none: the person's own wallet signs.

## THE DECISION (addendum item 2): how a chosen file's bytes reach the keyless local bridge

**`POST http://127.0.0.1:8807/v1/intake`, the file as the raw request body, streamed.** Headers carry the display name
and the page's own sha256. The bridge writes to `<state>/intake/<sha256>/<name>`, hashes WHILE writing, and registers the
tuple in `artifacts.json`. It answers `{ sha256, bytes, name }`.

- **Two witnesses, never one.** The page hashes the file itself (incremental SHA-256 in JS — WebCrypto cannot stream) and shows
  name · size · sha256 BEFORE anything is sent. The bridge hashes independently. If they differ the intake is REFUSED by the
  bridge (409) and by the page. A page must not be its own witness.
- **No paths, ever.** A browser cannot know a path and the bridge's own law says the product never sends one. After intake
  everything is by pin (`artifact_sha256`), exactly as today.
- **Local only.** Intake copies bytes from the browser to the same machine's bridge. Nothing leaves the device until a paid
  upload. The bridge stays keyless.
- **The bridge must not be a disk-fill target for any open tab.** `/v1/intake` checks `Origin` against an allow-list
  (the estate's origins + localhost), enforces a byte ceiling, and refuses a duplicate pin with the existing tuple.
- **Files over the wave limit never travel.** More than 63 full chunks (63 × 4,190,208 B ≈ 264 MB) is a merkle plan, which
  neither `ant-pay.js` nor the bridge's finalize can pay yet. The page says so as a row — "not available yet: files this
  large need batch payments, which are not built" — and never sends the bytes. Never a disabled button.

## THE PHASES (one phase per PR; each has its own gate)

| | what | blocked on | acceptance |
|---|---|---|---|
| **E-0** | bridge `/health` names `evm{chain_id,payment_token,payment_vault}` from evmlib | **founder's hand**: the app's permission layer refuses this seat any edit to the bridge, even to a copy. `C:\Users\travi\bridge-build-next.sh` builds a candidate on port 8817 without touching 8807; swap-in is a second, separate step | `/health` on 8807 shows the vault the chain shows |
| **E-1** | pay step in `bdata.js` after "Authorized": plan row (token, spender, exact ANT, confirmations) → Trezor Connect (primary) / injected wallet → waiting with real seconds → receipt (address, pieces, ANT, time) | nothing | mock bridge + mock signer e2e; 3 registers; 390px; 44px; every refusal code has words; 28 tongues for every new key |
| **E-2** | "Add to manifest": picker + drag-and-drop, in-page sha256, name · size · sha256 shown, then the same chain | bridge `/v1/intake` (same founder-hand constraint as E-0) — page built and gated against the mock first | mock intake e2e incl. hash-mismatch refusal and the too-large row |
| **E-3** | the manifest as a list: prepared / priced / paid / stored per file; the registered video stays the first row | E-1, E-2 | state derives from bridge jobs + kept receipts, never from a label |
| **E-4** | Trezor Connect against the REAL device, connection + address read only, with the founder — no signing | founder present | the address on the page equals the address on the device screen |

Founder's casing is payload throughout. Wording in the UI: en **"Add to manifest"**.

## BOUNDARY NOT CROSSED

`bdata.html` / `bdata.js` are untouched by this dispatch. No bridge source, binary or state was changed by this seat
(a refused half-edit to `family-lineage/antd-bridge/src/main.rs` was reverted and verified byte-identical against the
backup in `C:\Users\travi\bridge-backup-2026-09-21`). No signature, no payment, no press on the live bridge.
