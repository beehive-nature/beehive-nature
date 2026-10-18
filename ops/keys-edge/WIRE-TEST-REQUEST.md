# Outside wire test of the keys TLS policy on the live Hostinger listener: permission request

Status: **NOT EXECUTED.** The edit below changes and reloads the production reverse proxy
(`buzz-prod-caddy-1` on 2.25.245.161, shared with `relay.skaists.dev` and `skaists.buzz`). The app's
permission check refused it on 2026-10-13; it runs only with an explicit operations permission for
exactly this change. Lab results (`lab/lab.sh`, GitHub Actions) are not production evidence, and no
other listener stands in for this one.

## The change (temporary, no DNS)

Append to `/opt/buzz/deploy/compose/Caddyfile.hostinger` the `Caddyfile.keys` block with exactly
three edits: the site name `keys-tls-probe.invalid` (in the address and the SNI guard; `.invalid`
never resolves), `issuer internal` (Caddy's own CA; no ACME request), and a fixed reply in place of
`reverse_proxy` (no keys-door, no keychain bytes):

```diff
-keys.skaists.dev {
+keys-tls-probe.invalid {
   tls {
     protocols tls1.3
     curves x25519mlkem768
     key_type p256
+    issuer internal
   }
-  @misdirected expression `{http.request.tls.server_name} != "keys.skaists.dev"`
+  @misdirected expression `{http.request.tls.server_name} != "keys-tls-probe.invalid"`
   @notRead not method GET HEAD
   route {
     respond @misdirected 421 {
       close
     }
     respond @notRead 405
     header { … unchanged … }
-    reverse_proxy 10.80.96.2:8096
+    respond "keys tls staging: not the keychain" 200
   }
 }
```

## Procedure (ops/watch/hostinger/README.md:27-34)

1. Health before: `relay.skaists.dev/join.json` and `skaists.buzz/` return 200 from outside;
   record status and certificate fingerprint of each.
2. Back up: `cp -p Caddyfile.hostinger Caddyfile.hostinger.bak-keys-tls-staging-<UTC>`; record its sha256.
3. Validate the candidate inside the running container:
   `docker exec buzz-prod-caddy-1 caddy validate --config /tmp/Caddyfile.candidate --adapter caddyfile`.
   Stop here on any error.
4. Apply in place (keep the bind mount's inode): `cat candidate > Caddyfile.hostinger`, then
   `docker exec buzz-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
5. Health after: the same two checks; any change in status or certificate → roll back at once.

## Probes (bounded: one run, from outside vantages)

From a GitHub runner (outside) and from this laptop (handshake-bearing results only), with OpenSSL ≥ 3.5,
against 2.25.245.161:443 and [2a02:4780:95:222e::1]:443 separately, SNI `keys-tls-probe.invalid`:

- control `-tls1_3 -groups X25519MLKEM768` → handshake, group reported, certificate issued by the
  internal CA (P-256);
- `-groups X25519`, `-groups secp256r1`, `-groups X448`, `-tls1_2` → each refused by alert;
- resumption: save a session from the control (`-sess_out`), reconnect with `-sess_in` offering
  only `X25519` → refused or a fresh hybrid handshake, never a resumed classical session; and with
  `-allow_no_dhe_kex` → no resumption without (EC)DHE;
- alternate route: SNI `relay.skaists.dev` with `Host: keys-tls-probe.invalid` → 421; no SNI → no
  staging reply;
- HTTP/3: UDP 443 is not published on this host (`docker ps`: `443/udp` unmapped); record a UDP
  probe result as observed.

## Rollback

Restore the backup's contents in place (`cat Caddyfile.hostinger.bak-keys-tls-staging-<UTC> >
Caddyfile.hostinger`), reload as in step 4, rerun the health checks, and confirm the live file's
sha256 equals the backup's (and the repo mirror `ops/watch/hostinger/Caddyfile.hostinger`).
The staging block is removed after the probes in every case.
