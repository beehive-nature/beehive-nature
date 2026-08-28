# SPEC-ADAPTER-CONTRACT-1

**Status:** DRAFT — founder-approved to write, not yet ruled
**Date:** 2026-08-28
**Owner:** wallet lane (zC by standing ruling)
**Supersedes:** nothing
**Related:** SPEC-SPEND-RECEIPT-1 · bDiD custody constitution · the four wallet laws (S28-0828)

---

## 0. Provenance

The shape of this contract was taken as a **PATTERN** from a raid on `TabularisDB/tabularis`
(Apache-2.0, a desktop SQL client). Nothing was copied. The harvested idea, in one line:

> Drivers are standalone executables. The core spawns one and speaks JSON-RPC 2.0
> over stdin/stdout. No shared libraries, no ABI, any language, crash isolation for free.

Isolation and error handling in §6 were sharpened by a second raid (`brenorb/granola`),
**pattern only — that repository carries no LICENSE file and none of its code may be read
for implementation or copied.**

---

## 1. THE LAW

**No rail is ever linked into the shell.**

Every rail — Vaulta, Arweave, Autonomi, Zano, ATProto, and every rail not yet named —
is reached through one adapter, behind one contract, across an isolation boundary.
The shell knows the contract. The shell does not know the rail.

Three properties fall out of this and they are the reason for the law:

1. **A rail can die without taking the estate with it.** An adapter fault is one dead
   process or one dead worker, not a broken wallet.
2. **A stranger can add a rail without touching the shell.** Any language, no build
   coupling, no permission required.
3. **A rail can be replaced without surgery.** Unplug, plug in, the shell never notices.

Property 2 is the reason this is a network-effect decision and not only an engineering one.

---

## 2. TWO CARRIERS, ONE CONTRACT

The estate runs in two environments and the transport differs. **The contract does not.**
Same method names, same capability declaration, same isolation guarantee, same errors.

| | **Browser carrier** | **Native carrier** |
|---|---|---|
| Where | `wallet.html` and every hosted surface | kernel-side, CLI, daemons |
| Isolation unit | one dedicated Web Worker per adapter | one child process per adapter |
| Transport | `postMessage` over a `MessagePort` | stdin/stdout |
| Framing | JSON-RPC 2.0 objects | JSON-RPC 2.0, newline-delimited |
| Fault containment | worker terminate + respawn | process exit + respawn |

**Do not attempt subprocesses in the browser carrier.** The harvested pattern's transport
is stdio; its *value* is the isolation boundary and the absence of ABI coupling, and a
dedicated worker delivers both in a page. Stating this here so no seat tries to port the
literal mechanism into a surface that cannot host it.

**Stack-law constraint (binding):** the estate ships single-file, zero-external-at-render.
Browser-carrier adapters are vendored into the repo with a pinned hash and proven to
actually work after vendoring — present-but-inert does not count (the inert `chart.js`
pin is the precedent).

---

## 3. THE CONTRACT

JSON-RPC 2.0. Every method below is optional except `describe`. An adapter implements
what it can and declares it; **the shell never assumes a capability it was not told about.**

### 3.1 Required

```
describe() -> {
  rail:            <Rail>,          // closed enum, §7
  adapter_version: string,          // semver of this adapter
  contract_version: "1",            // this spec
  capabilities:    [<Capability>],  // closed enum, §7
  networks:        [string],        // e.g. ["mainnet","jungle4"]
  units:           [string]         // e.g. ["A","AR","ANT"]
}
```

`describe` is called once at attach. Its answer is authoritative for the life of the
attachment. An adapter that later fails a capability it declared is a **defect**, not a
runtime condition.

### 3.2 Read capabilities

```
balance({ address, unit })          -> { unit, quantity }     // canonical integer string
receiveAddress({ index? })          -> { address, derivation_ref? }
status({ ref })                     -> { phase, evidence }    // see §5
```

### 3.3 Write capabilities

Write methods **build intent. They never sign and never broadcast.**

```
buildSend({ from, to, unit, quantity, memo? })    -> Intent
buildAction({ account, action, data, auth })      -> Intent   // Vaulta; replaces Unicove
buildPublish({ payload_hash, size, tags })        -> Intent   // Arweave anchor
```

```
Intent = {
  intent_id:      string,      // adapter-assigned, stable, idempotency key
  rail:           <Rail>,
  unsigned_bytes: string,      // base64; exactly what must be signed
  digest:         string,      // sha256 of unsigned_bytes
  expires_at:     string?,     // RFC3339, if the rail has expiry semantics
  human_summary:  string       // what the user is about to authorize, in words
}
```

### 3.4 Submit and confirm — deliberately two methods

```
submit({ intent_id, signed_bytes })  -> { ref, accepted_at }
confirm({ ref })                     -> { phase, evidence }
```

`submit` returns only that a rail *accepted* bytes. **It never returns a terminal state.**
Terminal state comes from `confirm`, which reads the rail back. See §5.

---

## 4. THE ADAPTER NEVER HOLDS KEYS

**Standing law, made mechanical here:** no adapter receives, requests, stores, derives,
or transmits private key material. Not once, not transiently, not "just to sign."

The flow is three parties and each holds exactly one thing:

```
  ADAPTER            VAULT              SHELL
  builds intent  →   signs digest   →   persists, submits, confirms
  knows the rail     holds the keys     owns the outbox and the receipt
  holds no keys      knows no rail      signs nothing
```

Consequences worth stating because they are load-bearing:

- A hostile or buggy adapter cannot spend. The worst it can do is propose an intent the
  user is shown in words and declines.
- This is the same seam the Autonomi finding landed on: the external-signer path is the
  only path that produces a bounded approval, and it is bounded *because* the keys are
  outside the process. Keyless and bounded are one property viewed twice.
- A third-party adapter therefore needs no trust review to be *safe*. It needs one to be
  *correct*.

### 4.1 Redaction wall (wallet law L1)

Every method above returns summaries: amounts, addresses, phases, public refs, digests.
**No method on this contract returns key material, seeds, or spendable bearer values —
there is no exception on the adapter contract.** The single dangerous
bearer-material method lives on the vault surface, is named so the danger is in the name,
and is not reachable through any adapter.

---

## 5. THE RECEIPT IS THE RAIL READ (wallet law L4)

`submit` returning cleanly means bytes were accepted. It does **not** mean the thing
happened. A shell that shows "sent" from a `submit` response is reporting a claim as a
fact.

```
phase ∈ { building, signed, submitted, confirmed, failed, expired }
```

- `submitted` may be set from a `submit` response.
- **`confirmed` may ONLY be set from a `confirm` call that read the rail back**, and
  `evidence` must name what was read.
- No UI may display a terminal or reassuring state from `submitted`.

This is one law appearing for the third time in the estate:

> never report SHIPPED from a git state — the receipt is the live URL
> never report GREEN from a self-selected suite — the receipt is the CI run
> **never report SENT from an ack — the receipt is the rail read**

---

## 6. FAULTS, RETRIES, AND THE OUTBOX (wallet law L3)

**The outbox belongs to the shell, not to the adapter.** One outbox, uniform retry
semantics, regardless of rail. An adapter that implements its own retry is a defect.

Order is fixed and is not an implementation preference:

```
build  →  sign  →  PERSIST THE SIGNED BYTES  →  submit
```

On no-acknowledgement, the shell resubmits **the identical stored bytes**. It never
re-signs and never builds a second intent. `intent_id` is the idempotency key on every
resubmission.

Rail-specific note (Vaulta): a signed Antelope transaction has a fixed id and an
expiration, and the chain rejects the duplicate — so replaying the same bytes is safe by
construction and **re-signing is the only unsafe path.** Adapters for rails without this
property must declare it in `describe` so the shell can bound retries differently.

**Fault containment.** An adapter that throws, hangs past its timeout, returns malformed
JSON-RPC, or exits is terminated and respawned. The shell marks only that adapter
unavailable. Every other rail keeps working. **A rail fault is never a wallet fault.**

Errors are JSON-RPC error objects with estate codes; an adapter must not return a
plain-language error string in place of a code, and must not return partial success.

---

## 7. CLOSED ENUMS, AND NO HOSTED REGISTRY

`Rail` and `Capability` are **closed enums**. An unlisted rail is added **by ruling**, not
by a caller passing a free string. Same discipline as `SPEC-SPEND-RECEIPT-1` and for the
same reason: a caller-supplied classification is not a classification.

**There is no hosted adapter registry, now or later.** The raided project routes driver
discovery through a hosted catalogue with accounts and download analytics — that is
precisely the custody-and-dependency class this estate replaces. Adapters are discovered
from the repo and from content-addressed paths. If a directory is ever wanted, it is a
published list, not a service anyone must reach.

---

## 8. SCOPE FENCE

This contract covers **flow execution under one bDiD** — one identity moving its own value
across its own rails. Per the custody constitution that is explicitly *not* cross-chain
atomicity, and it therefore requires **no hash-linked HTLC machinery, no counterparty
protocol, and no settlement coordination.**

A **counterparty swap** is a different object and sits on the bACCORD baton fence. It is
not in this contract and is not to be built into it without a founder ruling.

---

## 9. ACCEPTANCE CRITERIA

This spec is landed when all of the following are true and demonstrated:

1. `describe` is implemented by every attached adapter and the shell refuses to attach one
   that omits it.
2. A capability not declared in `describe` is **unreachable** from the shell — proven by a
   mutation: remove a capability from a `describe` response and assert the shell's call
   path is gone, not merely erroring.
3. No adapter method returns key material — proven by a mutation: make one method leak, and
   watch the gate go red.
4. A killed adapter mid-operation leaves every other rail functional — proven by killing a
   worker/process and asserting the other adapters still answer `balance`.
5. Network cut between `sign` and `submit`, then retry: **exactly one** transaction id
   reaches the rail.
6. A mocked `submit` ack for an operation that never landed does **not** produce a
   "sent"/"confirmed" state anywhere in the UI.
7. Two adapters exist and are attached — the Vaulta adapter with `buildAction`, and one
   other — because a contract with one implementation has not been tested as a contract.

Criteria 2–6 are each a mutation test. **A gate that has never gone red has not been
proven.**

---

## 10. OPEN — NOT DECIDED HERE

- **Derivation and account discovery** across rails with different address models.
- **Timeout values** per capability class; a read timeout and a submit timeout are not the
  same number.
- **Adapter authorship trust:** §4 means a hostile adapter cannot spend, but it can lie
  about a balance. What a wrong-but-not-malicious adapter is allowed to cause is unsettled.
- **Arweave funding:** the anchor needs a funded address and bundlers are ruled out. That is
  a rail question, not a contract question, and it is tracked in the wallet lane.
