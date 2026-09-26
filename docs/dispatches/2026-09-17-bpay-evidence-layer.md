# BPAY EVIDENCE LAYER + P1 RECOVERY IMPLEMENTED AND PROVEN · 2026-09-17

**Seat:** zBlood (`lane/zcode-lineage-import`). **Mission (founder-relayed from the bPay handoff):** extend the zGenealogy Autonomi preservation ceremony with the bPay document/evidence layer, without changing the signer, payment, or recovery boundaries. Human ceremony unchanged (Preserve → Review with wallet → Understand → Confirm on Trezor → Verify survival); machine states modeled underneath as distinct artifacts: QUOTE → INVOICE → AUTHORIZATION → SETTLEMENT → RECEIPT → RECONCILIATION.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

**CLAIM 1 — the exact prepared payment plan now survives bridge death.**
EVIDENCE: antd-bridge persists the serde-native `PaymentIntent` AND the per-chunk payment/proof metadata (quotes, peer_quotes, commitment sidecars, PUT targets) at prepare time under `ANTD_BRIDGE_STATE/jobs/<artifact-sha256>/<upload_id>.json`. Executed proof (tools/antd-bridge/p1-recovery-proof.json + p1proof-prepare1.json + p1proof-prepare2-recovered.json): P1 prepare (24 chunks, 1.910261 ANT) → `taskkill /F` → fresh bridge → re-prepare returned the SAME upload_id, SAME total, and **24/24 identical quote hashes**, with `recovered_from` metadata and 24 fresh quotes discarded before they could ever be signed. The prior in-tree evidence pair (p1.json vs p2.json) showed 0/24 overlap WITHOUT persistence — this closes exactly that gap.
BOUNDARY: recovery is fail-closed (data_map moved / chunk set changed / re-attached quotes ≠ persisted plan → 409 + force_fresh guidance, never a silent over- or under-pay). The escape hatch is proven too: `force_fresh` voided the open job and produced 0/24 overlap with a new upload_id. End-to-end finalization after real settlement remains UNTESTED (it needs money moved first) and is claimed nowhere.

**CLAIM 2 — invoice and receipt are separate first-class artifacts with the honesty laws as code.**
EVIDENCE: `tools/genealogy/bpay.mjs` (`skaists.bpay-invoice/1`, `skaists.bpay-receipt/1`, `skaists.bpay-reconciliation/1`). The invoice carries archive identity (20,537 files / 62,139,972 B, manifest 440b502a…, tar fec5fba8…), encrypted chunk count, the live ANT quote, the separated authorization ceiling (≤3.2 ANT / ≤0.0002 ETH — two assets, two bounds), plan identity (upload_id + data_map_address + sha256 digest over sorted quote hashes), destination/service, job-bound expiration model, and the wallet action requested (ERC-20 approve + payForQuotes) with Clear Signing honestly labeled (payForQuotes = UNVERIFIED). The receipt requires settlement evidence (settledAt, txRefs, gas, finality) — `buildReceipt` THROWS without it; there is no code path that mints one from an invoice. `reconcile()` compares settled vs ceiling, plan identity, gas, and artifact identity, and names breaches. Tests 9/9 (tools/genealogy/bpay.test.mjs): ceiling-refusal, no-receipt-without-evidence, conflation refusal, order-stable plan digest, breach + mismatch detection. Full genealogy suite 50/50.
BOUNDARY: no receipt exists today because no settlement has occurred; the fixtures are labeled SIMULATED; no USD conversion anywhere (token-native only — no synthetic projection labeled measured).

**CLAIM 3 — the ceremony renders the document layer in the browser, live.**
EVIDENCE (in-browser, live bridge, keyless): blood.html preserve panel now shows the bPay evidence chain strip (QUOTE ✓ · INVOICE issued · AUTHORIZATION ≤3.2 ANT / ≤0.0002 ETH · SETTLEMENT not-yet · RECEIPT not-yet · RECONCILIATION not-yet), the gas bound as its own line, **↓ download invoice** (enabled — real artifact built in-page, digest sha256:3e85edff03bfc… MATCHING the committed artifact assets/profile-archive/lineage/bpay/invoice-up-1789627481303.json), **↓ download receipt (awaiting settlement)** (disabled — receipts are issued from settlement evidence only), and the cypherpunk detail with the full chain incl. plan digest, artifact hash, and the persistence law. The prepare in this run itself hit RECOVERY (the panel displayed "recovered plan — the original authorization survived the bridge (fresh quotes discarded)") — the UI demonstrated the P1 path unprompted. 390px shot clean (docW 375 ≤ 390, no horizontal overflow). Cancel now VOIDS the plan through POST /v1/upload/abandon — verified in the bridge job index (up-1789627481303 → abandoned). A SETTLED/PRESERVED presentation (amount, date, reference, method, View payment details, both downloads — Stripe information architecture, not visuals) is wired and renders ONLY from a receipt artifact; nothing calls it with data today, and that honesty is the point.
BOUNDARY: blood.html and antd-bridge remain non-signers (no key path exists in either); the "review with wallet →" step still parks honestly at the Trezor TODO (bantfarm pattern is the next lane, unchanged).

## Engineering notes banked

- `finalize` now calls the REAL `Client::finalize_upload(prepared, &HashMap<QuoteHash, TxHash>)` (pre-checks every non-zero quote has a tx receipt; banks the outcome against the persisted job). Merkle finalize stays honestly unwired (pkg3 rides wave_batch).
- The recovery swap re-attaches per-chunk metadata BY CHUNK ADDRESS (deterministic) and then verifies the re-attached non-zero quote set reproduces the persisted intent exactly — the swap is not trusted, it is checked.
- `PreparedChunk`/`ExternalPaymentInfo` derive only Debug — hand-rolled serde for the chunk state (QuotePaymentInfo fields, sidecars, PUT targets as strings); `PaymentQuote`/`EncodedPeerId`/`PaymentIntent` are serde-native upstream and round-trip verbatim.
- Registry `ant-protocol 2.4.0` defines `XorName = [u8; 32]` (type alias, not the xor_name tuple struct) — the git checkout differs from the published crate here; trust the compiler's view.
- Bridge new surface: GET /v1/jobs (persisted job index, no secrets), POST /v1/upload/abandon, `force_fresh` prepare flag, `artifact_sha256`/`artifact_bytes`/`recovered_from` on prepare responses.
- State dir is env-scoped (`ANTD_BRIDGE_STATE`) so proofs run against isolated fixtures; the proof dir was `bridge-state-p1proof` (local, not committed — job files are local-only by the recovery law).

## Verification ledger

- cargo build --release: clean (1 benign dead-code warning on the merkle field kept for API shape).
- Genealogy suite: ancestry 11 · bpay 9 · family 5 · geometry 5 · identity 5 · preserve 7 · smoke 8 = **50/50**.
- estate-check: **PASS — 96 counted · 105 listed · hub static + embed in sync**.
- Live network: 4 keyless prepares this session (P1, recovered P1′, force_fresh, UI ceremony prepare) — zero payment, zero keys, all against the frozen pkg3.tar (sha256 verified fec5fba8… before each).

**Next (unchanged boundaries):** the Trezor Connect wire (review with wallet → device signing → broadcast → finalize) is the remaining lane; when its settlement evidence lands, buildReceipt + reconcile + pvRenderSettledPresentation light up with zero schema changes.
