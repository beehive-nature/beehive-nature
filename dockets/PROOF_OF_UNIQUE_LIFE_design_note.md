⟨Research → Design · Proof-of-Unique-Life (PoUL) · founder concept 2026-07-16 · design, founder decisions pending⟩

# Proof-of-Unique-Life — weighted attestation & ever-deepening confidence

**Founder thesis:** the eternal DID and the BNR environment are *intentions and
attestations, ever growing deeper confidence intervals* — the DID and its devices
"sensing the world together," bLOVErAi an available interpreter/translator.
Personhood is not a gate passed once; it is a **posterior that deepens over a
lifetime.**

## 1. The reframe
> **P( one unique living human | all attestations so far )** — a confidence that
> narrows and deepens as independent signals arrive and *persist*.

No single signal is the identity and none is load-bearing. Adapter doctrine
applied to personhood: each attestation is a replaceable sense-adapter; the
confidence is the emergent, durable thing.

## 2. Why this dissolves the device_id objections
Rooting a DID in a device serial fails three ways (breaks DID-not-keys, is a
deanonymization supercookie, conflates device with person). PoUL keeps the
instinct and voids all three — the device is **one weighted signal, never the
root:** enrolled identity is the device's **attestation public key**, not the
serial; raw `device_id` is **zbData**; "same device?" is a salted per-DID
commitment `H(device_id ‖ DID-secret)` — stable, uncorrelatable, irreversible.
Losing the device lowers a number, never orphans the DID (recovery = §7).

## 3. The model
Each attestation carries **signal type · weight · independence class · freshness
decay**. Confidence is a function of *independent, sustained, consented* evidence.
Signal families (opt-in, each its own consent): hardware continuity · temporal
persistence · liveness/biometric presence (device-local) · behavioral continuity
· social attestation (web-of-trust) · contribution over time (= Respect).

## 4. Time is the un-buyable signal
A Sybil can buy N devices in an afternoon; not a decade of one key consistently
sensing and contributing. **Temporal continuity is the deepest evidence of one
persistent life** — the dimension that does not scale with money. Eternal DID and
ever-accumulating attestation are one feature, not two; ties to §8 freshness.

## 5. Same lineage as Respect, viewed twice
- **Respect** = what your unique life has *contributed* (earned, non-transferable,
  per-human, fractal lineage).
- **PoUL confidence** = how sure the network is that it is *one* unique life.

Same accumulating, time-earned, per-human quantity from two angles — PoUL is the
*evidentiary face of Respect*, no new economic primitive. It gates **privileged**
actions (governance vote, unbounded spend) alongside device tier; it must
**never** gate participation, voice, or dignity. Low confidence = less-attested,
not less-human. (Economic role: see the b-emission Operant Reward model — Respect
+ confidence are the unlock weight.)

## 6. bLOVErAi's role — interpreter, not arbiter
A sense-adapter and translator: reads raw signals across modalities, helps
*interpret* them into structured attestations, and translates for the human
("sensing together"). Advisory and consent-gated (§6), replaceable, never the
authority. The human's signed acts and the accumulated evidence carry the weight.

## 7. The two hard problems (named, not hidden)
1. **Independence accounting is the entire Sybil defense.** N of your own devices
   are one independent signal, not N. Rewarding genuinely *independent* evidence
   is an open research problem, not a config value.
2. **Sovereignty vs. surveillance is decided by who holds the data and consents.**
   Signals are zbData, user-held, per-signal opt-in; the confidence may be shared
   with consent, the underlying evidence never is. Refusing caps privileged
   confidence — never punishes, shames, or exposes.

## 8. Consent law (inherited, §6 — above every signal)
Voluntary · informed · consented · at no harm. Each signal a separate opt-in with
a separate revocation; more signals → deeper confidence → more privileged trust,
never coerced, never bundled. Sovereign self-attestation, not a credit score.

## 9. The continuous attestation engine & maturity ladder (founder-directed)
A continuous multidimensional-factorial biometric engine validating a *reality
state in the now-moment* — 3D and virtual — stretch goal a "4D quantum channel."
Sort by maturity; keep the architecture able to *receive* future signals without
*depending* on them.
- **NOW — buildable:** continuous fusion over device-local channels (face, voice,
  HRV, gait, keystroke/behavioral); "factorial" = weights channel *interactions*,
  raising confidence and resisting single-channel spoof. Output: a rolling
  "live-unique-human-now" attestation feeding the §8 freshness clock and the §3
  posterior. Privacy-hard: device-local, templates never leave, only confidence
  leaves (consent) — zbData. A *replaceable* detector adapter (deepfake is an arms
  race); never called unspoofable.
- **3D + virtual — near research:** the same engine across embodiments; virtual
  side tractable, the hard part is binding live physical human to virtual actor
  without a surveillance tether.
- **4D — already the spine:** time as an explicit axis = the worldline = §4's
  un-buyable signal. Present, not future.
- **"Quantum" — two threads, sorted:** (1) **Real & urgent — post-quantum crypto
  agility:** a 1000-year DID must outlive quantum breaking Ed25519/ECDSA; the
  `capability` `Verifier` trait is already the seam — a PQC verifier (NIST
  ML-DSA/SLH-DSA; confirm library maturity) enters additively, same interface.
  Flag as a first-class eternal-runtime requirement. (2) **Aspiration — frontier
  shelf:** a human quantum-communication channel is not established science;
  recorded as north-star, nothing buildable depends on it; enters only as one more
  weighted signal if it ever becomes real.

**Through-line:** an architecture that can receive future signals without
depending on them. Every rung is an adapter; confidence (§3) and consent (§8) are
the constants.

## Open founder questions (rulings folded in)
1. **Confidence representation — RULED: holistic gestalt.** Not scalar, not a flat
   vector: a **vector substrate** (independent classes kept, for the Sybil math) +
   an **integrative reading** of the whole configuration's *coherence*.
   Coherence/dissonance is a first-class signal — signals that triangulate form a
   strong gestalt, individually-present-but-dissonant ones a *suspicious* one even
   at high individual scores (a deepfake defense a scalar can't express).
   Anti-reductionist by design (§8 dignity in the representation): a *form*
   rendered coherent-vs-fragmented, not a score. Math: base per independent class
   + a coherence term, without letting coherence backdoor correlated signals.
2. Signal families in v1 vs. a walled frontier shelf? (open)
3. **Ceilings — RULED: PoUL raises ceilings, as a tool in bLOVErAi's toolbox.**
   Sustained confidence lets bLOVErAi *propose* higher caps/velocity, human-
   ratified (§6). **Anti-coercion guardrail (load-bearing):** it may *offer* more;
   declining caps nothing held, costs nothing — no sell-your-privacy-for-b
   gradient, never pressure.
4. **Independence metric — RULED (indicated): hand-set classes now, learned/graph
   measure later, with the data commons as the training ground.**

## Cross-refs
`TIERED_ACCESS` (device evidence, §6 consent, §7 recovery, §8 freshness) ·
`B_EMISSION_operant_reward_model` (Respect+confidence = unlock weight) ·
`DATA_COMMONS_phase_charter` · P4 bLOVErAi charter · `capability` crate.
