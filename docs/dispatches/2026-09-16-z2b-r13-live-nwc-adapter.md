# Z2.B R13 — the LIVE NWC adapter: typed seam, mock-first laws, live transport built

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: build the LIVE NWC
adapter against the existing bPay LN contract (our relay transport,
Alby Hub's NIP-47 boundary); preserve the R8 laws; test locally
against a mock first, then the existing Hub only with non-value/
read-only operations — no payment sends or channel operations yet;
Base live-receipt verification stays a mandatory precondition for
Base-value; then roll into adversarial testing. Branch
`codex/z2b-bpay-rail` (descendant of aa47b04b).

## What was built

**`nwc.rs` — the transport seam + the rail on the ONE ledger.**
`NwcError` carries the FULL pinned NIP-47 vocabulary as typed errors
(RATE_LIMITED, NOT_IMPLEMENTED, INSUFFICIENT_BALANCE, QUOTA_EXCEEDED,
RESTRICTED, UNAUTHORIZED, INTERNAL, UNSUPPORTED_ENCRYPTION,
PAYMENT_FAILED, NOT_FOUND, OTHER) plus `TransportAmbiguous` — the
class that maps to UNKNOWN. `NwcTransport` is a one-method trait;
`NwcRail<T>` drives the unified `RailLedger` through ANY transport:
all R8 laws live here, once. **LIVE SENDS SHIP GATED OFF**
(`send_enabled` defaults false → named refusal "LIVE SENDS DISABLED
this slice" — the estate gate pattern; flipped only by explicit
authorization).

**`nwc_mock.rs` — the mock-first transport.** NIP-47 JSON-shaped
responses exactly per the pinned spec (preimage + OPTIONAL fees_paid;
five-state vocabulary) with injection switches: transport-ambiguity,
payment failure, rate-limiting.

**`nwc_live.rs` (cargo feature `live-nwc`) — the live transport.**
NIP-44 v2 encryption implemented EXACTLY per the spec (fetched this
round — and the fetch mattered: the construction is ChaCha20 +
HMAC-SHA256 with HKDF-sliced keys, NOT the Poly1305 construction I
would have written from memory): conversation_key =
HKDF-Extract(SHA-256, ECDH-shared-x [k256, pure Rust, even-Y
convention for x-only peers], salt "nip44-v2"); per-message keys =
HKDF-Expand(OKM, info = 32-byte nonce, L=76) → chacha_key/chacha_nonce/
hmac_key; ChaCha20 (counter 0) over the spec-padded plaintext; MAC =
HMAC-SHA256(hmac_key, nonce‖ct); payload = base64(0x02‖nonce‖ct‖mac).
Nostr events: id = sha256 of the canonical array, BIP-340 schnorr via
k256 `sign_raw` (correct for already-hashed 32-byte ids), kind 23194
with p-tag + expiration tag, POSTed to the relay as ["EVENT", ev];
response read attempts REQ-over-POST for kind 23195.

## Law proofs (mock-first, then adversarial — 10 new tests, 34/34 total)

Send-gate named refusal (default-off); happy path settles with
preimage + fees reconciled DOWN (1000→25 msat); duplicate
payment_hash → route-to-lookup; expired invoice pre-send refusal;
**transport ambiguity → Unknown, never Failed, never auto-retried**;
PAYMENT_FAILED → terminal Failed with NO fee ever (reservation stands
— window law); rate-limited → typed error, intent PERSISTS at Intent
(the persist-before-send law made explicit — nothing beyond Intent
happens; retry is a new explicit action); typed-error vocabulary
complete; **settlement without preimage refused as incomplete
evidence** (hand-rolled preimage-stripping transport); read-only
info/balance paths.

Two test-authoring bugs were caught by the run itself and fixed
(rate-limit expectation contradicted persist-intent-first; preimage
test minted against a wrong mock clock) — the adapter behaviors were
correct in both.

## The live leg — honest state

The env-gated test (`#[ignore]`, `BPAY_NWC_URL`) runs get_info /
get_balance over the LIVE transport only when the founder-held
connection URL is provided at runtime — **no secret ever enters the
tree**. The URL is not present on this seat, so the live leg stands
ready rather than run. SCOPE NOTE discovered during the build: HTTP
POST carries the request fine, but reading the kind-23195 response
normally needs WebSocket; the transport attempts REQ-over-POST and —
if the relay does not answer that way — returns TransportAmbiguous
with the capability gap NAMED. So the first live run will receipt
either (a) full read-only round trip, or (b) "request accepted by the
relay, reader door pending" — both honest outcomes; a WS/door reader
at the box is the named next slice.

## Evidence

bpay-rail **34/34** (default AND `live-nwc` feature builds — same
suite); watchpay **65/65 unchanged**; clippy 0 warnings both configs;
`cargo fmt --check` clean; secret-scan clean; zero network in the
default build; LIVE SENDS gated off; Base live-receipt verification
reaffirmed as the mandatory precondition for any Base-value work.

## Open / next

Run the live read-only leg when BPAY_NWC_URL is provided (founder
gesture); the WS/relay-door response reader slice; NIP-44 nonce CSPRNG
(currently a chacha-DRBG seeded from key+clock — documented deviation,
lands with the live review); zeroize for the client secret in memory.
