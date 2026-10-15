# SPEC-RUSTEOSVM-1 — the BNR execution/settlement interface

Status: GENESIS 2026-10-13 (zCode seat, BNROSE-RUST-001 successor
increment "native wallet enforcement"; founder order of 2026-10-13).

## 0. What the name binds (and refuses)

**rustEOSvm** is the name of BNR's EXECUTION/SETTLEMENT INTERFACE: the
contract between an authorized operation and every backend that may
execute or settle it. It is an interface specification, not a virtual
machine implementation, and it claims no capability beyond what its
components' evidence earns.

The name deliberately does NOT denote the `AntelopeIO/eos-vm` library.
The EOS VM evaluation (EOSVM-WALLET-001, closed at `9273b95f7`) remains
comparison evidence with unresolved acceptance gaps; nothing in this
spec imports its experimental backend or reopens its investigations.

## 1. The two sides of the interface

| side | what it is | where it lives | status |
|---|---|---|---|
| **the off-chain Rust worker** | the bounded, untrusted executor: admission verdicts, state transitions, digest bindings over WB001 intents | `crates/bnrose-exec-core` (+`-wasm`, `-host`) | BUILT — battery, teeth, receipts in `docs/dispatches/2026-10-12-bnrose-rust-001.md` |
| **the Vaulta-deployed Wasm contract** | the on-chain counterpart that enforces the SAME operation semantics at a settlement surface | a future Vaulta contract | NOT BUILT — boundary stated; no claim |

The interface between them is the record formats both sides must agree
on, so an operation admitted off-chain can be settled on-chain without
translation drift:

```
operation identity   op_id  = SHA-256("bnrose-exec/op-id/1" || authority || envelope)
envelope standing    env_sha = SHA-256("bnrose-exec/env/1" || envelope)
authorized effect    effect_digest = SHA-256("bnrose-exec/effect/1" || op_id || env_sha)
state machine        Admitted→Reserved→Dispatched→{Completed|Failed|Unknown}
                     (Dispatched→LostResponse→Unknown; evidence→Completed{recovered})
receipt statement    "bnrose-exec/receipt/1" (Ed25519 over the terminal binding)
```

**The on-chain side must enforce, at minimum, what the off-chain core
already refuses to do without:** one operation per (authority, nonce); an
effect only for the digest dispatch bound; no completion of an
undispatched operation; UNKNOWN that never silently becomes a
replacement. A chain that cannot enforce those is not a rustEOSvm
settlement surface, whatever its VM.

## 2. Native wallet enforcement (this increment's scope)

The founder order of 2026-10-13, binding increments:

1. **One disposable test identity, one harmless native effect**: the
   deterministic fixture authority (seed derived from a public index —
   DISPOSABLE BY CONSTRUCTION, never a production key) authorizes one
   WB001 intent; the effect is the non-spending durable record the
   ledger already is.
2. **Stable operation identity, bounded authority, enforced replay
   protection**: `op_id` (deterministic in the committed bytes); scope =
   the policy the Admitted record binds; replay = (authority, nonce)
   uniqueness across ALL admissions plus ledger idempotency.
3. **The race**: two independent workers racing the same operation.
   Exactly one dispatch may land — the state machine plus the journal's
   single-writer admission make double dispatch structurally refused,
   and the killed first worker's unrecovered outcome resolves through
   ledger evidence with NO second effect, NO second authorization, NO
   manual record transfer.
4. **Durably acknowledged — the definition this spec fixes**:
   > An operation's recovery material is **durably acknowledged** when
   > the records through Dispatch (identity, scope, reservations,
   > progress) are fsync-complete on **two independent durable stores**
   > — distinct failure domains — BEFORE the effect door opens, and are
   > chain-verifiable independently on each. A hash commitment without
   > retrievable state does NOT satisfy this definition.
5. **Acknowledging-host failure**: replicas acknowledged → effect
   committed → one replica destroyed → the replacement recovers from the
   survivor alone, same outcome, still one effect.
6. **Adversarial matrix** (each row a battery test): failed-action
   rollback (pre-dispatch failure leaves no effect and no invented
   terminal), altered intent (post-admission envelope substitution
   refused by the standing hash), stale authority (clock past expiry at
   admission), corrupted recovery records (chain refusal, fail closed),
   duplicate submissions (the race), migration with outstanding
   operations (custody transfer carries UNKNOWN forward as UNKNOWN).

## 3. Evidence classes (kept separately, never blurred)

| class | what it is | this increment's standing |
|---|---|---|
| CLASSICAL | Ed25519, HMAC-SHA256, SHA-2 signatures/commitments | USED (receipts, chains) |
| PQ | ML-DSA/SLH-DSA and successors | NOT USED here — the estate's PQ lanes own those proofs; no PQ claim rides on this spec |
| FORMAL | Cryptol/SAW equivalence of the semantics | NOT STARTED — the WB001 codec proofs this core composes stand as earned; a Cryptol twin of the transition table is the named next beat |
| FIXTURE | deterministic, seeded, non-spending | ALL effects and identities here |
| LIVE-CHAIN | real chain state, real adapters | NOT USED here — Arbitrum/Hive adapters follow with destination-side enforcement named; live acceptance needs its own authorization |

## 4. Non-goals

No new wallet, identity system, cryptographic primitives, consensus
chain, production authority changes, or mainnet spending. The
Vaulta-deployed side, the Arbitrum/Hive adapters, and live-chain
evidence are separate increments with their own orders. DNS resolution
and verified launch belong to the integration lead's DNS-independence
effort (routing dispatch `2026-10-13-bnr-dns-independence-routing.md`)
— this spec consumes none of it and blocks none of it.
