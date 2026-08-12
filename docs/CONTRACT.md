# RELAY ↔ UI CONTRACT v0.1
## wallet-relay API surface for bDashBoard

Backend: goose (wallet-relay crate). Frontend: Claude Design.
This file at origin is the binding contract. Changes here before UI binds.

---

## Naming
**bStore** = the storage service/tile/product (display name). formerly "DeStorage."
**bData** = public chunks (data-layer noun, unchanged).
**zbData** = private encrypted bytes (data-layer noun, unchanged).
Routes and API paths are NOT renamed — this is a display/product-name change.

## 1. Base URL + CORS

| Environment | Base URL | CORS |
|---|---|---|
| Dev | `http://localhost:8080` | Same-origin (relay serves dashboard statics) |
| VPS | `https://relay.bnature.social` | `tower-http` CorsLayer — TODO |

Config: `RELAY_PORT` env var (default 8080). Binds `0.0.0.0`.

## 2. Upload endpoint (Phase-0 step-5)

**`POST /v1/upload`**

Request:
- Content-Type: `application/octet-stream`
- Body: raw ANS-104 DataItem binary (user-signed **Ed25519**, type 2)

Response 200:
```json
{
  "accepted": {
    "id": "base64url DataItem ID",
    "owner": "base64url signer pubkey",
    "item_bytes": 123,
    "data_bytes": 100,
    "route": "arweave | autonomi | arweave+autonomi-mirror"
  },
  "forwarded": false
}
```

Response 400 (typed refusal):
```json
{ "refused": "BadSignature | NotEd25519 | Malformed | TooLarge" }
```

Auth: relay verifies the DataItem signature before forwarding. Never holds keys.
Forward: only Arweave-routed items when `RELAY_FORWARD_TO` is set.

RSA-4096 (type 1, native JWK via `adapter-arweave`): planned addition.

## 3. Heartbeat feed (mesh presence tile)

**`GET /v1/mesh/heartbeat`** — PLANNED (not yet implemented)

Poll response 200 (SSE upgrade planned):
```json
{
  "node_id": "string",
  "model_name": "Qwen3-30B-A3B",
  "fit_score": 1.0,
  "quantization": "Q4_K_M",
  "gpu": "RTX 4090",
  "vram_total_gb": 24.0,
  "vram_used_gb": 18.5,
  "status": "serving",
  "last_seen_iso": "ISO-8601",
  "b_metered_tokens_this_epoch": 1500000
}
```

## 4. Gateway-list config (§8 criterion-10)

Config: `RELAY_GATEWAYS` env var (comma-separated, self-hosted first).

Default pool:
1. `http://127.0.0.1:3000` — self-hosted ar-io-node
2. `https://arweave.net` — public fallback
3. `https://permagate.io` — public fallback

Every read response includes `"gateway_used": "<url>"` (which gateway answered).
The dashboard MUST NOT hardcode any gateway URL.

**`GET /healthz`** reports pool health:
```json
{
  "gateways": [
    { "gateway": "url", "consecutive_failures": 0, "degraded": false }
  ],
  "forward_configured": false
}
```

## 5. Read-only AR balance

**`GET /v1/arweave/balance/{address}`**

Address: 43-char base64url Arweave address. No key, no signing — pure public REST.

Response 200:
```json
{
  "address": "string",
  "balance_winston": "string (integer)",
  "balance_ar": "string (decimal, 12 places)",
  "gateway_used": "string (which gateway answered)",
  "tier": "T-S"
}
```

Response 502:
```json
{ "error": "all gateways failed", "gateways_tried": 3 }
```

Test address: `6tlCkGE8...` (founder ArDrive keyfile — full 43-char address TBD).

## 5b. Upload read-back (seam 2 completion)

**`GET /v1/arweave/status/{tx_id}`**

Response 200:
```json
{
  "id": "string (tx id)",
  "found": true,
  "confirmed": false,
  "data_size": 0,
  "gateway_used": "string (which gateway answered)"
}
```

`confirmed: true` when the tx has a block height (mined). `confirmed: false` when
the tx exists but is pending. `found: false` when no gateway knows this tx id.

The upload control flow: POST /v1/upload → get tx_id → poll GET /v1/arweave/status/{tx_id} → render confirmed + data_size.

## 5c. Upload price (fee preview)

**`GET /v1/arweave/price/{bytes}`**

Response 200:
```json
{
  "winston": "string (integer reward)",
  "gateway_used": "string"
}
```

Pre-upload fee preview so the dashboard shows cost before the user signs.

## 5d. Multi-rail balance endpoints (Pillar 2)

**`GET /v1/stellar/balance/{address}`**
```json
{ "address": "...", "balances": [...], "native_xlm": "...", "gateway_used": "https://horizon.stellar.org", "tier": "T-S" }
```
Source: `https://horizon.stellar.org/accounts/{address}` (public REST, no key).

**`GET /v1/solana/balance/{address}`**
```json
{ "address": "...", "balance_lamports": 0, "balance_sol": "0.000000000", "gateway_used": "https://api.mainnet-beta.solana.com", "tier": "T-H" }
```
Source: `https://api.mainnet-beta.solana.com` JSON-RPC `getBalance`.

**`GET /v1/hive/balance/{address}`**
```json
{ "address": "...", "hive_power": "0", "rc_mana": "0", "rc_mana_pct": "0.0", "gateway_used": "https://api.hive.blog", "tier": "T-S" }
```
Source: `https://api.hive.blog` JSON-RPC `database_api.find_accounts` + `rc_api.find_rc_accounts`.

**`GET /v1/vaulta/balance/{address}`**
```json
{ "address": "...", "liquid_balance": "...", "cpu_available": 0, "net_available": 0, "ram_usage_bytes": 0, "ram_quota_bytes": 0, "gateway_used": "https://wax.eosrio.io", "tier": "mixed" }
```
Source: `https://wax.eosrio.io/v1/chain/get_account`. Tier: owner/active=T-H target, custom PUB_WA=T-F.

## Also available

- `POST /graphql` — Arweave GraphQL proxy through the pool (bundled-item lookups)
- `GET /raw/{id}` — raw tx/data-item bytes through the pool

## Gates on infrastructure (not code)

- ar-io-node live on VPS → turns stub forward into real upload
- Buzz relay + bMeshLLM node → turns heartbeat stub into live presence
- RSA-4096 DataItem support → adapter-arweave integration into upload validation
