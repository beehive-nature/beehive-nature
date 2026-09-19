# Safe 7 Observation A — device receipt (bpay.safe7-preflight/1)

**When:** 2026-09-19 (unix 1789812681 run-4 · 1789812776 run-5, local)
**Device:** Trezor Safe 7 (T3W1), USB `VID_1209&PID_53C1`, wallet "LoVis waTer"
(standard), firmware upgraded by the founder to stock **2.12.5** minutes before
the ceremony (from `core/CHANGELOG.T3W1.md`; the 2.12.5 Ethereum fixes touch
SLIP-24 payment requests and pubkey layout, not `ethereumSignTransaction`).
**Transport:** Trezor Suite **26.9.2** experimental MCP — `POST
http://127.0.0.1:21340/mcp` (token redacted; read from Suite's own
`%APPDATA%/@trezor/suite-desktop/config.json` `mcpSettings`), plain JSON-RPC
`tools/call`, founder-enabled in Settings → Experimental.
**Tools exercised (runtime `tools/list` + live calls):** `trezor_get_address`,
`trezor_sign_message`. Nothing else. Eight tools total are served.

## The observation (per board ruling @fedb2095: harmless preflight → deliberate
rejection → approval → recover signer → match)

1. **Preflight / silent derivation** — `ethereumGetAddress` at `m/44'/60'/0'/0/0`,
   no device button:
   device address `0x8fd7252a29fb759755e30a15e966932eaad91b75` (returned
   EIP-55-checksummed `0x8fD7252A29FB759755E30A15E966932EaAD91b75`; the device
   session opened only after Suite's "Select your Trezor — Connected to: MCP
   Agent" modal was confirmed).
2. **Deliberate rejection — NOT EXERCISED.** In BOTH passes the founder APPROVED
   the first device prompt on sight; the refusal stage was never observed on
   hardware (recorded by the tool as `refused_cleanly: false`, observed "founder
   approved the first device prompt — rejection stage not exercised"). The
   refusal PATH is proven only at the unit level (`tool_error_is_a_refusal_not_
   retry`) and by the three earlier live transport refusals (timeouts surfaced as
   clean errors with receipts, exit 2 — nothing retried, nothing stuck).
3. **Approval + local recovery** — `ethereumSignMessage`, message
   `bPay Safe 7 preflight 2026-09-19: harmless message, no transaction, no broadcast`:
   - message hash: `0xa56b23645a02bf6ca0372514c7212a99e555f148247d648ea356ecb9d7fe6411` <!-- PUBLIC-CONSTANT: keccak256 personal-message preimage, receipted -->
   - signature (65 B, r‖s‖v, v=28 EIP-155 form): `0xd47401d0ffc2ccef9aea1b3e8a573bbab680d3cad63dc60d2d64d7819874094f3045abce9e672d8c75c70e4e1d101d1de0a5aaf9ec1ea3d1725776a8f6105b8b1c` <!-- PUBLIC-CONSTANT: Safe 7 deterministic message signature, receipted -->
   - **recovered signer (locally, k256, from the signature alone):
     `0x8fd7252a29fb759755e30a15e966932eaad91b75`** — equal to the silently
     derived device address (match ✓) AND to the device-claimed address in the
     response (match ✓).
4. **Reproducibility note (honesty over independence):** runs 4 and 5 performed
   the ceremony as two separate device interactions and returned the IDENTICAL
   signature — the Safe 7 signs messages deterministically (RFC 6979-family
   nonce), so the second pass REPRODUCED the first rather than independently
   re-proving it. One signature value, two live observations of it.

## Boundaries

- **Zero transactions.** No `trezor_send_transaction` or
  `trezor_push_transaction` call was made; no transaction was composed, signed,
  or broadcast; Observation B was NOT attempted (stop-for-inspection holds).
- `broadcast:false` is a structural constant in the adapter
  (`crates/bpay-sign/src/suite_mcp.rs`); the word appears in this receipt only
  as that constant and as the signed message text.
- Mainnet untouched. The token never appears in committed files (a leak in a
  transport-error string was caught and scrubbed mid-session, and the error
  formatter now redacts it by construction).
- The raw run receipts live on the box at `C:\Users\travi\bpay-safe7\`
  (`safe7-preflight-receipt-run{4,5}.json`, token-free).
