# ORDER → Workerb 2 — consume the zArcheology LT specs now · 2026-09-16

**From:** zArcheology seat, relaying the founder's order verbatim. **Specs live at:**
`docs/agents/ADVERSARIAL-BPAY-SPECS.md` § EIGHTH ROLL (main @`bc22fd6b`), targets bound to
`codex/z2b-bpay-rail` @`0ff70217`.

---

## The founder's order (verbatim)

> **Consume zArcheology LT specs now. Priority LT-1:** replace substring ACK detection with
> structural Nostr relay-ACK parsing. `["OK", event_id, false, ...]` must be a typed relay
> rejection, never `TransportAmbiguous`.
>
> Then **LT-4 sender authentication** before accepting/decrypting any response, followed by
> LT-3/LT-5 correlation+freshness as part of the WebSocket reader.
>
> Prove each RED first, then GREEN. Preserve the existing `payment_hash`; no transport
> failure may mint a replacement identity.
>
> Continue through LT-2 → LT-8/LT-9 → LT-7 automatically.

## Consumption brief (anchors pre-read for you — verify at your own pin before building)

1. **LT-1 (P0, money-safety, start here):** the current ACK check is
   `if !resp.contains("true") && !resp.contains("OK")` — `crates/bpay-rail/src/nwc_live.rs:378`
   — so a relay REJECTION `["OK", <id>, false, "error: …"]` passes as acceptance (it contains
   "OK"), the read then times out, and the refused event is classified `TransportAmbiguous`:
   in-flight-unknown for an event that never entered the network. Replace with STRUCTURAL
   frame parsing of the relay response (parse `["OK", id, bool, …]` as JSON, not substrings;
   unknown frame shapes = typed unknown-frame refusal per LT-1.3). RED proof: a probe feeding
   `OK false` through today's code shows TransportAmbiguous (RED), then the typed
   relay-rejection refusal after the fix (GREEN). Include the LT-1.4 negative control (a
   mutated substring-only validator must be DETECTED by the probes).
2. **LT-4 (sender authentication, before any decrypt lands):** the response event's `pubkey`
   is never checked against `wallet_pubkey_hex` and its schnorr signature is never verified —
   only `.content` is touched (nwc_live.rs:384-387). Wrong-sender refusal comes BEFORE the
   decrypt attempt; forged signature = typed bad-signature refusal; decrypt failures are
   DISTINCT classes (not-for-us ≠ wrong-sender ≠ corrupt).
3. **LT-3 + LT-5 (with the WebSocket reader slice you already have named):** correlation
   (response↔request binding — today `limit:1` + first-brace parse at :331/:344-353 makes a
   stale first-match indistinguishable) and dedup (by nostr event `id`; second delivery
   routes to lookup, one effect). Correlation state persists LEDGER-side (survives restart,
   LT-3.3).
4. **Then automatically:** LT-2 (bounded reconnect/re-read loop; same `payment_hash` every
   retry; the declared evidence window still governs) → LT-8/LT-9 (injectable clock seam —
   retire the epoch-0 fallback at :263-268 and the hardcoded 60s TTL at :369; nonce
   uniqueness under a frozen clock — retire the `sha256(secret‖nanos)` DRBG deviation at
   :200-216; pin the full NIP-44 v2 construction against the OFFICIAL test vectors,
   external-anchor law; case-insensitive percent-decoding at :87-93) → LT-7 (multi-relay:
   typed `Vec<relay>` or typed refusal — NEVER silent last-wins at :65-77; conflicting
   authenticated responses escalate Unknown).

**The standing law on every row (LT-0, founder verbatim):** transport ambiguity can only
reconcile the EXISTING `payment_hash`; it can never create a new payment identity.

**Pipeline law:** prove each RED first, then fix GREEN, CI arbitrates. Sends stay gated OFF
(`send_enabled=false`) per the R13 founder order — all of this is provable against the mock
and a relay-simulator tier (CD-10⁺ names it: OK-false acks, duplicate delivery,
since-ignoring filters, flapping, conflicting second responses); the live leg stays
env-gated read-only (`BPAY_NWC_URL`, `#[ignore]`).

**Orchestration note (founder ruling, same session):** after current bounded work, only ONE
zArcheology instance writes the adversarial-spec lane at a time — spec rolls will come from
a single writer; your lane is unaffected and stays fully parallel.
