# CDK INTERFACE DEEP READ — the smallest replaceable Cashu adapter + the capability-drift attack · 2026-09-16

**Order (founder, verbatim):** *"Deep-read Rust CDK's actual wallet/mint
interfaces for NUT-10/11 enforcement and NUT-24 transport. Determine the
smallest replaceable Cashu adapter bPay would need if we ever enable offline
bearer payments—without building it. Specifically verify whether CDK lets us
enforce: NUT-06 support → NUT-10 conditions → mandatory refund path → bPay
issuance-time cap → redemption-time verification fail-closed. Then attack the
failure case: mint capability changes after bearer issuance. An already-issued
note must never silently lose its originally authorized condition semantics.
No integration. Roll forward automatically."* **Mode:** CDK source read via
GitHub API + raw fetches at `main`; zero local clone, zero build, zero
integration. **Branch** `zcode/cdk-adapter-deepread-2026-09-16` (cut
`65763dc2`), worktree `../wt-zcode-eddies`. **Companions:** the NUT-10/24
spec deep read (`2026-09-16-nut10-cdk-deepread-x402-crosswalk.md`) — this
roll goes one layer down, into the Rust.

## 0 · Findings, one screen

| question | answer |
|---|---|
| Does CDK implement the fail-closed chain? | **4 of 5 links exist; the mandatory-refund link and the NUT-06 gate are POLICY GAPS CDK leaves to the caller** — both are small wrapper rules, hence "smallest adapter" is genuinely small |
| NUT-24 transport in CDK? | **NO MODULE FOUND** — no `nut24` path anywhere in the workspace at `main` despite the README's ✔; NUT-18 (`payment_request.rs` + `transport.rs`) exists; the X-Cashu/402 codec would be OUR thin code |
| Smallest replaceable adapter | `cashu` crate (types+wallet+enforcement) + `cdk-http-client` + one store (`cdk-sqlite`/`redb`) + self-hosted `cdk-mintd` as swappable infra; our code = 4 gates (below), plugging the existing `Door`/`FacilitatorSettle` seam |
| The capability-drift attack | **client-side prevention is impossible against a mutable mint** — Cashu offers DETECTION (NUT-06/07, DLEQ), never PREVENTION; the founder's law survives only as: version-pinned self-hosted mint + receipt-anchored capability snapshot + bounded exposure as backstop |

## 1 · What CDK actually implements (exact identifiers, at `main`)

Workspace: 23 crates — `cashu` (core: nuts, dhke, wallet+mint logic),
`cdk-common`, `cdk-http-client` (transport), `cdk-mintd` (daemon),
`cdk-mint-rpc`, `cdk-axum`, stores (`cdk-sqlite`, `cdk-redb`,
`cdk-postgres`), `cdk-ffi`, `cdk-nostr`, LN backends, `cdk-fake-wallet`.

**NUT-10 authoring** (`cashu/src/nuts/nut10/spending_conditions.rs`):
`SpendingConditions::{P2PKConditions{data: PublicKey, conditions:
Option<Conditions>}, HTLCConditions{…}}`; `Conditions{locktime:
Option<u64>, pubkeys, refund_keys, num_sigs, num_sigs_refund, sig_flag:
SigFlag}`. The doc-commented door: `TryFrom<SpendingConditions> for Secret`
is *"the only door from an author-supplied lock to wire bytes"* and calls
`conditions.validate()` first. `validate` catches `ZeroSignaturesRequired`,
`ImpossibleMultisigConfiguration`, `ImpossibleRefundMultisigConfiguration`,
`DuplicatePubkey` (x-coordinate compare, incl. 02/03 parity collisions).
**The asymmetry (law-worthy):** authoring strictness lives in
`Conditions::new` — `LocktimeInPast` refused, `RefundKeysRequireLocktime`
refused — but *"Only `Conditions::new` refuses it; wire conversion still
allows it"*: tokens RECEIVED off-wire skip the authoring door. Our wrapper
must re-validate received secrets, not just authored ones.

**NUT-11 enforcement** (`cashu/src/nuts/nut11/mod.rs`):
`P2PKWitness{signatures: Vec<String>}`; `Proof::verify_p2pk` enforcement
order: parse `Nut10Secret` → build `Conditions` (fail →
`SpendConditionsNotMet`) → SIG_ALL routed to `verify_full_sig_all_check`
(else `SigAllNotSupportedHere`) → `get_pubkeys_and_required_sigs(…,
unix_time())` → primary path (data+pubkeys, "ALWAYS available", even after
locktime) → refund path only if `requirements.refund_path` is Some — and
**`required_sigs == 0` on the refund path returns Ok: anyone-can-spend after
locktime, implemented, not hypothetical**. `valid_signatures` counts each
pubkey once (HashSet of x-only keys; `DuplicateSignature` on re-verification).
Full error enum extracted (18 variants) — the enforcement surface is real
and typed.

**NUT-06 discovery** (`nut06.rs`): `MintInfo{…, nuts: Nuts}` with
`SupportedSettings{supported: bool}` under keys `"7"/"8"/"9"/"10"/"11"/
"12"/"14"/"20"` — checked as `nuts.nut11.supported`; plus `motd`, `time`,
`MintVersion{name, version}` ("Nutshell/0.15.3"-shaped). The types are
complete; **no automatic client-side gate was found that refuses to hold
condition-carrying proofs against a mint whose flags dropped — that check is
ours to run.**

**NUT-07 state** (`nut07.rs`): `CheckStateRequest{ys}` → `ProofState{y,
state, witness}` with `State::{Spent, Unspent, Pending, Reserved,
PendingSpent}` — per-proof spend state only. **It reports nothing about
condition semantics.**

**NUT-24:** absent. No `nut24` module in `cashu/src/nuts` (nut23 and nut25
present), none in `cdk-http-client`/`cdk-axum`/`cdk-cli` listings.
**CITATION LAW: CDK's README claims NUT-24; no implementation found at
`main` — treat as unimplemented until shown otherwise.** The X-Cashu
header codec (~per spec: 402 + `creqA/creqB` in `X-Cashu`, retry with
`cashuB`, `{a,u,m,nut10}`) would be a thin adapter-owned file.

## 2 · The fail-closed chain, link by link

| link | in CDK? | what our adapter adds |
|---|---|---|
| NUT-06 support declared | types ✔, auto-gate ✖ | assert `nut10 && nut11 && nut12` supported BEFORE minting condition-carrying proofs; re-assert before any spend/accept |
| NUT-10 conditions authored | ✔ (`SpendingConditions` + the validate-doored Secret conversion) | nothing — use the door, never hand-build secrets |
| mandatory refund path | ✖ (`validate` does not require refund_keys when locktime is set; `Conditions::new` only refuses the inverse — refund WITHOUT locktime) | **wrapper rule: locktime set ⇒ refund_keys non-empty ⇒ num_sigs_refund ≥ 1** — closes the CDK-verified `required_sigs == 0` anyone-can-spend refund path and the spec's expired-lock-no-refund booby trap in one check |
| bPay issuance-time cap | ✖ (no notion — correctly, per the projection law) | the projection itself: member policy (per-signature/cumulative caps, `DEFAULT_PER_SIGNATURE_CAP_ATOMIC`-class) → `data`=agent key, `locktime`=policy window, `refund_keys`=owner keys, amount = capped budget; authority STAYS at signing |
| redemption-time verification | ✔ (`verify_p2pk`/`verify_sig_all_p2pk`/`enforce_sig_flag`, typed errors) | treat every non-Ok as fail-closed refuse; re-validate RECEIVED secrets through the same wrapper (the authoring-vs-wire asymmetry) |

**Verdict: the chain is enforceable, but only as OUR wrapper around CDK's
parts — CDK supplies the machinery and leaves the policy to the caller. That
is exactly what "smallest replaceable adapter" means: four gates, no
fork.**

## 3 · The attack: mint capability changes after issuance

**The note side is safe by construction:** conditions are committed into
`Proof.secret` at issuance and blind-signed — the bytes cannot silently
change. **The enforcement side is runtime behavior of the mint**, and that
is where the attack lands:

1. **Enforcement drop** — mint flips `nuts.nut11.supported`, or upgrades to
   laxer `verify_p2pk` behavior (e.g., accepting the `required_sigs == 0`
   refund path): already-issued proofs still carry conditions but become
   anyone-can-spend with **zero on-note evidence of the change**.
2. **Keyset retirement** (NUT-02) — proofs under keyset X become
   unredeemable: a HARD loss (loud), not a silent semantic change.
3. **What Cashu gives us: detection only.** NUT-06 re-fetch (flags, `motd`,
   `MintVersion`), NUT-07 state, NUT-12 DLEQ on signatures — none of these
   prove the mint still ENFORCES what it declares. `supported: true` is a
   claim, not a proof — the same "lying manifests" family as the bPay spec
   rolls' CD-4.

**The founder's law — "an already-issued note must never silently lose its
originally authorized condition semantics" — cannot be guaranteed
client-side against a mutable mint. It can be guaranteed three ways, all
ours:**
- **Version-pinned enforcement surface:** the self-hosted `cdk-mintd`
  binary+config under OUR deploy authority — capability change requires our
  redeploy (the same law as our door binaries; this is why `cdk-mintd` is
  "replaceable adapter, never required infrastructure" inverted: it is
  required to be OURS if condition semantics matter).
- **Receipt-anchored capability snapshot:** at issuance the adapter records
  (mint URL, NUT-06 snapshot, MintVersion, keyset ids, CDK enforcement
  facts) alongside the bPay receipt — drift becomes a DETECTABLE,
  evidence-backed breach rather than silence; a drift-watch re-fetch diffs
  against the snapshot and refuses new spends on mismatch.
- **Bounded exposure as the backstop:** issuance caps mean the worst-case
  silent loss is the cap — the $1/24h philosophy applied to bearer windows.

## 4 · The smallest replaceable adapter (definition only — nothing built)

Crates: `cashu` (core types, wallet logic, enforcement), `cdk-http-client`
(transport), one local store (`cdk-sqlite` or `cdk-redb`);
`cdk-mintd` self-hosted and swappable behind the adapter API. Our code, four
gates at the existing `Door`/`FacilitatorSettle` seam: (G1) issuance gate —
NUT-06 assert + refund-mandatory wrapper + cap→condition projection +
capability-snapshot receipt anchor; (G2) redemption gate — wrapper-validated
verify_p2pk outcome + NUT-07 state + fail-closed on anything non-Ok;
(G3) transport codec — the NUT-24 X-Cashu header pair (ours, per §1's
absence finding); (G4) drift watch — NUT-06+keyset diff vs the anchored
snapshot, refuse on drift. Classes: **ADAPT** (unchanged, now with precise
gaps), **WRAP** (the four gates wrap CDK — declared, not built), **WATCH**
(CDK ALPHA: the authoring-vs-wire asymmetry and refund-path semantics could
move under us), **BUILD-if-ever**: G1's refund rule + G4's snapshot law are
genuinely ours — no open implementation carries them.

## 5 · Laws banked this roll

1. **`supported: true` is a claim, not a proof** — enforcement is runtime
   behavior; pin it (self-hosted + version) or bound it (caps).
2. **Authoring doors don't cover received tokens** — wire-path secrets skip
   `Conditions::new`; re-validate what you receive, not just what you build.
3. **CDK's refund path implements anyone-can-spend at `required_sigs == 0`**
   — locktime ⇒ refund_keys ⇒ num_sigs_refund ≥ 1, always.
4. **CDK NUT-24: claimed in README, absent at `main`** — cite as
   unimplemented until shown otherwise.

## Landing receipt

Queue item #4 updated. Sources: GitHub API listings + raw fetches of
`spending_conditions.rs`, `nut11/mod.rs`, `nut06.rs`, `nut07.rs`, nut/nut18
listings at `main`. §7 seat shape, four pre-push checks, pushed branch +
main. Zero integration; nothing built; rolling forward hot.
