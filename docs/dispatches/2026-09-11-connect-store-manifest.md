# Connect + Store: shared manifest envelope

Authorized by the founder's cross-pollination order for the independent
[W@tch project](https://relay.skaists.dev/watch/) and
[JAMS.community](https://jams.community/) examples. They remain separate
projects; this contract only gives clients a shared envelope to consume.
Base: receiver head `064adea5` on `codex/connect-store-receiver-2026-09-11`.
The shared checkout, accepted integration worktrees, production relays, app
profiles, wallet and paid Autonomi paths were untouched.

## Contract

`fixtures/connect-store-manifest-envelope-v1.json` is a language-neutral JSON
fixture. Its exact `bnr-manifest-envelope-v1` shape carries:

- channel, epoch and sequence;
- a policy-bound checkpoint ID, sequence, policy ID and storage reference;
- encrypted item references for a channel snapshot, recording, stems and
  captions;
- creator and source credits;
- manifest, channel and item component versions; and
- an admission policy with a byte/item ceiling, `payment: "disabled"` and
  downstream `approval: "trezor"`.

`tools/connect-store/manifest.mjs` validates this shape without client-specific
types. It rejects unknown fields, duplicate item IDs, malformed references,
version/size violations and an admission policy that is not bound to the
checkpoint. `checkpointNotice` projects only the opaque checkpoint subset onto
the existing x0x announcement adapter; no channel plaintext or key enters the
notice.

## Caller verification

The new adapter test loads the JSON bytes, validates the shared shape, checks
the channel and Music Jam item kinds, then sends the projected notice through
the real `X0xNotifications` HTTP caller and captures the exact announcement
body. Unknown fields, a mismatched checkpoint sequence, duplicate item IDs and
a foreign admission policy are permanent refusal regressions.

Windows Node 24.18.0 verification: **30/30 tests pass** in
`tools/connect-store`; `git diff --check` is clean. The existing process-loss
proof and receiver bounds remain unchanged. No x0x public participant,
Autonomi upload, paid request, Trezor action, production relay or Buzz app was
used.

## Boundary

This is a shared metadata contract and caller test, not payment admission, a
Music Jam implementation or a Buzz-compatible deployment. `payment:
"disabled"` keeps the current write refusal explicit. The next payment lane
must calculate and cap complete snapshot/checkpoint/chunk cost before a funded
write; Trezor approval belongs after that admission decision. An independent
W@tch or Music Jam client can consume the JSON fixture and the existing bounded receiver
without implementing another raw x0x `/ws` path.
