# KEYCHAIN-CONTINUITY-002 — the Hive door, the succession proof, and the ownership that remains

Date: 2026-10-12 (America/Denver). Seat: zCode, order KEYCHAIN-CONTINUITY-002, branch `zcode/keychain-continuity-002` from main `83775b5ec` (rebased mid-lane from `c503946e8` onto Agent 30's bDroP correction round, which handed this lane its contract as issue #405).

## Ownership, reconciled first

- **The archived keychain owner's unfinished work is taken.** `docs/dispatches/2026-10-12-keychain-deployment-receipt.md` left three items "still to be built and tested": a host-replacement procedure, re-enrolling a passkey on the new origin from the recovery code, and a signed record of the new origin. All three are delivered and proven below. The completed HTTPS deployment was preserved; no DNS, certificate or Pages-setting work was repeated.
- **Agent 30's bDroP lane is ACTIVE** (correction round `83775b5ec` landed mid-lane; issue #405 is their explicit handoff of the native signing contract to this seat). This seat delivers the keychain side and the desk-side door, re-based onto their corrected structure (`#signer-native`, the `handoff` stage, never-auto-selected radios). The bDroP surface remains Agent 30's lane to own from here.
- **The ANT purchasing owner (agent20) is ACTIVE** (`2026-10-11-agent20-wallet-three-style-ux.md` continuation). Purchasing ownership was NOT taken. Live ANT acceptance stays with agent20 and the founder's bounded gestures; the evidence lines that must stay separate are listed at the end.

## Deliverable 1 — the native Hive signing door (issue #405, closed by construction)

**What the keychain signs now, beside the unchanged ANT payments:** exactly one disclosed root post — a bDroP `comment` operation — under its posting authority, for one named account, on Hive mainnet. Nothing that can move funds is signable: no transfers, no votes, no custom ops, no replies, no extensions, no undisclosed metadata, no second operation, no expired or >1 h transaction, no body past the 64 KB post cap, no author that is not the account the key derives for.

**Custody boundary, unchanged and reused:** the request arrives as a *structured* transaction; the keychain serializes its **own copy** with the same vendored `hive-tx` the wallet uses (`keychain/vendor/hive-tx.min.js`, SRI-pinned, behind a keychain-owned `prelude.js` that carries only the browser guard the vendor needs at init; the page CSP keeps `connect-src 'none'`, so the keychain still makes no network call ever). An opaque digest from any page can never be signed, because there is no digest parameter to sign. The posting key is derived inside the keychain as `hive-posting:<account>` under the same HKDF law (`deriveK1Key` — Hive signatures are secp256k1 recoverable, recovery+31 + compact r‖s); a `.b` name never shapes a key, and each account's key is its own — asking for another account derives another key, so no account fallback exists to be silent about.

**The interface (postMessage, `v:1`, same shape discipline as the ANT path):**
- `kc.hive.pub {account}` → `kc.hive.pubbed {account, pub}` — public data only; lets a caller check chain authority before asking anything.
- `kc.sign {hive:{account, tx}}` → the same confirm-card law as payments: decoded in the keychain, shown with the body sha-256 **computed inside**, the disclosure version, and "posting authority — no funds can move"; the press is trusted and delayed exactly as for payments; the reply is `kc.signed {raw (130-hex signature), hash (txid), pub (STM…), kind:'hive'}` or a typed `kc.refused`.
- The EVM/ANT interface is byte-for-byte its old self — `kc.sign {tx}` and the envelope checks are untouched, `kind:'evm'` is now just named explicitly. `keychain-wallet-purchase.mjs` and `keychain-isolation.mjs` pass unmodified (only their route tables gained the two new site assets).

**The desk-side door (`surfaces/bdrop.html` / `bdrop.js` v5, Agent 30's corrected structure kept):** the radio `#signer-native` ships disabled and is enabled only when `keys.skaists.dev` answers (`KeychainClient.mount`); nothing is auto-selected — the reader's own press chooses the door, per the correction round's law. The publish flow: unlock check → `hivePub` → **chain authority check** (`condenser_api.get_accounts`: the derived posting key must be an authorized posting key of the author at the desk's own endpoint, else a typed, named refusal — nothing signed, no fallback) → `authorized` → **`handoff` persisted before the ask** (a lost answer is UNKNOWN, reconciled from the chain, never blind-retried) → build the transaction against the desk's RPC → one press inside `keys.skaists.dev` → **independent verification here** (the 130-hex signature is checked against the drop's own digest and the returned STM key with the estate's own `bnr-sign.js`; the txid must equal the digest of exactly this transaction) → the signed transaction persists (`signed` stage — a restart re-broadcasts without any key) → broadcast through the desk's one named endpoint → chain confirmation. Issue #405's five requirements are each implemented: (1) the structured op plus scope is shown in the keychain's own consent surface before the in-frame press; (2) the response is the preferred form — signature + txid + public key, and the desk broadcasts through its own RPC; (3) refusals are typed, and the desk persists `handoff` before calling and reconciles unknowns from the chain; (4) no key material crosses the boundary either way and scope never expands silently; (5) a fresh session signs with zero paste and no extension — proven in the eternal suite.

**What is still true and needed for the live drop:** the derived posting key must be authorized **once on-chain** for the publishing account (one `account_update` under an existing active key, a founder-gesture-sized step) — until then the desk refuses by name, which is the no-silent-fallback law doing its job. The extension door and the paste door remain, unchanged in behavior.

## Deliverable 2 — host/domain loss survived, with a disposable identity (the receipt's open items, closed)

Mechanism: a passkey's PRF output derives the root **only where that passkey was born**, so re-enrollment at a replacement origin does not re-derive — it **seals**: the root is wrapped AES-256-GCM under a key domain-separated from the new passkey's PRF output (`sha256(prf‖"bdid/wrap/v1")` fed through the same HKDF extract), and only the seal is stored (`kc.wrapped.v1` = `{v, at, did, iv, ct}`, 48-byte ciphertext = the 32-byte root + its 16-byte GCM tag). Unlock unwraps and **checks it reconstitutes the stored DID** — an identity can never silently change under a seal. Born-here keychains at `keys.skaists.dev` keep their direct derivation: nothing about the deployed unlock path changed, and a seal is written only by the explicit re-enroll gesture.

The gesture also emits the **succession record**: `{v, what, did, to_origin, passkey_rp, at}` signed by the identity's own r0 rotation key, riding with the public genesis and the r0 public key. Anyone can verify the succession from public material: `didOf(genesis) === did` binds the record to the identity, and the r0 signature authenticates the new origin.

A replacement origin exists **only as a build**: `node scripts/build-keychain.mjs --out DIR --origin URL [--parent URL]` rewrites the one marked `KC-ORIGINS` line in the **built copy** (and writes no CNAME). The source line stays pinned to production; no runtime override exists anywhere to abuse, so nothing at `keys.skaists.dev` was weakened to make another origin work. The framed-copy and parent checks in the replacement build refuse exactly as the production one does.

**Proof (`e2e/keychain-succession.mjs`, all green, TESTNET-ONLY disposable identity, nothing funded):** born at `keys.skaists.dev` (passkey+PRF) → that origin **aborted** (unreachable, proven) → the site **built** for `https://replacement.example` → a **second browser with a second authenticator** (an independent client that has never seen the identity) recovers the **same DID and the same Arbitrum account** from the recovery code alone → re-enrolls a passkey for the replacement origin → the succession record verifies **from the recovery code** (the r0 key the code derives is the key the record names, and the signature checks) → Lock → **unlock with the replacement passkey alone** reopens the same identity → storage audit: the seal only — no root, no 64-hex secret, no recovery-code material.

**The host-replacement procedure (now real, was open in the receipt):**
1. Build for the new origin: `node scripts/build-keychain.mjs --out DIR --origin https://<new-origin> --parent https://skaists.dev` (omit `--parent` for a standalone keychain).
2. Host those bytes at the new origin (any host; the bytes are the identity's only home — rebuilds are reproducible).
3. Open the keychain there → "Open with a recovery code" → the same identity returns.
4. "New origin, or lost passkey? Re-enroll here" → a passkey for the new origin now opens the same keychain; copy the succession record.
5. Wallet side: point `ORIGIN` in `surfaces/keychain-client.js` at the new origin and deploy the page — consuming lanes verify the succession record against the public genesis before trusting the new origin.
6. The old origin needs no cooperation: it is already gone; nothing there can weaken the recovered keychain.

## Evidence

| | Status | Where |
|---|---|---|
| Hive door, decoded card, delayed press, 10 refusals, EVM path untouched | **GREEN** | `e2e/keychain-hive.mjs` (new) |
| Host-loss succession, end to end, independently verified | **GREEN** | `e2e/keychain-succession.mjs` (new) |
| Isolation laws, existing suite | **GREEN, unmodified assertions** | `e2e/keychain-isolation.mjs` (route table +2 assets) |
| Hosted purchase paid from the keychain | **GREEN, unmodified** | `e2e/keychain-wallet-purchase.mjs` (route table +2 assets) |
| bDroP lifecycle incl. the native door + authority-gate refusal | **GREEN** | `e2e/bdrop-eternal.test.mjs` (scenario 8, on Agent 30's corrected base) |
| CI wiring | both new scripts join the isolated-keychain job; eternal job already runs bdrop | `.github/workflows/tests.yml` |
| Vendor pins | `node scripts/build-keychain.mjs --check` (3 vendors, SRI) | CI line exists already |

All suites ran in this worktree on `83775b5ec` + this lane's changes; the eternal suite's full 72 assertions pass including all of Agent 30's corrected scenarios.

**Integration notes for Agent 30 (their corrected base, kept intact):** the native door was fitted into `#signer-native` (ships disabled in source, enabled only by the mount, never auto-selected — their law). Three of their eternal-suite details changed, each test-side: (1) the mock's `/mock` whitelist grew the two keys the native-door scenario drives (`accounts`, `lastBody` — the selective applier had silently ignored them); (2) the lost-callback step now waits for the real unknown report (`the handoff answer never arrived`) instead of a regex that also matched the handoff-stage disclosure prose — a ~3 ms race the base run won by luck and my page shifts exposed; (3) the desk's keychain-origin mount is hermetic everywhere: `keys.skaists.dev` is route-served from the tree in every scenario (never the live site, never a bare abort whose `ERR_CONNECTION_REFUSED` console line tripped the no-page-error assertions).

**Deployed-bytes receipt (this update, keys repo `beehive-nature/keys` main → Pages):** see the deployment section below — filled at push time.

## Handoffs

- **Agent 30 (bDroP):** the native door is delivered in your corrected structure — `#signer-native` enabled-on-mount, `handoff` before the ask, typed refusals, your never-auto-select law kept. The eternal scenario 8 drives the real interface. The desk is yours from here; the one live step before a real drop is authorizing the keychain's posting key on-chain for the publishing account (the desk names the exact key and the refusal tells the operator what to do).
- **agent20 (ANT purchasing):** the keychain you mount is updated at the same origin with the same ANT interface — nothing you call changed. Live purchase remains yours with the founder; the 100 ANT ceiling and the separate ETH budget are untouched in code, and neither ceiling authorizes spending.
- **Wallet lanes still on the in-page keychain (per the #404 receipt):** migration to the isolated keychain remains open and is not claimed here.

## Live ANT acceptance — not resumed by this seat, and why

The order allows resuming live acceptance "only under applicable authorization". The authorization chain is: agent20's lane owns the purchase; the founder owns the passkey press and the funding; the ceilings (100 ANT, separately authorized ETH) authorize nothing by themselves. This seat executed **no** payment, created **no** passkey outside a throwaway virtual authenticator, and funded nothing — the enrollment/funding/signing/payment/retrieval/durable-recovery lines stay separately evidenced by their owners. What this seat *did* do is keep every guard those gestures rely on green after the update.

## Remaining ownership recorded (archive gate)

- **Milestone delivered:** issue #405 closed by construction (native Hive signing through the isolated keychain, desk door + regressions), and the deployment receipt's three open recovery items closed with a proof.
- **Remaining, with owners:** live ANT purchase → agent20 + founder. bDroP surface → Agent 30 (this door included). Wallet-lane migrations off the in-page keychain → unassigned (the #404 receipt's "migrating the other wallet lanes"). Signed handover from the old soul + grants → unassigned, unchanged from #404's remaining list.
- **This seat archives after this dispatch lands**; the worktree branch carries everything.

## Deployment receipt (added at closeout, 2026-10-13)

| Item | Value |
|---|---|
| Source | beehive-nature/beehive-nature `f00b6e50c` (main after PR #407), built with `node scripts/build-keychain.mjs --out` |
| Site repository | beehive-nature/keys `66819d7bd3e2dea6b88bb6b15eb3d8d446ee48b8` (main), Pages build `built` at 2026-10-13T01:57:17Z |
| DNS / certificate / Pages settings | untouched — the completed HTTPS deployment was preserved; no DNS work was repeated |
| Live bytes | verified over HTTPS after the build: every row below matches the build output, the keys-repo blob, and the tested source (three-way) |

| File | SHA-256 (live = build = repo) |
|---|---|
| index.html | `78507a1d54ff6e73bce3d447e1ca95e76a0402ec4613614bd3913ef6333e9877` <!-- PUBLIC-CONSTANT: public asset digest --> |
| prelude.js | `5eb6736f0ada89ee8b05f0aa08a49d991e80c8744939365626dac3617326b965` <!-- PUBLIC-CONSTANT: public asset digest --> |
| keychain.js | `7a455cd914274b73fb548b977303c96d0f5f25f404b2ea2706c4e816c245186f` <!-- PUBLIC-CONSTANT: public asset digest --> |
| genesis.js | `109831fe9733e62b58ba56602bfeba517b00e5492bd7295b6f0266c7c8980b46` (unchanged from the 2026-10-12 receipt) <!-- PUBLIC-CONSTANT: public asset digest --> |
| vendor/bzdid-key.js | `0261df46896fa152c987b6c8b3f2dc4c17d4f744157096733817a343218056fe` (unchanged) <!-- PUBLIC-CONSTANT: public asset digest --> |
| vendor/bnr-sign.js | `33a4c646c79f966854cf2d5de8b29c340bc47825db39b6b4f7e395a1ae75c378` (unchanged) <!-- PUBLIC-CONSTANT: public asset digest --> |
| vendor/hive-tx.min.js | `593e23481c17ee5a3ab54932375f114fdaa2bd530a817486caf31fffc6a21255` <!-- PUBLIC-CONSTANT: public asset digest --> |


## CI narrative (for the record)

PR #407 ran four rounds: (1) red — the generated `surfaces/stack.html` needed regeneration after the bDroP surface change (cured in-branch, the generated-file rider law); (2) red — the inherited bDroP eternal flake surfaced twice, including on **main's own #406 merge run (`38322545384`) with none of this lane's code near the path**: the eternal job runs ~100 suites under CPU contention and the mid-handoff restart reconcile starved its 20s window — cured by widening that one wait to 45s (same invariant, calmer clock) and by making the desk's keychain-origin mount hermetic in every eternal scenario (an inert origin that answers the probe but never loads a keychain, so nothing heavy parses outside the scenario that drives the real door); (3) fully green at `9f5128526`; (4) fully green at the merge head `e59d41913` — **46 pass, 0 fail** — merged as `f00b6e50c`.
