# SPEC-COINBASE-SMART-WALLET-COMPAT-1 — Base-facing surfaces, audited

**Status: REFERENCE.** Founder direction, 2026-08-29, verbatim: *"fully
compatible as possible… especially for all the erc20i stuff."* Read-back
done first, cited; audit done second, with grep evidence; fixes applied
where a live gap existed, documented where none did.

---

## 1 · SIGNATURES — ERC-1271 / ERC-6492

### Read-back (cited)

- **ERC-1271** defines `isValidSignature(bytes32 hash, bytes signature) →
  bytes4`, returning the magic value `0x1626ba7e` on success or
  `0xffffffff` on failure — the contract-wallet equivalent of `ecrecover`.
  A caller that does `ecrecover(hash, v, r, s) == expectedAddress` will
  **always fail** against a smart account, because a smart account has no
  single ECDSA key to recover against at all.
- **Coinbase's own implementation is a further wrinkle, not a plain
  pass-through.** From `coinbase/smart-wallet/src/ERC1271.sol` (fetched
  2026-08-29): `isValidSignature` does not check the input hash directly —
  it wraps it in a `replaySafeHash()` transform first: an EIP-712 envelope
  whose domain separator carries the contract's own address and chain id,
  encoded as a `CoinbaseSmartWalletMessage` struct. **This means even a
  caller that correctly calls `isValidSignature` instead of `ecrecover`
  will still get it wrong if it hand-builds the hash** — the wallet is
  validating a wrapped hash, not the raw one.
- **Counterfactual (undeployed) accounts are a second, separate trap.**
  Base Account (Coinbase Smart Wallet) addresses exist and can receive
  funds before the account contract is actually deployed on-chain — so
  `isValidSignature` may be calling a contract that doesn't exist yet.
  **ERC-6492** is the wrapper standard Smart Wallet adopted to solve this:
  Base's own docs (per a WebSearch summary of
  `docs.base.org/smart-wallet/concepts/usage-details/signature-verification`,
  the live page render kept collapsing to the SDK's landing shell so this
  citation rests on the search-engine's summary of that page, not a raw
  fetch) recommend an ERC-6492-aware library for off-chain verification —
  **viem's `verifyMessage` and `verifyTypedData`** are named explicitly —
  rather than hand-rolled `ecrecover` or a bare `isValidSignature` call.

### Audit — market / museum / inquire flows, and the wallet's Base rails

Grepped the tree for every naked-ECDSA signature-verification pattern
(`signMessage`, `signTypedData`, `verifyMessage`, `personal_sign`,
`isValidSignature`, `SignatureVerif`) across `surfaces/`, `docs/`,
`crates/`. Findings:

- **`surfaces/blight/market.html`'s inquire flow does not sign anything
  today.** Its own text says so: `"front-end MVP... the signature waits
  for the audited escrow."` (`market.html:93,184`). The "confirm" button is
  a stub (`this.textContent='⏳ docking… the escrow contract is the last
  piece'`). **There is no live bug to fix — there is nothing to audit yet.**
- **`surfaces/museum.html` verifies no signatures anywhere** — every read
  is a public `eth_call` (balance, `getSvg`), never a user-supplied
  signature.
- The only `SignatureVerifier` trait and `personal_sign` reference in the
  whole tree are in `crates/reputation-engine/src/lib.rs` and
  `crates/bindexer/tests/keyless.rs` — **neither is Base-facing**; both
  belong to the bzDiD/Vaulta identity rail, a different chain with its own
  key model, out of this item's scope.
- `surfaces/wallet.html`'s `walletAction`/outbox/sign flow is **Vaulta
  (Antelope) only** — a different chain, a different signature scheme
  entirely (not ECDSA-over-secp256k1-the-Ethereum-way at all). Not
  Base-facing; not in scope for ERC-1271.

**Verdict: no fix-at-cause was possible or needed, because no cause exists
yet.** The estate has not shipped a single line of Base signature
verification. This is not a pass by omission — it's the honest state,
recorded so the FIRST signature-verification code the estate ever writes
(most likely: market's escrow "confirm" flow, or a future "prove you hold
this address" gate) starts from this document instead of rediscovering
ERC-6492 the hard way. **Binding guidance for that future code:** use an
ERC-6492-aware verification library (viem `verifyMessage`/`verifyTypedData`
client-side; an ERC-6492-aware on-chain or off-chain verifier
server-side) — never raw `ecrecover`, never a hand-built `isValidSignature`
hash.

---

## 2 · BATCHING — EIP-5792 `wallet_sendCalls`

### Read-back (cited, `eips.ethereum.org/EIPS/eip-5792`)

- `wallet_sendCalls` params: `{version, chainId, calls:[{to,data,value}],
  atomicRequired, from?, id?, capabilities?}`.
- `wallet_getCapabilities` — capability discovery **without a separate
  permission prompt**; call it before ever calling `wallet_sendCalls`.
- `wallet_getCallsStatus` — polls a submitted batch (`status`, `atomic`,
  `receipts[]`).
- **The spec's own fallback line, verbatim:** *"Apps MAY attempt to send
  the same batch of calls serially via `eth_sendTransaction`"* when the
  wallet doesn't support batching. *"Wallets that do not support the
  methods defined here SHOULD return error responses."*
- **Smart wallets support this; EOAs (MetaMask, Rabby, etc.) do not** —
  capability detection must run every time, never assumed from wallet name.

### What landed

`surfaces/wallet-batch.js` — a shared helper, same pattern as
`level-truth.js`: one module, reusable by every Base-facing surface.

- `getCapabilities(provider, address, chainIdHex)` — calls
  `wallet_getCapabilities`, returns `null` (never throws) on any error so a
  caller never has to special-case an unrecognized wallet.
- `supportsBatching(...)` — true only when the wallet explicitly reports
  `atomic.status` as `'supported'` or `'ready'` on the target chain.
- `sendBatch(...)` — composes a correct `wallet_sendCalls` request
  (`version: '2.0.0'`, normalized `calls[]` with `value` defaulted to
  `'0x0'`).
- `sendSequential(...)` — the spec's own fallback, executed in call order,
  **stops and rethrows on the first failure** rather than silently
  continuing past a broken step in what was meant to be one approval.
- `sendCallsOrFallback(...)` — the one entry point: detects, then routes.

**14/14 selftests pass** (`node surfaces/wallet-batch.js --selftest`) —
pure-logic checks against a mock EIP-1193 provider: capability detection
(supported / ready / unsupported / no-response / throwing wallet), batch
request shape (call order, version, value defaulting), sequential fallback
(order preserved, one hash per call, stops on first failure).

**Not yet wired into a live UI, and that is stated plainly rather than
hidden.** No Base-facing surface currently composes more than one call per
user action:

- `surfaces/blight/midi.html`'s swap is a single `exactInputSingle` call —
  there is nothing to batch.
- The one-click Base desk (renewals, ordered in the prior nightshift's
  item 4) is **still parked** on a missing verified mainnet
  `RegistrarController` address — it has no calls to compose yet, so it has
  nothing to batch yet either.
- `surfaces/blight/market.html`'s buy flow doesn't sign at all (§1).

`wallet-batch.js` ships ready for the first surface that composes more
than one call per approval — most likely the one-click Base desk once its
missing address lands, or a future multi-buy on the ERC-20i market.

---

## 3 · CONNECT — EIP-1193, already compliant

Audited every Base-facing surface's connect code
(`surfaces/blight/index.html`, `inscription-explorer.html`, `midi.html`,
`workbench.html`). All four already use the standard pattern:

- Silent `eth_accounts` check on page load (never prompts).
- `eth_requestAccounts` **only from a click handler** — confirmed by
  reading each call site; none fire on page-open.
- `window.ethereum.on('accountsChanged', ...)` for live updates, no polling.

**This is already Coinbase Smart Wallet compatible as written.** Coinbase
Smart Wallet (via the Base App's injected provider, or the Coinbase Wallet
browser extension) implements the same EIP-1193 `request()` interface as
any other injected wallet — there is no separate "smart wallet connect"
API a dapp needs to call. No code changed here; nothing was broken, so
nothing was "fixed."

**One documented, not-yet-actioned finding:** all four surfaces read
`window.ethereum` directly rather than using **EIP-6963** (multi-injected-
provider discovery). With more than one wallet extension installed,
`window.ethereum` may resolve to whichever extension last claimed the
global, which is not necessarily the user's intended wallet (including
Coinbase Smart Wallet, if another extension is also present). This is a
real UX gap but is **outside this item's literal ask** ("accept Coinbase
Smart Wallet via standard EIP-1193/Wallet SDK connect" — which
`window.ethereum` already satisfies when it IS the active provider) — logged
here rather than built speculatively across four files without a founder
call on whether EIP-6963 multi-wallet picker UI is wanted.

---

## 4 · ERC-20i FIRST — market/museum, quirks documented

Per order, ERC-20i surfaces (`market.html`, `museum.html`, the inscription
explorer) got the audit pass first — §1 and §3 above cover both directly.

### Quirks for the estate's own build, cited above, restated for this
### surface family specifically:

- **Paymaster / gas sponsorship.** Base Account supports app-sponsored gas
  via `wallet_sendCalls`'s `capabilities` field talking to a paymaster
  service; Coinbase's own CDP paymaster grants $15/month in free Base gas
  per app (source: WebSearch summary of Base's paymaster docs, 2026-08-29
  — not independently re-fetched from a raw page). **Relevant to a future
  ERC-20i buy flow:** if the estate ever wants a first-purchase-free-of-gas
  onboarding on the market, this is the mechanism — riding the same
  `wallet_sendCalls` capabilities field `wallet-batch.js` already composes,
  no separate integration needed.
- **Sub-accounts (ERC-7895).** App-scoped, embedded child accounts under a
  user's main Base Account, usable for zero-prompt repeat actions with an
  auto spend-permission ceiling (source: WebSearch summary of
  `blog.base.dev/subaccounts` and Base's sub-accounts doc). **Relevant if**
  the market ever wants "buy without a signature every time" — a
  sub-account with a spend cap is the standard mechanism, not a bespoke
  session-key system. **Not built** — no live flow needs it yet (§1, §2);
  recorded so the next builder doesn't reinvent it.
- **The seed/level arithmetic itself is chain-read-only** (`getSvg`,
  `balanceOf`) and carries no wallet-type dependency at all — Coinbase
  Smart Wallet, MetaMask, or no wallet connected at all all read the same
  numbers, because these are public calls, not signed ones. Nothing about
  ERC-20i's own mechanics (documented separately in
  `docs/SPEC-ERC20I-MECHANICS-1.md`) interacts with wallet type.

---

## Summary

| item | finding | action |
|---|---|---|
| 1 · ERC-1271/6492 | zero live signature verification exists Base-side; nothing to fix at cause | binding guidance recorded for the first code that adds it |
| 2 · EIP-5792 batching | zero live multi-call flows exist to batch | `wallet-batch.js` shipped, 14/14 selftests, ready to wire in |
| 3 · EIP-1193 connect | already compliant on all 4 audited surfaces | documented; EIP-6963 multi-wallet gap logged, not built |
| 4 · ERC-20i first | market/museum audited first per order | paymaster + sub-account mechanisms documented for future use |

No estate law violated: no auto-connect, no page-open network calls added,
nothing auto-signs, no key ever touched by this pass.

## COOP LAW — popup-hostile headers on wallet-facing surfaces (added 2026-08-29, live-caught)
**Caught in the act, not in theory:** clicking "create wallet" from a page launches `keys.coinbase.com` as a popup that must talk back via `window.opener`. If the serving page carries `Cross-Origin-Opener-Policy: same-origin`, the browser severs the opener and the popup refuses: *"This app doesn't support smart wallets — window.opener is inaccessible"* (keys.coinbase.com's own message, linking smartwallet.dev/guides/tips/popup-tips#cross-origin-opener-policy). Coinbase's own SDK also passes its COOP state in the connect URL (`&coop=undefined` observed live).
**The law:** any estate surface that hosts a Base/Coinbase wallet button must serve **`Cross-Origin-Opener-Policy: same-origin-allow-popups`** (or send no COOP header at all — verified today: GitHub Pages sends none, so our current surfaces are safe by omission). NEVER `same-origin` on a wallet-connect page.
**Verify command:** `curl -sI <surface-url> | grep -i cross-origin` — empty output = safe-by-omission; `same-origin-allow-popups` = safe-by-intent; `same-origin` = defect, fix at the serving layer (dev server config or Caddy header block) before the button ships.
**Standing practice (separate finding, same night):** wallet creation/signing ceremonies run in a FULL browser tab only — the in-app pane severs opener relationships structurally and fails the identity flow even with zero COOP headers (proven twice: SDK popup path AND base.app direct tab). Direct-tab navigation (`keys.coinbase.com` → now redirects to `base.app → Continue on Web`) avoids the SDK popup entirely — the CC route — but still needs a real browser + platform authenticator (a seat-behavior note about browser capability, not a constraint on the agents: bzCode's wallet ceremony ran start-to-finish from an agent seat 2026-08-29, the authenticator window being the one founder-hand step of the split ceremony).
