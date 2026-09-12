# z2.c independent negative review — 20659754

Codex (Astra), 2026-09-12. Candidate not accepted. Builder worktree untouched; review in detached wt-astra-z2c-review. Hosted test/node/static/scan success independently queried at this pin. Baseline `cargo test -p watchpay --locked --offline --quiet` independently passed 107 tests. The three additional probes below then returned 0 passed / 3 failed. No device, external signer or funded operation performed.

Companion: `2026-09-12-z2c-review-probes.rs`. To reproduce at the pin, append that file to `crates/watchpay/tests/adapter_signing.rs` in an isolated worktree (it deliberately reuses the candidate's fixture helpers). Run `cargo test -p watchpay --locked --offline --test adapter_signing astra_review -- --nocapture`.

## P1 — cancelled result can attach to a replacement attempt

connect.rs `record_verified_signed` discards request metadata and forwards only decoded_tx to the synthetic ledger API. Neither request nor VerifiedSigned carries the persisted attempt sequence. Repro: intent nonce 7; compose/verify response A; cancel intent; create new intent nonce 7; submit A. It succeeds and marks the new attempt Signed. The existing stale test stops before creating the replacement and misses this case.

Correction: bind the persisted attempt identity and request identity through composition, verification and an atomic expected-attempt transition. A stale callback must fail even when nonce and transaction fields are identical. Preserve reservation/state on refusal. A getter check followed by an unchecked write is not an atomic binding. Avoid allowing post-dispatch uncertainty to be relabelled as a safe pre-dispatch cancellation; document that boundary honestly. Preserve offline synthetic compatibility without claiming it enforces the adapter's rules.

## P1 — review summary can show a different payer

`SignRequest::review_summary(&vp)` accepts an arbitrary other validated plan. It displays that plan's payer and total approval ceiling beside the original request's plan hash and transaction. Repro passes a different valid base plan and gets its payer, without error. This contradicts the required single-source review summary.

Correction: retain the review fields in the immutable request and remove the external plan argument, or require exact identity and return an error on mismatch. Include derivation path and full relevant transaction identity in the review representation. Add wrong-plan and healthy controls; an API change eliminating substitution is acceptable with a faithful regression.

## P2 — response wire shape is not Connect's named contract

`ConnectSignedTxRaw` derives Deserialize with Rust `serialized_tx`, without serde rename. An actual JSON object with `serializedTx`, v, r, s fails to deserialize. Existing fake transport constructs the Rust struct directly, hiding the mismatch.

Correction: implement the pinned serializedTx field mapping and test a JSON round trip at the production decoding boundary before signature verification; retain missing/malformed/size checks. State whether the outer Connect success/payload envelope is handled here or by a later transport layer.

## Additional source-level freshness gap

`sign_batch_payment` reuses its original now_unix after the synchronous transport returns. It cannot observe expiration during that call. This observation is by source inspection, not a fourth executed probe. Use an injectable clock or explicit completion time at the post-transport boundary, and test advancing it across expiry without sleeping. Refuse a late result without freeing the uncertain reservation. Explain how callers distinguish a refusal before dispatch from an unknown result after dispatch.

## Same-session correction order

Continue z2.c at GLM 5.3 MAX. Reproduce the three probes first. Fix these bounded API/lifecycle issues; retain all 107 tests and add regressions for the sequences above, actual wire decoding and time advancement. Adapt probe syntax honestly if immutability/API changes eliminate the invalid call. Run fmt, offline tests, clippy and secret scan; commit/push a descendant with canonical attribution and verify hosted checks at its SHA. Return for re-review. No hardware preflight, SDK initialization, real signing, RPC, broadcast, uploads, payment, deployment or merge. z2.d's separately authorized web release is unaffected.
