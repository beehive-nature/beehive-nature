# Z2.B R15 — the zArcheology LT specs consumed: LT-1/4/7.1/9.3 + LT-0 charter

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: consume
zArcheology's LT specs against R14 — relay ACK truth (OK=false =
rejection, never ambiguous), sender authentication, request
correlation/freshness, replay, multi-relay ambiguity; then attack
capability negotiation so transport capabilities cannot drift.
Live sends stay off; correctness before latency.

Specs: `wt-zarchaeology-recon/docs/agents/ADVERSARIAL-BPAY-SPECS.md`
§ EIGHTH ROLL (main @bc22fd6b), consumed at the zArcheology seat's
bound pins. 13 new LT probes in `tests/lt_spec_consumption.rs`.

## LT-1 — relay ACK truth (P0, the substring-acceptance RED)

**RED was real**: the R14 reader lumped `OK` frames as "relay control"
regardless of the bool — `["OK", id, false, "…"]` was silently
swallowed, the read window expired, and a REFUSED event was classified
`TransportAmbiguous` (in-flight-unknown for an event that never
entered the network).

**GREEN**: `process_ack_frame(frame, our_event_id)` — a STRUCTURAL
JSON parse of the `["OK", id, bool, msg]` frame. `OK-false` for OUR
id = `AckVerdict::Rejected(reason)` (maps to a typed NWC refusal,
never ambiguous); `OK-true` = `Accepted` (then the read loop governs);
`OK` for a different id = `NotOurs`; unknown frame shapes = a typed
`AckError`. Probes: LT-1.1 (rejection → typed, reason surfaced),
LT-1.1b (never ambiguous), LT-1.2 (OK-true then close = ambiguous,
not failed), LT-1.3 (an error body containing the literal "OK"/"true"
words = typed unknown-frame refusal, not substring-accepted),
LT-1.3b (wrong event id = not-ours), LT-1.4 (the negative control:
a substring validator is DETECTED by the probes).

## LT-4 — sender authentication (BEFORE any decrypt)

**RED was real**: the correlation engine checked the p-tag but never
the event's `pubkey` field (the actual sender) or its schnorr
signature — only `.content` was touched.

**GREEN** (in the correlation engine, before the MAC/decrypt path):
LT-4.1 the event's `pubkey` must equal `wallet_pubkey_hex` — wrong
sender = `NotOurs("wrong sender pubkey")`, zero ledger effect; LT-4.2
the schnorr signature is verified over the event id (sha256 of the
canonical array → BIP-340 `verify_raw` via pure-Rust k256) — invalid
= `NotOurs("bad signature (…)")` with the specific failure class
named (malformed / parse / event-id-malformed / sender-key /
verify-failed). Content is NEVER consumed from an unauthenticated
event. Healthy control: the wallet properly signs, we accept. The R14
adversarial mock was updated to produce properly signed events (the
old `"sig": "00"` events are now correctly refused).

## LT-7.1 — multi-relay typed (never silent last-wins)

**RED was real**: `NwcConnection::parse` silently overwrote `relay`
on each `relay=` param — a multi-relay URL kept only the LAST relay.

**GREEN**: multiple `relay=` params = a typed refusal ("multi-relay
composition is not built; the connection must name exactly one
relay"). Single-relay parses unchanged (healthy control). When
multi-relay is built it becomes a typed `Vec<relay>` with a conflict
escalation rule (LT-7.2/7.3 — the next slice).

## LT-9.3 — case-insensitive percent-decoding

**RED was real**: `urldecode` only replaced uppercase `%3A/%2F/%3F/
%3D/%26` — a lowercase `%3a` or `%2f` stayed undecoded, silently
breaking relay URLs.

**GREEN**: a proper RFC-3986 hex-percent decoder that accepts any
case, preserves unknown sequences verbatim, and decodes byte-by-byte.
Probe: a lowercase-percent relay URL parses to the correct wss://.

## LT-0 — the identity law (charter, now a standing probe)

"Transport ambiguity can only reconcile the EXISTING payment_hash; no
transport event constructs, derives, or re-keys a payment identity."
Proven from the transport angle: every transport error class
(ambiguous, rate-limited, refused) leaves the payment identity
untouched — no new identity was minted, no re-key, and the ledger
holds the ORIGINAL `payment_hash` (or correctly nothing).

## R14 probes updated (not weakened)

The R14 adversarial mock's events now carry REAL BIP-340 signatures
(the `"sig": "00"` shortcut was acceptable before LT-4 landed; now the
engine correctly refuses unsigned events). All 10 R14 probes pass
unchanged in their assertions — the mock produces authentic events,
so the attack surface (duplicate/stale/wrong-p/correlation/noise/
disconnect/recovery/budget) is exercised through the full
authentication path.

## Evidence

bpay-rail **60/60** in BOTH default and `live-nwc` configurations
(37 prior + 3 crypto unit + 13 LT-spec + 7 existing reader tests
re-signed); watchpay **65/65 unchanged**; clippy 0 warnings; fmt
clean; secret-scan clean; LIVE SENDS off; default build network-free.
