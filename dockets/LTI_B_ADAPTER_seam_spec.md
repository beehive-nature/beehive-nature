# DOCKET C-6 — `adapter-lti`: the verified-mastery → minted-`b` seam

**Status:** SPEC (design). Skeleton crate follows; **nothing in this docket mints.**
**Repo:** beehive-nature/beehive-nature (the kernel) · drafted against `main` @ `33779b6`.
**Design source:** `DISPATCH_C5_C6_canvas_lms_and_lti_b_adapter.md` (Drive, owner
loviswater44@gmail.com, 2026-07-17) → itself sourced from
`OPERANT_REWARD_v2_canvas_quests_network_velocity.md` (Drive). Both are **off-repo
doctrine, cited not vendored** (CONTRIBUTING: design docs under other homes stay out
of the CC-BY-4.0 tree; cite by location so the reference cannot drift).
**Ratification state:** the doctrine's **§5 QuestWeight** and **§1 edge-mint** rulings
are **QUEUED, NOT RATIFIED.** This spec encodes their *shape* with the values behind a
ratification flag — the FirmwarePolicy precedent (policy data, founder-ruled). The
seam is inert until they land, by construction (§7), not by promise.
**Executor:** Seat 3, own kernel clone. Delivery: red-first; skeleton lands **after
C-5 produces the real LTI 1.3 AGS fixture** (dispatch sequencing); secret-scan gates;
commit per established receipts.

---

## 1. The one property everything else serves

> **The adapter *requests*; the ledger *enforces*.** The 420 lifetime cap, the PoUL
> personhood gate, and emission velocity live in the `b` engine. `adapter-lti` can
> compute a weight and *ask* for a mint; it holds no minting authority and no key.
> **A fully compromised adapter cannot over-mint** — the worst it can do is emit
> well-formed requests the ledger then rejects on cap / velocity / PoUL grounds.

This is why Canvas is replaceable furniture: the LMS, the LTI transport, and this
adapter are all *below the spine* (adapter doctrine). Trust concentrates in the `b`
engine, not in the edge that talks to a third-party gradebook.

State it in the crate's `lib.rs` module doc, verbatim, and let the type system hold
it: the adapter's public surface returns an **`EmissionRequest`**, never a mint.

---

## 2. The pipeline — four stages, each behind a trait

```
Canvas (LTI 1.3 / AGS)            adapter-lti (new crate)                    b engine (ledger)
──────────────────────           ─────────────────────────────────────     ─────────────────
mastery event (signed JWT) ─▶ 1 VERIFY  platform JWT: sig + nonce + iss/
                                         aud + exp; JWKS pinned at
                                         registration; fail closed
                              2 IDENTITY LTI `sub` → DID via explicit,
                                         consented binding ceremony;
                                         never auto-link; PoUL gate
                              3 WEIGHT   QuestWeight = depth × scarcity ×
                                         edge-yield (§5) — pure fn,
                                         fixture-tested, PARAMS GATED
                              4 REQUEST  EmissionRequest{did, weight,      ─▶ Respect × attestation ×
                                         edge, evidence} — no mint             QuestWeight × EdgeFactor,
                                                                               velocity-ruled, 420-cap
                                                                               ENFORCED HERE, never above
```

Each stage is a trait so the impl is swappable and the pure core is testable without
I/O — the same shape as `capability` (pure policy + `Verifier` trait) and
`adapter-carrier` (pure mapping + `CarrierApi` trait, mock-first until keys exist).

---

## 3. Stage 1 — VERIFY (fail-closed JWT admission)

LTI 1.3 delivers mastery/score events as platform-signed JWTs (AGS — Assignment &
Grade Services). Admission requires **all** of:

- **Signature** against the platform's JWKS, where the key set is **pinned at tool
  registration** (C-5 registers the tool and captures the JWKS). An unknown `kid` or a
  key not in the pinned set → refuse. No fetch-and-trust at request time.
- **`nonce`** unseen (replay protection) — a `NonceStore` trait; a seen or stale nonce
  → refuse.
- **`iss` / `aud`** match the registered platform / tool client-id.
- **`exp` / `iat`** within skew (reuse `capability`'s reattestation-skew discipline —
  don't invent a second clock policy).

Refusal is a typed `LtiError`, never a panic, never a silent drop. Mirrors
`Ed25519Verifier::verify_strict` rigor: the strict path is the only path.

**Red fixtures (now):** a hand-authored AGS JWT — valid; wrong-sig; expired;
replayed-nonce; unknown-iss. **Green fixture (post-C-5):** the real captured AGS
payload from the eval instance replaces the "valid" synthetic one.

---

## 4. Stage 2 — IDENTITY (consented binding, never auto-link)

The LTI `sub` is a **per-platform pseudonym**, not a person. It becomes a DID only
through an **explicit, consented binding ceremony** — the holder proves control of
both the LTI account and the DID and *chooses* to link them. Properties:

- **Never auto-link.** A first-seen `sub` with no binding → refuse the mint, surface a
  "bind your learning account" prompt. Absence of a binding is not an error to paper
  over; it is the system declining to invent an identity.
- **PoUL gate.** The DID must resolve to a live Proof-of-Unique-Life thread. No PoUL →
  no mint. (Consistent with B_EMISSION: `b` accrues to *unique humans*.)
- The binding is a `SubjectBinding` trait (lookup + record); the *ceremony UX* is
  out-of-scope here (T-series device-enrollment territory) and cited as an open edge.

**Cross-reference the tension** DATA_COMMONS names: reward-the-unique-human vs.
stay-unlinkable. This stage is where it bites; the spec does not resolve it, it
**marks** it (§8).

---

## 5. Stage 3 — WEIGHT (pure, deterministic, params gated)

```
QuestWeight = depth × scarcity × edge_yield        // §5, doctrine — SHAPE only
```

- **Pure function**, no I/O, deterministic, fully fixture-tested. Signature roughly:
  `fn quest_weight(inputs: QuestInputs, params: &QuestParams) -> Weight`.
- **`depth`** — mastery-path length / gate-depth of the completed quest (how far in).
- **`scarcity`** — inverse frequency of the mastery across the cohort (rare mastery
  weighs more); the *source* of the frequency is an input, computed by the ledger/
  reputation side, **passed in** — the adapter does not query global state.
- **`edge_yield`** — contribution from verified edges (peer-verify / teach-back), see §6.
- **`QuestParams` is policy data behind a ratification flag.** Until §5 ratifies, the
  crate ships `QuestParams::UNRATIFIED`, and any weight computed with it is tagged
  `Provisional` — Stage 4 refuses to build an `EmissionRequest` from a provisional
  weight. Precedent: `FirmwarePolicy.trusted_roots` (values are founder-ruled policy
  data, not code constants). **The formula shape can land now; the numbers cannot.**

---

## 6. Edge events — distinct-counterparty rule (§1 / v2 §2)

Peer-verification and teach-back arrive as **distinct `EventType` variants**, each
carrying **both DIDs** (verifier + verified / teacher + learner). `EdgeFactor` (the
§1 multiplier) applies **only when both ends resolve to distinct PoUL threads.**

- Same-thread, self-loop, or an unbindable counterparty → `edge_yield = 0`. No factor.
  A ring of one person's aliases verifying each other yields nothing — the distinctness
  test is the anti-farming property, and it lives on **PoUL-thread identity**, not on
  account identity (accounts are cheap; PoUL threads are not).
- `EdgeFactor`'s value is §1-ratified policy data, gated exactly like `QuestParams`.

New `EventType` variants land **additively under `#[non_exhaustive]`** (the K-D2
discipline): `PeerMasteryVerified`, `TeachBackCompleted` — no existing variant renamed.

---

## 7. Stage 4 — REQUEST, and why nothing mints yet

The adapter's only output is an `EmissionRequest { did, weight, edge, evidence_ref }`.
It is handed to the `b` engine, which alone computes and commits
`Respect × attestation × QuestWeight × EdgeFactor`, applies **velocity**, and enforces
the **420 lifetime cap** at the ledger. Two independent reasons nothing mints today:

1. **No engine call is wired** in the skeleton — Stage 4 returns the request object;
   the mint path is a later docket after §5/§1 ratify.
2. **Provisional weights are refused** (§5) — with `UNRATIFIED` params every request is
   inert.

Either alone is sufficient; together they are the "by construction, not by promise"
the dispatch asks for.

---

## 8. Fail-closed table (the refusal is the feature)

| Condition                              | Stage | Outcome                          |
|----------------------------------------|-------|----------------------------------|
| Unknown `kid` / unpinned JWKS key      | 1     | refuse — no request              |
| Bad signature / bad `iss`,`aud`,`exp`  | 1     | refuse — no request              |
| Replayed / stale `nonce`               | 1     | refuse — no request              |
| `sub` with no consented DID binding    | 2     | refuse — prompt to bind          |
| DID resolves to no live PoUL thread    | 2     | refuse — no request              |
| Edge counterparty not a distinct PoUL  | 6     | `edge_yield = 0` (request may go) |
| `QuestParams::UNRATIFIED`              | 5     | provisional → Stage 4 refuses    |

Every refusal is **logged and typed**, and at the UI it wears **guard-violet, never
error-red** — "the system protecting the credential, not blocking you" (D-11's gate
copy). A refusal is the adapter working, not failing.

---

## 9. Crate shape

```
crates/adapter-lti/
  Cargo.toml         # sibling of adapter-carrier; deps: shared-types, serde_json,
                     #   a JWT/JWKS verify dep (TBD — reuse an existing workspace dep
                     #   if one already pulls JOSE; else propose one in review)
  src/lib.rs         # module doc = §1 property verbatim; the four traits; the pure
                     #   quest_weight() + QuestParams; EmissionRequest; LtiError
  tests/             # red-first fixtures (§3), plus the pure-weight table tests
  fixtures/          # synthetic AGS JWTs now; real capture from C-5 swaps in
                     #   (fixtures/ is secret-scan path-exempt, founder-ruled 2026-07-06)
```

Register in root `Cargo.toml` `members` (alphabetical slot after `adapter-carrier`).
Mock-first: no live platform call in v1 — the `PlatformJwks` / `NonceStore` /
`SubjectBinding` traits have in-memory test impls; real impls gate on C-5's registered
instance, exactly as `adapter-carrier` gates real HTTP on carrier API keys.

---

## 10. Open edges (parked, not hidden)

- **§5 coefficients & §1 EdgeFactor** — unratified; the flag holds them. This docket
  ships the shape only.
- **DID binding ceremony UX** — T-series enrollment territory; cited, not specced here.
- **`adapter-lti` vs. fold into a future `evidence` crate** — the evidence-backbone
  crate-vs-fold ruling is itself still parked; if `evidence` lands, revisit whether
  mastery events are just another `Evidence` provenance. Named so the decision isn't
  silently pre-made by this crate existing.
- **JWKS rotation** — pinned-at-registration is the v1 stance; a rotation/re-pin
  ceremony is a follow-up, not a request-time fetch (that would reopen the trust the
  pinning closes).
- **Unlinkability tension (§4)** — reward-unique-human vs. stay-unlinkable; DATA_COMMONS
  owns it; this seam is where it is felt.

---

*One line to carry: verified mastery earns `b` only through a seam that can ask but
never grant — the credential's value is protected by the ledger it cannot reach, not
by trust in the classroom it came from.*
