# z2.profile RECEIPT — vending.html mapped as the canonical .a capability surface · 2026-09-13

**Seat:** z2.profile (renamed from z2.b per [#10 comment 5650176343](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5650176343); PR #70 title already updated by the founder; watchpay z2b lane untouched). **Source order:** [#10 comment 5650107791](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5650107791) + this session's order. **Read-only:** sources read at origin, public testnet/gateway reads only, nothing merged, nothing deployed, PR #70 untouched.

## 1 · the actual contract — verified live this session

`bnrapolltest` on **jungle4** (Vaulta community testnet), RPC `https://jungle4.greymass.com`, code hash `a0fe4fdc…` (SPEC-VENDING-2 §deploy-doors). Table reads (2026-09-13, this seat):

- **`rates`**: rail `vaulta`, basis **`0.6000 A`**, tithe_bp 1000, label "the b-meter basis + tithe, founder-word law (x402 rates shape)", updated 2026-09-04.
- **`tithe`**: **1000 bp (10%) → `kingbeelovis`** — THE TITHE, founder-word-only, shown as its own line, never buried.
- **`config`**: admin `bnrapolltest` · **max_certs 7776 (6⁵)** · certs_count **2** · spec `SPEC-VENDING-1` · initialized 1.
- **`certs`**: 2 rows — `vendingtest` / `vendingtest2`, both owner `bnrapolltest`, one member ed25519 key, template `bqueenbee-genesis-1`, tongue latvian, minted 2026-09-04. Row shape: name · owner · member_key · ar_id(43) · content_hash(64) · template · tongue · minted; pk = FNV-1a-64, **collision ⇒ refused, never hijacked** (§contract).
- **the account** (`get_account`): created 2026-08-29, not privileged, **single-key permission paths** — `active`+`board` share one key, `memo` a second, `owner` a third; every path threshold 1. Same custody truth as the .b desk: operator-trusted rehearsal keys, the founder's.
- **the poller**: mints are caught by walking `/v1/history/get_actions` (bounded ≤14 pages, stops at first empty) — the mint lands, the page follows it to irreversibility.

## 2 · the jungle4 rehearsal/testnet boundary — where every line sits

The boundary is **stated on the surface itself**, in four places: the source constant (`// TESTNET-ONLY jungle4 rehearsal seat`, `vending.html:368`), the plan screen ("jungle4 testnet A … **Testnet money, real law rows**" · "the machine writes your row on Vaulta (**jungle4 rehearsal today**)"), the footer ("rehearsal net"), and the rail label ("A · Vaulta — the **rehearsal rail**, live today"). Behind it (SPEC-VENDING-2 §deploy-doors): **Vaulta mainnet has no agent-held account and no deployment — the mainnet seat is a founder ceremony**; jungle4 is the rehearsal of record (mint + resurrection 11/11 re-run there 2026-09-04 after the founder's powerup gesture). Live-truth law: rate, tithe, certs, chain head and irreversibility are read at load — **nothing on the page is a stored snapshot** — and unreachable states render **n/m, never faked** (A→USD live from CoinGecko; the fallback is labeled "measured 2026-09-01").

## 3 · the Arweave receipts — re-verified live this session

The birth certificate (`agent-birth-certificate` v1) is on Arweave and matches the chain three ways: fetched `eiHVpo3lz…` (cert #2) over public HTTPS following the gateway's **302 to the per-tx subdomain** (`…arweave.net/<id>` — curl needs `-L`; browser fetch follows it), and the record's carried `hash.value` opens `fa0116afa2020a60cfca…` — byte-true against the chain row's `content_hash`. Record shape: the five answers + **the recipe** (layers arweave/autonomi · machine · `restand_steps`×5) + sha256 over canonical JSON (keys sorted at every level, `hash.value` removed). Ownership is **ed25519 member-key shaped**; the key road is Arweave GraphQL `Member-Key` tag search — the member's key alone finds the record and its whole mint history. Cost wording: "$0.00 · **Turbo free tier carries it today**" — honestly time-scoped. Memory layer: autonomi `a1-log v1`, owner-signed, and the **funded ANT write is custody-gated and never priced $0** (§memory — R3 law). Resurrection (11 gates, client-side, auto-runs on scroll) is the receipt the customer can run themselves.

## 4 · the x402 receipt — the machine that charges is itself metered

Section 5 audits **session 42** (one metered rehearsal session, every step a landed transaction) **in the customer's page**: record bytes from `surfaces/x402-session42.json`, engine `surfaces/x402-meter.js` — the same pure 9-check law the contract pins (`contracts/vending/tool/x402audit.mjs`), held to the tool by the **engine-parity CI gate** (tool and surface must agree byte-for-byte). Session/rate/nonce rows re-read live from the rehearsal chain when it answers; failure rests in a named state, never a fake verdict. The four laws the receipt demonstrates: credit only from **settled single-use nonces** (a settle burns its nonce even at zero) · charges clamp under a **ceiling signed once at open** · an unpaid session is **paused, never killed** · the **tithe audited as its own split**.

## 5 · wallet / card / PayPal wording — the exact truth map

The customer copy says "**Pay with your card, PayPal, or any wallet — one tap, no network switch**" (and the plan screen: "one tap in your wallet; nothing is charged, signed, or sent before this approval"). What actually exists on the surface today, per the code:

1. **Rail A — the rehearsal rail (armed)**: testnet A to `bnrapolltest`, **memo `vending:<canonical-name>` is the binding**, the poller watches for the mint. Testnet money only.
2. **USDC · Base and PYUSD · Ethereum/Arbitrum/Polygon/X Layer (held)**: EIP-681 one-tap links + injected-wallet path, **both gated on `PAY_SEAT` being named by the founder at the first paid mint** (SPEC-VENDING-2 §money; only the e2e harness may set a seat). Until then the door **HOLDS and says so** — "nothing was charged, nothing signed."
3. **Card / PayPal as processors: no integration exists anywhere on the surface.** The line is experience-copy for the one-tap stablecoin rails (PYUSD is PayPal-issued; USDC/PYUSD are the card-on-ramp shapes) — it is **not** a claim of a card processor or a PayPal checkout. **z2.sec flag:** this wording is the one place aspiration outruns mechanism on the page; it stays honest only while (a) the approve-gate precedes it, (b) the door-hold state names itself, and (c) PYUSD-on-Base stays refused (Paxos, read 2026-09-03 — ETH/ARB/POLYGON/X Layer only; on Base the door takes USDC).

## 6 · the profile-safe entry point (what z2.profile may build, next rider)

Profiles may expose **only a sourced capability card that deep-links out** to `https://skaists.dev/surfaces/vending.html` (external-link law: new tab, `rel=noopener` — tour.js already enforces at click time). Card acceptance shape: label **"mint an agent on the .a rail ↗"** · caption carries the boundary verbatim — **"jungle4 rehearsal today — testnet money, real law rows"** · **no price numbers** (they are live reads; a number on a profile rots) · **no payment wording imported** (the card/PayPal line belongs to vending's plan screen under its approve-gate) · **no mainnet/live-money implication** · three registers as on PR #70's cards. The separation law, restated for the profile band: **.a minting (vending, external) · .b registry check (kingbeelovis, in-page) · Silent Payments (unconfigured, display-only-when-it-lands) · ERC20i read (Base, in-page) · bnr:// resolver** — five rails, five cards, no shared chips, no cross-claims, no collapsed "pay" surface.

## carried / out of this slice

- Issue #10's wider ask — inventory of high-value surfaces by function, ranked shortlist ≤5 — belongs to the sprint/z2.arch slice, not this receipt.
- The dynasty/holder cards in PR #70 currently link `.a` to SPEC-A-NAMES-1 only; adding the vending deep-link per §6 is a **one-line rider on PR #70** — deliberately not done under this order's no-merge/no-deploy rule.

## source ledger (read 2026-09-13, this seat)

`surfaces/vending.html` (796 lines, read whole) · live jungle4 reads (rates/tithe/config/certs/get_account via jungle4.greymass.com) · live Arweave fetch of cert `eiHVpo3lz…` (hash matched) · `docs/specs/SPEC-VENDING-1.md` + `SPEC-VENDING-2.md` (§contract · §deploy-doors · §memory · §money · §sizing · §fence · §what-the-receipt-proves) · `surfaces/x402-meter.js` + `x402-session42.json` (presence + wiring; the parity CI gate covers the engine) · issue #10 comments 5650107791 + 5650176343.
