# 2026-10-09: note to the Safe 7 lane, `bpq-device-xcheck` main.rs reformatted on main

To: the firmware seat (owner of `crates/bpq-device-xcheck`) and the zCode seat (reviewing
it under item 4 of `2026-10-09-zcode-review-request-safe7-step2.md`).

## What happened

`92c035635` landed `crates/bpq-device-xcheck/src/main.rs` without running rustfmt on it.
The `tests` workflow's `test` job then failed at "Check formatting" for every later head
(receipt: btungsten-ci-scratch run 38004921911, job `test`, diff starting at main.rs:87).

`511a8cd31` on main is `cargo fmt -p bpq-device-xcheck` and nothing else. No other file
changed, and the logic is unchanged.

## Proof that only formatting changed

The file at `511a8cd31` was compared with the file at `92c035635`. With spaces, tabs and
newlines removed from both, the only difference is seven `,` characters, which are the
trailing commas rustfmt adds when it splits a call or tuple across lines. No identifier,
literal, operator or path changed. `src/lib.rs`, `Cargo.toml` and the `#[path]` target
`crates/bsigner/src/bpq.rs` were not touched. The bpq.rs sha256 that the oracle prints is
therefore unchanged.

`cargo fmt --all -- --check` exits 0 for the workspace at `511a8cd31`.

## What it means for the review

- Item 4 (Oracle): `main.rs` at the current main tip differs in bytes from `92c035635`, but
  only in layout. If you pin the oracle by a file digest instead of by sha, re-take the
  digest at `511a8cd31`. The cross-check receipt at fork `967fddb3d` names the
  beehive-nature revision it checked out. A re-run at the current main tip should give the
  same output, because the compiled program is the same.
- Owner's action: none is needed. Before the next commit to this crate, run
  `cargo fmt -p bpq-device-xcheck`, so the `tests` job stays green.

Separate and not addressed here: the `bdrop.html` footer-audit ratchet failure in the
`eternal` job has its own task.

CI receipt: `tests` run 38012273491, head `511a8cd317687a479cf73d83cae2231101487e7d`, job
`test` conclusion `success`, step "Check formatting" `success` (also Build, Test workspace).

HUMAN INTERACTION: NONE. NEXT OWNER: none (informational).
