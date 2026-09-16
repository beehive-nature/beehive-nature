# Z2.B R14 — the NWC response reader door (WebSocket/Nostr semantics) + hardened secrets + the attack suite

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: build the reader
door using WebSocket/Nostr subscription semantics for kind 23195 —
no REST shortcut; harden the client secret (CSPRNG nonces +
zeroize); rerun the full mock/adversarial suite; LIVE SENDS STAY OFF;
first live operation remains read-only and waits for the existing NWC
connection URL; then attack reconnect, duplicate response, stale
response, wrong `p` tag, wrong request correlation, relay
disconnect/recovery. Branch `codex/z2b-bpay-rail` (descendant of
0ff70217).

## Architecture (the honest split)

- **`nwc_crypto.rs` — DEFAULT build, pure, network-free.** The R13
  POST transport is gone (ureq dropped). NIP-44 v2 encrypt AND decrypt
  exactly per the fetched spec; **nonce now from the OS CSPRNG**
  (getrandom — the R13 DRBG deviation is dead); every key/secret
  buffer flows through `zeroize::Zeroizing`, HKDF intermediates
  explicitly zeroed; MAC verified BEFORE decryption, with a
  constant-time comparison; a MAC failure reads identically to "not
  addressed to us" (ignorable, never a crash). Unit tests: round trip,
  tampered-MAC, wrong-key.
- **`nwc_reader.rs` — DEFAULT build, pure.** Two layers: (1) a
  correlation engine `process_message(ctx, msg, seen) -> Verdict`
  deciding ownership of each relay message with named classes —
  wrong kind / **wrong `p` tag** / **stale** (created_at before the
  request) / **duplicate** (dedupe by event id) / MAC-failure /
  **wrong correlation** (decrypts but `result_type` answers another
  call) / relay control (OK/EOSE/NOTICE); (2) a bounded read loop over
  any `WsSocket` with a **reconnect policy**: disconnect or orderly
  close → re-ESTABLISH the socket AND re-send the REQ (real
  subscription semantics) up to a budget; budget or window exhausted →
  `TransportAmbiguous` — payment state untouched, never a false
  Failed.
- **`nwc_live.rs` — feature `live-nwc`.** WebSocket ONLY via
  tungstenite (blocking, rustls webpki-roots — pure-Rust TLS): one
  connection per request: send the signed kind-23194 EVENT, subscribe
  (`REQ` kinds [23195] #p [client] since now), read through the
  correlation engine, map the NIP-47 error envelope to typed errors,
  done. `NwcConnection` hardened: secret in `Zeroizing`, parse-time
  buffers zeroed, Debug never prints the secret, https→wss scheme
  conversion only (never a different host). **LIVE SENDS remain gated
  OFF at the rail** (unchanged named refusal).

## The attack suite (10 tests, all green on first full run)

`tests/nwc_reader_adversarial.rs` drives scripted `MockWsSocket`
sequences through the REAL engine and loop: duplicate response
collapses by id; stale ignored; wrong-p ignored; wrong correlation
ignored (answers another call); tampered MAC ignorable-never-crash;
**disconnect → recovery** (drop, reconnect re-REQ, answer delivered,
loop returns it); **reconnect-budget exhaustion → ambiguous not
failed**; window exhaustion on endless noise → ambiguous; a full
noise gauntlet (stale + wrong-p + control + answer + replay) with
every verdict asserted; and the **typed error envelope** (a fresh,
correctly-addressed QUOTA_EXCEEDED error is OURS and comes back typed
— not ambiguous).

## Evidence

bpay-rail **47/47** in BOTH default and `live-nwc` configurations
(37 prior + 3 crypto unit + 10 attack; the nwc_laws suite unchanged
and green); watchpay **65/65 unchanged**; clippy 0 warnings both
configs; `cargo fmt --check` clean; secret-scan clean; default build
network-free; LIVE SENDS off; live read-only leg still env-gated on
`BPAY_NWC_URL` (founder-held, absent on this seat).

## Open / next

Run the live read-only leg when the connection URL is provided (the
WS door now carries the full round trip — request, subscription,
correlated, typed); persistent-connection variant (one socket for a
session) if latency demands; per-connection rate-limit backoff.
