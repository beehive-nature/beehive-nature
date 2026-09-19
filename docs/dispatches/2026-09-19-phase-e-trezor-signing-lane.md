# PHASE E — the Trezor signing lane: organ built, UI mock-proven, and the authorization discrepancy reported

**Seat:** zCode (bPay/bData UI). **Date:** 2026-09-19. **Branch:**
`zcode/bdata-phase-e-2026-09-19`, cut from the exact pin `77ceb896` (Phase C
merge, PR #127). Phase E ENDS AT A VERIFIED SIGNATURE — no broadcast, no pay,
no upload, no finalize, no Autonomi pointer; refusal/cancellation returns
honestly without settlement.

## THE DISCREPANCY (first act, read-only verification — STOP and report)

The founder reported the live authorization ceremony already exercised. The
machine disagrees, and the report is twofold:

1. **ZERO authorization records exist.** Live bridge (127.0.0.1:8807, state
   dir `C:\Users\travi\bridge-state-bpay-ui`): `GET /v1/authorization` →
   `[]`. No `authorizations.json` in either bridge state dir; a
   filesystem-wide grep for the record schema string
   (`antd-bridge.authorization`) across family-lineage, both state dirs,
   Desktop/Documents/Downloads finds ONLY the bridge's own source file. The
   press did not land (or landed somewhere this machine cannot see).
2. **The banked quote lineage is stale regardless.** The Phase-C banked job
   `up-1789780618488` (founder2, 4.0662581103515625 ANT, commitment
   `sha256:ef803a7d…`) is **abandoned — "superseded by force_fresh
   re-quote"**. Five newer prepares ran 2026-09-18 21:08–21:14
   (`up-1789787295877` … `up-1789787660895`); the newest OPEN jobs quote
   **4.2170285654296875 ANT** — a fifth price observation. Under the
   no-silent-requote wall, even a hypothetical authorization against
   founder2's quotes is void by construction.

**Nothing was manufactured, repaired, or re-pressed.** Per the dispatch
order the signing lane REFUSES in exactly this state (LAW 1 — and the UI
renders the refusal as a law; mock-proven B1/B2). **The founder's next
gestures:** refresh the price in My Data, review, and press "I authorize
this" against the CURRENT job — that press is the founder's alone.

## THE PAYMENT-SHAPE QUESTION — answered at source

**Exactly 2 transactions = 2 device signatures** for the current job shape:
1. ERC-20 `approve(vault, exact ANT total)` on the ANT token
   `0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684` (read from the INSTALLED
   client's own constant, evmlib 0.9.1 `src/lib.rs`).
2. `payForQuotes((address,uint256,bytes32)[])` carrying ALL 56 payments on
   the vault `0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26`, Arbitrum One.

Evidence: evmlib 0.9.1 `external_signer.rs::pay_for_quotes_calldata` chunks
payments at `MAX_TRANSFERS_PER_TRANSACTION = 256`; 56 ≤ 256 → one call;
ant-core 0.9.0's own doc: "Pay for multiple chunks in a single EVM
transaction"; the bridge's finalize map (`QuoteHash → TxHash`) accepts one
tx hash covering many quotes. **"56 chosen quote payments" ≠ 56
transactions** — the SPEC's "one confirmation per quote" warning described
an older client era; the current external-signer path batches. Wave (not
merkle) is forced by the client for 56 chunks (< `DEFAULT_MERKLE_THRESHOLD`,
`should_use_merkle` in ant-core `merkle.rs`). No 57-prompt hazard exists;
the count law (1 + ceil(n/256)) rides the sealed plan and the UI review
states it BEFORE device interaction.

## THE SAFE 7 TRANSPORT — classified, ladder evidence-ranked

| capability | class | evidence |
|---|---|---|
| Offline verification organ (compose→wall→recover) | **EXISTING** (z2.c, merkle-shaped) → **extended to wave this lane** | connect.rs + signed_tx.rs + eth.rs, 107 tests preserved |
| Wave `payForQuotes` composer | **ABSENT → BUILT** (`wave.rs`), selector `0xb6c2141b` golden-pinned, ABI tuple order (rewards, amount, quoteHash) handled where the bridge order differs | tests `pay_for_quotes_*` |
| Browser Trezor Connect | **DEFUNCT for Safe 7** | THP matrix §2 (no THP lane in 9.7.3 web; the founder's pair-prompt wall) — bantfarm's signing wing cannot drive this device |
| v1 bridge/USB | **EXISTING but INCAPABLE of signing** | btrezor measured `Failure_InvalidProtocol` on the safe7 emulator (2026-07-30); trezord v1-only; Suite 26.9.2's bridge in-process (21325 down at last probe) |
| **Suite 26.9.2 experimental MCP** | **PRESENT in the installed build, founder-gated** | asar carries `TR_EXPERIMENTAL_MCP_SERVER`; z2.a review verified `trezor_send_transaction` carries data/chainId/fees and invokes `ethereumSignTransaction` at source. Suite as INFRASTRUCTURE UNDERNEATH is lawful per this dispatch; bData stays the cockpit |
| Rust THP host | **ABSENT (mapped)** — port `rust/trezor-thp` (firmware checkout); the estate-native path if v1/MCP cannot sign | THP matrix §4 |

No transport claim is made from source alone: the harmless preflight
(device → transport → model → path → address → confirm/reject → verify →
zero broadcast) is the founder-operated step that earns the device receipt;
the runbook (`ops/bpay-sign/README.md`) stages it.

## WHAT LANDED (all mock-proven / offline — the device steps await the founder)

**The wave organ — `crates/watchpay/src/wave.rs`** (the reviewed wave slice
the crate's scope law demanded):
- `bind_authorization` — **15 named LAWS** before any device dispatch:
  missing/cancelled/consumed authorization; job missing/abandoned; stale
  lineage (newer open sibling); artifact identity; audience; wave-only;
  payment-set bounds; **the no-silent-requote wall recomputed here** (sha256
  over sorted newline-joined quote hashes — byte-identical to the bridge's
  derivation, never trusting the stored digest); three-way EXACT ANT
  obligation (ceiling == job total == payment sum, never above); separate
  gas; invoice digest; chain/token/vault pinned to the installed client's
  Arbitrum One constants; payer bound; transaction count computed at seal.
- `pay_for_quotes_calldata` — exact ABI layout (`4 + 64 + 96·N`), bounded
  (empty and >256 refused), selector golden-pinned; `approve` reuses the
  bounded E7 composer (never unlimited).
- `verify_wave_signed` — the z2.c nine-step wall wave-bound: strict decode,
  family law (1559-only), every field == request (named refusals),
  response↔envelope components, nonzero scalars, low-s, **recovered signer
  must equal the sealed payer**, locally computed hash.
- `WaveLedger`/`WaveSignReceipt` — exactly ONE receipt per authorization
  (`bpay.sign-receipt/1`, `broadcast:false paid:false uploaded:false
  finalized:false`), append-only events, duplicate-slot replay refused,
  restart-never-resigns (first-intent overwrite refused), explicit cancel
  law, nonsecret fields only.
- `sign_wave_slot` driver — intent first, ONE transport call, verify,
  record; no automatic retry; after-dispatch uncertainty stays explicit.

**The bData signing step (one concept, one press, hard stop):** SIGN WITH
TREZOR behind the completed authorization → review IN PLACE (artifact,
audience + origin, invoice lineage, job/quote count, exact ANT ceiling,
SEPARATE gas, contracts + chain, payer-at-preflight, **"2 transactions
expected — 1 ERC-20 approve + 1 payForQuotes carrying all quotes"**) with
**SIGNING DOES NOT BROADCAST OR PAY** prominent → one press → SIGNED (both
slot hashes, verified signer) with **NOT BROADCAST · NOT PAID · NOT
UPLOADED** and NO further affordance (broadcast is locked, not hidden).

**The staged service contract** (`bpay-sign`, default :8808) is frozen in
the runbook; the UI already speaks it.

## EVIDENCE (RED → GREEN)

- **cargo: 149/149** `-p watchpay --offline` (the 107 preserved z2.b/z2.c
  tests + the wave slice; fmt clean; clippy zero new warnings — remaining
  `ledger.rs` warnings pre-existing).
- **RED receipts (mutations, all restored):** LAW 9 wall disabled →
  `law9_no_silent_requote_wall_refuses_changed_quote_set` FAILS (0/1); wall
  recovery check disabled → `wall_refuses_field_mutations` FAILS; UI count
  line mutated → Phase E gate A2 FAILS (1/23). All restored to GREEN.
- **e2e `bdata-phase-e.mjs`: 23/23 GREEN** — full ceremony (A1–A16), LAW 1
  refusal renders as today's live state (B1–B4), device rejection explicit
  with exactly ONE dispatch and no retry (C1–C4); zero page errors; zero
  broadcast routes.
- **Family:** Phase C 42/42, Phase B 15/15, Phase A 18/18, ownership test,
  CI-shape lint (70/70 guarded), shell-chain lint — all green.
- **CI:** the Phase E gate is wired beside the bData gate in tests.yml.

## BOUNDARY NOT CROSSED

No payment. No broadcast. No upload/finalize. No Autonomi pointer. No
authorization record created, repeated, superseded, or "repaired" (the
machine's zero-record state stands). No Trezor session opened, no device
claim made from source. The bridge (family-lineage) was never modified, and
its running instance was never restarted.

## What remains (founder-gated)

1. Refresh + re-authorize against a CURRENT job (the founder's press).
2. Build `bpay-sign` on the frozen contract (bind → compose → transport →
   verify → persist; v1 transport expected to fail app messages honestly).
3. Run the harmless Safe 7 preflight; record the transport that worked
   (Suite experimental MCP is the live candidate — founder enables it; THP
   Rust port is the estate-native fallback).
4. Then — and only then — the real 2-signature ceremony, ending at SIGNED.
