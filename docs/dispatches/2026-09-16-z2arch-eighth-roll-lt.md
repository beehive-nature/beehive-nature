# zArcheology EIGHTH ROLL — the R13 live NWC transport boundary attacked · 2026-09-16

**Order (founder, verbatim):** "Attack the R13 live NWC transport boundary itself. Design
RED-first specs for WebSocket reader/reconnect, duplicate 23195 responses, stale/wrong
request correlation, wrong `p` tag, replayed response, relay disconnect between send and
response, and conflicting responses from multiple relays. Preserve the key law: transport
ambiguity can only reconcile the existing `payment_hash`; it can never create a new payment
identity. Then roll directly into capability-manifest attacks (CD-7…CD-10)."

**Deliverable:** `docs/agents/ADVERSARIAL-BPAY-SPECS.md` § EIGHTH ROLL — SPEC LT-0..LT-9
(LT-0 = the founder key law pinned as the roll's constitution) + CD-7⁺..CD-10⁺ sharpening.
Targets read at FULL source depth: `crates/bpay-rail/src/nwc_live.rs` (all 395 lines), the
`nwc.rs` request path, `NwcConnection::parse`, at `codex/z2b-bpay-rail` @`0ff70217`.
Tests designed only; zero production code, zero network.

**Strongest find (bug-shaped, cited): relay-rejection conflation.** The acknowledgement
check is a substring test — `if !resp.contains("true") && !resp.contains("OK")`
(nwc_live.rs:378) — so a relay REJECTION `["OK", id, false, …]` PASSES as acceptance; the
refused event then times out at read and returns `TransportAmbiguous`: rejected-at-relay
silently classified as in-flight-unknown. For value-carrying requests this is the exact
conflation the founder key law exists to prevent. SPEC LT-1 makes it P0-class.

**Other RED anchors verified by direct read (cited in the doc):** no request↔response
correlation (`limit:1` + first-brace parse, :331/:344-353 — decrypt/correlation are future
work, content read then discarded :384-393); response sender never authenticated (no
`pubkey == wallet_pubkey_hex` check, no schnorr verify, :384-387); multi-relay silent
last-wins (`parse` overwrites `relay` per query pair, :65-77; type is single-relay :46);
one-shot read with no reconnect loop (:376-383); `now_secs()` epoch-0 fallback (:263-268)
+ hardcoded 60s expiration (:369); NIP-44 nonce = documented-deviation DRBG
`sha256(secret‖nanos)` with a NON-injectable clock (:200-216); `urldecode` handles five
uppercase-only sequences (:87-93).

**Spec families:** LT-0 identity law (transport may only reconcile the existing
payment_hash — never create/rotate identity); LT-1 relay-ack truth (+ negative control);
LT-2 WS reader/reconnect/disconnect-mid-flight (bounded backoff, same payment_hash every
retry, window still governs); LT-3 correlation (stale/wrong response, unknown method,
restart survival); LT-4 sender authentication (wrong p-tag, forged schnorr, wrong-wallet
requests, distinct decrypt-failure classes); LT-5 duplicate redelivery (dedup by event id,
divergence flag on distinct duplicates); LT-6 replay + clock skew (client-side freshness,
payment_hash-exact evidence binding, declared skew bound); LT-7 multi-relay (typed Vec or
refusal — never silent last-wins; conflicting authenticated responses escalate Unknown;
failover composes per CD-9); LT-8 clock failure + per-request TTL + injectable clock seam;
LT-9 nonce uniqueness under a frozen clock + OFFICIAL nip44-v2 vector pin (external
ground-truth anchor law) + case-insensitive percent-decoding.

**CD roll-into (founder-directed):** CD-7⁺ response-read gains correlation/freshness/dedup
dimensions (a reading-but-not-correlating relay = `weak`, refuse value-carrying
construction); CD-8⁺ send-gate × response-read manifest contradiction refused before
runtime; CD-9⁺ multi-relay = per-relay read UNION with an escalate-unknown conflict rule;
CD-10⁺ the mock needs a RELAY-simulator tier (OK-false acks, duplicate delivery,
since-ignoring filters, flapping, conflicting second responses) — NIP-47 result vocabulary
alone cannot carry the LT battery. Cross-lane: complements the seventh roll's MP specs
(plan-level manifest binding rides exactly these transport axes).

**Concurrency note:** the seventh roll (MP, `5be2229d`) landed from a sibling zArcheology
instance minutes into this roll's source read — no overlap (plan boundary vs wire
boundary), this roll renumbered seventh→eighth and rebased on `5be2229d` before landing.
