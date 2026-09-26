# ant-writedoor — the estate's keyless Autonomi WRITE door

Ruled 2026-09-21 (LoVis bee-laborer, event `7b0cc99b`; contract confirmed with
bOPus5 at `35714af3`). Built fresh in the public repo — it is NOT a copy of the
founder-private `~/family-lineage/antd-bridge`, and that source is never read.

## The contract (what `surfaces/myspace-adapter-ant.js` builds against)

| route | shape |
|---|---|
| `GET /ant/v1/upload/prepare` | `200 {"max_bytes": <n>}` — open probe + ceiling. ANY non-200 = the page's "the estate's write door for this rail is not open"; nothing is quoted, nothing is signed. |
| `POST /ant/v1/upload/prepare` | body = raw bytes, `Content-Type: application/octet-stream` → `200 {upload_id, payment_type, total_atto:"<decimal string>", chunks:{total, already_stored}, quotes:[{quote_hash, rewards_address, amount_atto}], data_map_address}` |
| `POST /ant/v1/upload/finalize` | `{upload_id, txs:[{quote_hash, tx_hash}]}` → `200 {data_map_address}` — must equal the quoted address; the door enforces this against its own ledger, gateway-agnostic. |

`total_atto` is a decimal STRING (atto does not fit a JS float) and MUST equal
the sum of `quotes[].amount_atto` — the page sums the parts and refuses a plan
that does not add up.

### Named refusals (`{"error": "<name>", ...}`)

`path_refused` (any JSON body carrying a `"path"` key — a server path is a
file-read primitive exposed to strangers) · `too_large` (+`max_bytes`, on the
declared length AND the streamed count — the ceiling never rests on the page's
honesty alone) · `unknown_upload` (quotes age; re-prepare) · `missing_quote_tx`
· `unknown_quote` · `double_pay` (the three payment-shape laws, held door-side
too) · `address_mismatch` · `bad_request` · `upstream_unwired` (until the
ant-core wiring slice lands, every prepare refuses by name) · `gateway`.

### CORS (ruling 2026-09-21)

Exactly `https://skaists.dev` — echoed only on match, methods named per route
(GET on the probe, POST on the two writes), `Access-Control-Allow-Headers:
Content-Type`, preflight `OPTIONS` answered on both POST paths (octet-stream
and JSON bodies are non-simple requests). Never a wildcard. The LIVE read door
already answers this exact header through Caddy (re-measured after the 06:52Z
antd restore).

## Keyless by construction

No key material exists anywhere in this crate — not in code, config, or state.
The visitor's injected EIP-1193 wallet signs; this door only relays plans and
completes storage. The door binds loopback only; Caddy fronts it on the box
(nodes-on-the-box law, same shape as `ops/x402-door`).

## Why per-quote tx pairs

ant-core's `finalize_upload` takes `HashMap<QuoteHash, TxHash>`
(`ant-core/src/data/client/file.rs:2274`, at `ant-cli-v0.3.7` = `785a155c`,
sparse-clone verified 2026-09-21) and `build_paid_chunks` refuses any non-zero
quote without its tx entry (`batch.rs:296+`). A flat tx array has no honest
mapping; per-quote pairs support both the many-tx wave shape and any single-tx
batching that slice W composes.

## Ant-core facts already measured (for the wiring slice)

- `Client::data_prepare_upload_with_visibility(content: Bytes, visibility)` —
  `data.rs:260`. **Wave-batch payment only** for the in-memory path: the door
  can never silently switch payment arms. Public visibility bundles the
  serialized DataMap as an extra chunk and returns its address.
- `PreparedUpload` stays in Rust memory (non-serializable network types,
  `file.rs:1430` note) — the DOOR owns persistence keyed by `upload_id`;
  finalize-after-restart follows the receipt's re-prepare law (identical bytes
  re-prepare to the same quote hashes; `docs/receipts/bpay-quote-try-autonomi-2026-09-17.md`).
- `PaymentIntent` = `payments: Vec<(QuoteHash, RewardsAddress, Amount)>` +
  `total_amount` (`batch.rs:256`) — the wire shape above, verbatim.
- The installed gateway's `/health` (antd v0.12.0, restored 2026-09-21 06:52Z)
  names `payment_token_address 0xa78d…b684` and
  `payment_vault_address 0x9A3E…0A26` — installed-client corroboration for
  slice W's evmlib file:line read.

## Deploy shape (laborer hands, post-PASS — nothing here is deployed by this PR)

```
# Caddy (relay.skaists.dev site block) — three routes, GET/POST named per
# path, per-IP rate_limit shared with the read route's zone shape; every
# other /ant/ write stays at the existing 403:
handle /ant/v1/upload/prepare {
  rate_limit zone ant_write { key {remote_host} events 6 window 1m }
  method GET POST OPTIONS   # GET probe + POST prepare (+ preflight)
  reverse_proxy 127.0.0.1:8095
}
handle /ant/v1/upload/finalize {
  rate_limit zone ant_write { key {remote_host} events 6 window 1m }
  method POST OPTIONS       # POST finalize (+ preflight)
  reverse_proxy 127.0.0.1:8095
}
```

Ceiling default: 32 MiB (`ANT_DOOR_MAX_BYTES`), ruling 2026-09-21. Allowed
origin default: `https://skaists.dev` (`ANT_DOOR_ALLOWED_ORIGIN`). Listen
default: `127.0.0.1:8095` (`ANT_DOOR_LISTEN`).

## Tests — mainnet spend ZERO

`cargo test --manifest-path ops/ant-writedoor/Cargo.toml` — the only gateway
in the battery is the shape-only `MockGateway` (std-hasher addresses, no
network possible). The battery covers: open/closed probe, the pinned response
shape (decimal-string total == quote sum), path refusal, content-type
refusal, both over-ceiling refusals, exact-origin preflights with named
methods and never a wildcard, the round trip with address equality, the three
payment-shape refusals, unknown upload, non-hex refusal, door-side address
mismatch, and restart = the re-prepare law.

### Mutation legs (bFUzZ — the count must say it moved)

- strip the ceiling checks → both `too_large` rows fall
- strip the path refusal → `path_refused` row falls
- strip the CORS echo/preflight → `cors` and preflight rows fall
- strip address equality → `address_mismatch` row falls
- strip the payment-shape checks → `double_pay` / `unknown_quote` /
  `missing_quote_tx` rows fall

## Slices

1. **THIS PR** — HTTP contract + trait + mock + battery + CI leg. The unwired
   gateway is the honest closed door.
2. **ant-wiring** — the ant-core `Client` composition behind
   `AntGateway` at a pinned sha, plan persistence, bootstrap peers, live
   measurement (laborer hands).
