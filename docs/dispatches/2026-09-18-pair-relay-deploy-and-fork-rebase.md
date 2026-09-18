# 2026-09-18 — BUG-A pairing deploy (GREEN) + BUG-C fork rebase onto upstream main

Seat: zCode. Continues the handoff packet
`C:/Users/travi/.buzz/RESEARCH/BUG_MOBILE_PAIRING_404_AND_CAFFEINE_HUDDLE_2026-09-18.md`
(Fable Code Desktop, 2026-09-18 surgical pass).

## BUG-A — pairing 404: FIXED ON THE BOX, GREEN

- Smoke-tested `buzz-pair-relay` (ships in `ghcr.io/block/buzz:0.2.1` at
  `/usr/local/bin/buzz-pair-relay`) in a throwaway container: binds clean on
  `0.0.0.0:5000`.
- `compose.yml` (buzz-prod, `/opt/buzz/deploy/compose`): new `pair-relay` service —
  same image, `entrypoint: ["/usr/local/bin/buzz-pair-relay"]` (entrypoint override
  ONLY, per #7721 — a `command` override runs the relay twice and crash-loops),
  `BUZZ_PAIR_RELAY_BIND_ADDR=0.0.0.0:5000`, `buzz-net`, `restart: unless-stopped`.
  Backups: `compose.yml.bak-pre-pair`, `Caddyfile.bak-pre-pair`.
- `Caddyfile`: `handle /pair* → reverse_proxy buzz-prod-pair-relay-1:5000` in the
  skaists.buzz block, before the catch-all. Edited inode-preserving (r+ truncate,
  NOT sed -i — the bind-mount inode law), then `caddy reload` in-container.
- **Verification (node real WS handshake): `wss://skaists.buzz/pair` → HTTP 101
  UPGRADE. GREEN.** Probe curl/busybox-wget handshakes return 400 from the sidecar
  itself (it enforces a strict 24-char Sec-WebSocket-Key) — 400 there is the
  sidecar answering, not a routing failure.
- `buzz-prod-relay-1` untouched — Up 2 days (healthy) throughout, NO relay restart.
  `beehivenature.buzz` / `relay.skaists.dev` still 404 on /pair (route added only
  on the identity origin); desktop's NIP-43 fallback dials the relay from /info,
  and skaists.buzz is the identity origin, so pairing works. Extending the route
  to the other two hosts is one Caddy block each if wanted.
- Next acceptance beat (founder gesture): Settings → Mobile on the desktop should
  now render the QR instead of the 404 banner.

## BUG-C durable — fork REBASED onto upstream main (9+1 commits, pushed, draft PR)

Branch `zcode/rebase-assess` in `wt-zcode-nip42-r1` (buzz repo), pushed to
skaists/buzz, **draft PR [#5](https://github.com/skaists/buzz/pull/5)**.
Base: upstream block/buzz main (779af888) — was 351 commits ahead of the fork.
The rebased tree pins **mesh-llm v0.76.0-rc9**, which carries the Windows
mixed-separator runtime-load fix (block/buzz#7731 / mesh-llm#1537) — the durable
compute fix no released Buzz has.

Conflict resolutions (all nine commits landed):
1. Version-bump commit (0.5.21): trivial three-file version conflicts; manifests
   restored to upstream in rider commit `5031a703` (my first pass took the fork's
   whole Cargo.toml and silently dropped upstream's `buzz_ws_client_pkg` alias +
   mesh-llm 0.76 pin — caught by cargo test compile, corrected).
2. Canonical-signing (0207c0c2/0bcb3cff): `canonical_sign_url` folded INTO
   upstream's new helpers — `send_query_request` / `build_authenticated_relay_request`
   now carry the request, the fork's sign-URL stays in front of
   `build_nip98_auth_header(_for_keys)`. Same law preserved: sign canonical, POST transport.
3. Test-module splits: upstream moved tests to `relay/tests.rs` and
   `import_avatar_tests.rs`; fork's inline tests ported into those files
   (advertised-origin tests, canonical_decision_from_info regressions,
   `canonical_signing_import_tests` module).
4. TS observer client (579103f7): merged BOTH — upstream's `toRelayFrames`
   batching AND the fork's NIP-42 fail-closed `.catch → disconnect` per frame.

Verification state (honest):
- `cargo check` (whole workspace, toolchain 1.95.0-gnu): **GREEN**.
- Fork's JS session harnesses on the rebased tree: **8/8 pass**
  (relayClientSession + readOnlyRelayClient, canonical-tag + fail-closed laws).
- `tsc --noEmit`: 10 errors, ALL in upstream files (calendar.tsx,
  linkifyjs import) — stale local node_modules vs upstream's restored deps;
  zero errors in merged files.
- Rust unit tests + full link: BLOCKED on this seat — only windows-gnu toolchains
  installed, sherpa-onnx prebuilt libs are MSVC-static (`__std_terminate`/
  `__GSHandlerCheck_EH4` unresolved under mingw ld). The 0.5.21 fork build came
  from CI, not this seat.
- Fork CI on PR #5: the `CI` workflow fails at "Release workflow source contract"
  for EVERY fork PR (fork main 191a577d diverged from upstream release tags;
  bfable's PR fails identically) — downstream test jobs never run. "Desktop
  Release Candidate" green run is a path-filter no-op (8s).

**Remaining for the durable fix (founder decision):** a real Windows build of PR #5
— needs either an MSVC-capable builder or the fork's CI main realigned with
upstream (force-push of fork main = founder's call, it has diverged). Until a
rebuilt install ships, the launcher `buzz-desktop-mesh.cmd` remains the compute
workaround; do NOT install stock 0.5.23 (no compute fix; would overwrite the
hand-patched buzz-acp.exe observer fix + canonical-auth build).

Seat-hygiene notes: sherpa .a aliases + gnu-named sidecar binary copies are
untracked local build aids in the wt; stash `pre-rebase-assess` (fork Cargo.lock
tweak) left in place.
