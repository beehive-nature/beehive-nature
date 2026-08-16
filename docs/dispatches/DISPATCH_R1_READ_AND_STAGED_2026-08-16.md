# DISPATCH — R-1 read and staged: bBuzz relay deploy for the Oracle box

**Lane:** R-1 (orientation §7a) · **Seat:** zCode (GLM 5.3), first lane
**Landed by:** Seat 3, after independent spot-verification · **2026-08-16**
**Status:** STAGED — script written and validated; three founder inputs remain before it runs.

---

## 1 · Every unknown settled by reading, not guessing

| unknown | settled |
|---|---|
| build/run path | **No build needed.** Upstream ships `deploy/compose/` + prebuilt multi-arch image `ghcr.io/block/buzz` — **arm64 manifest verified** (the box is aarch64; this would have bitten at pull time) |
| migrations | Embedded `sqlx::migrate!`, run at startup under `BUZZ_AUTO_MIGRATE=true` — no manual bootstrap |
| config | `deploy/compose/.env`: `RELAY_OWNER_PUBKEY` (64-hex), relay secp256k1 key, DB/Redis/S3 secrets, domain-derived URLs |
| ports | Caddy 80/443 (auto Let's Encrypt), relay 3000 internal. All three **free on the box** |
| Oracle's two firewall layers | OS iptables: catch-all REJECT at rule 10 — script inserts before it (`sudo -n` passwordless works). **Cloud security list is founder-only via console** — script prints the exact path |
| TLS | `compose.caddy.yml` on the founder's own hostname — nothing for the `*.buzz.xyz` SNI filter to match |
| image pinning | sha-tagged images stop at **2026-06-16 (2 months stale)**. Deploying `:main`; script records the resolved digest to `/opt/buzz/IMAGE-PIN.txt` |
| fork delta | `skaists/buzz`'s own commit is a README edit — **zero deploy relevance**; the external-S3 change lives as an untracked compose override on the box, outside the fork as ruled |

## 2 · Correction to the orientation (§7a decision 4)

**NIP-42 `auth_required` is always true in buzz** (`crates/buzz-relay/src/nip11.rs:114`) — it
is not settable, so it is not the portability knob. The real gate is
**`BUZZ_REQUIRE_RELAY_MEMBERSHIP`** (closed-relay mode) + `RELAY_OWNER_PUBKEY`
(owner auto-bootstrapped, `relay_admin.rs:102`). The script defaults membership **true**
(spam protection on 4 CPUs; the founder's key works immediately), with the trade stated in
the `.env` comment. A per-relay roster, not a protocol lock — the npub still works on any
relay that admits it.

## 3 · A real bug caught by validating on the box

Compose merges `depends_on` **per-key**, so profiling MinIO out silently leaves the relay
depending on an undefined service. First attempt failed exactly that way. Fix:
`depends_on: !override` (requires Compose ≥ 2.24.4 — the exact minimum upstream's README
names; the box has 2.40.3). Re-test: exactly four services (postgres, redis, relay, caddy),
external S3 endpoint correctly substituted.

## 4 · The deliverable

`C:\Users\travi\buzz-relay-deploy.sh` — staged, `sh -n` clean, npub→hex bech32 decoder
round-trip verified against an independent encoder. Modeled on `oracle-setup.sh`:
refuses loudly (two-resolver DNS check, `*.buzz.xyz` domains rejected outright, local
MinIO refused without an explicit override flag), announces every state change, generates
all secrets **on the box**, idempotent.

```
wsl -e sh /mnt/c/Users/travi/buzz-relay-deploy.sh <domain> <npub-or-hex> \
  --s3-endpoint https://... --s3-access-key ... --s3-secret-file C:\path\secret.txt
```

## 5 · Seat 3 verification (receipt rule applies to peer seats)

- script exists (21,282 B), `sh -n` SYNTAX OK re-run independently
- claimed properties grep-confirmed: buzz.xyz refusal ×2, s3-secret-file ×4, IMAGE-PIN,
  BUZZ_REQUIRE_RELAY_MEMBERSHIP, RELAY_OWNER_PUBKEY ×2, `!override` ×4, REFUSED ×12
- secret path read in full: file → ssh stdin → mode-600 temp → `.env` → temp removed.
  **One noted nit:** the injection passes through a `sed` argument on the box —
  momentarily visible in the process list; acceptable on a founder-owned box, recorded here

## 6 · Founder-only, before it runs

1. hostname + A record → `129.153.202.144`
2. S3 credentials (**Autonomi's S3 compatibility is unverified — real S3 works today**)
3. after stand-up: OCI console ingress for 80/443 (cloud layer, console-only)

**Acceptance test as written in the lane: the founder's client, from the wifi that was
blocking him. Not a curl on the box.**

## 7 · Follow-on noted this session

Founder asked whether the local archive (kind 24200 observer frames / 44200 turn metrics,
SQLite) can back onto Autonomi. Yes, staged as a future lane: SQLite stays the working
tier; an archiver pushes chunks — **private-encrypted for frames, public immutable digests
for metrics**. Signed events make the archive verifiable by anyone against the agent's
pubkey, and per-machine history becomes per-identity. Turn metrics on Autonomi are the
natural audit trail for b-denominated compute settlement. `crates/adapter-autonomi`
already exists as the building block.
