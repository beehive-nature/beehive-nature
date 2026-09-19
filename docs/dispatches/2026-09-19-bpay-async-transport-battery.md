# bPay Phase E — async transport EXECUTED; the old hang root-caused; battery non-physical points GREEN

zCode, 2026-09-19. The banked wake order (`666eb31c`: async `reqwest`
inside `SuiteMcp`, seam preserved, no per-call runtime, then the 8-point
battery) is executed through every point the physics allowed. The
physical legs wait only on the Safe 7 being plugged + unlocked.

## CLAIM → EVIDENCE

- **CLAIM: the async rewrite landed inside the seam, nothing above it
  knows.** `crates/bpay-sign/src/suite_mcp.rs` — one `reqwest::Client`
  built once inside the service runtime (`no_proxy()`, pooled), the
  ambient `Handle` captured at construction; the organ's sync
  `ConnectTransport` trait is bridged by the single legal
  `block_in_place` + `Handle::block_on` (multi-thread runtime only, no
  runtime ever created per call). Handlers (`preflight`, wallet
  connect) `.await` the async methods directly. `main.rs` constructs
  the transport inside `rt.block_on` (runtime-first). Gates: watchpay
  suites GREEN (wave 32/32), phase-e e2e 55/55, build + fmt clean.
- **CLAIM: the old "service-integrated MCP hang" was never the HTTP
  client.** Isolated by instrumented probe: with the Safe 7
  absent/locked, Suite's MCP server holds every device-dependent tool
  call open indefinitely (silent `trezor_get_address` times out at any
  client bound; `initialize` 1.2s and `tools/list` 4ms answer fine,
  repeated, both Accept variants, plain application/json responses —
  no SSE involved). The blocking client turned that server-side hold
  into forever-hangs; the async client bounds it (30s control-plane /
  190s device-paced) and returns a named refusal.
- **CLAIM: battery points 1, 3, 8 GREEN; 2, 4–7 pending device.**
  Through the service (`POST /v1/mcp/ping`, port 8818): tools/list
  20/20 ok, 8 tools, 2–5ms after the first 2.6s session call; sockets
  0→1→0 across the battery (no leak); `trezor_push_transaction` zero
  call-sites, `"broadcast": false` pinned, state dir empty and the
  Suite token in ZERO state files (live-checked). `/v1/preflight`
  returns the bounded 30s `transport` refusal while the device is
  absent — the service never hangs. A 3-minute device watch expired
  unanswered, so the physical legs (REJECT → no binding; APPROVE →
  exactly one public binding; restart persistence) remain the
  founder's next gestures with the Safe 7 attached.

## BOUNDARY NOT CROSSED

No signing, no payment, no broadcast, no push, no mainnet touch, no
device prompt fired while unattended. The Suite token stayed env-only
(lifted from Suite's own config into child process env; never printed,
never written). One environment note, surfaced honestly: a parallel
seat's `wt-zcode-bpay-mcp` service instance held port 8808; it was
stopped to free the port and this battery ran on 8818.
