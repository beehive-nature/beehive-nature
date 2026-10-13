# keys-edge: keys.skaists.dev on Hostinger

Contract: keychain release + edge, 2026-10-12 (§4 edge rules, §6 layout, §7 A1-A4). Host 2.25.245.161, NixOS 26.05.

- `buzz-prod-caddy-1` (caddy:2-rl, v2.11.4, 80/tcp + 443/tcp) terminates TLS for keys.skaists.dev with `Caddyfile.keys` and joins `keys-net` at 10.80.96.3.
- `keys-door` (this Dockerfile: keys-door + bsigner, uid 10096, read-only) runs from `compose.yml` on `keys-net` (10.80.96.0/29) at 10.80.96.2:8096. It publishes nothing, never joins `buzz-prod_buzz-net`, and reads ANT via https://relay.skaists.dev/ant (A3).
- Host: `/opt/keys-edge/edge.toml` (from `edge.toml.example`), `/opt/keys-edge/inbox/` (envelopes, mounted read-only). State lives in the `keys-edge_keys-state` volume.

Build from the repository root with the digests the lab printed for the same commit (step a): `docker build -f ops/keys-edge/Dockerfile --build-arg RUST_VERSION=… --build-arg RUST_IMAGE_DIGEST=… --build-arg RUNTIME_IMAGE_DIGEST=… --build-arg KEYS_DOOR_COMMIT=… -t keys-door:<commit> .` First confirm that `ip -4 route` shows nothing in 10.80.96.0/29. Then run `KEYS_DOOR_IMAGE=keys-door:<commit> docker compose -f ops/keys-edge/compose.yml up -d`.

Caddy joins keys-net now: `docker network connect --ip 10.80.96.3 keys-net buzz-prod-caddy-1`. To keep that across recreates, the caddy service in compose.hostinger.yml gains these lines (written here, not applied):

    services:
      caddy:
        networks:
          keys-net:
            ipv4_address: 10.80.96.3
    networks:
      keys-net:
        external: true

`docker compose -p buzz-prod -f compose.yml -f compose.hostinger.yml config` must then show caddy on both buzz-net and keys-net. compose.yml's caddy networks are not mirrored here, so that is UNVERIFIED. keys-net must exist before buzz-prod is recreated.

Apply the block (ops/watch/hostinger/README.md:27-34). The candidate is the host file plus the block, so no host change is lost:

    F=/opt/buzz/deploy/compose/Caddyfile.hostinger C=buzz-prod-caddy-1
    diff "$F" ops/watch/hostinger/Caddyfile.hostinger   # a difference is a host change the mirror lacks
    cat "$F" ops/keys-edge/Caddyfile.keys > /tmp/Caddyfile.keys-edge
    docker cp /tmp/Caddyfile.keys-edge "$C":/tmp/Caddyfile.keys-edge
    docker exec "$C" caddy validate --config /tmp/Caddyfile.keys-edge --adapter caddyfile
    cp -p "$F" "$F.keys-edge-$(date -u +%Y%m%dT%H%M%SZ)"   # backup
    cat /tmp/Caddyfile.keys-edge > "$F"                    # overwrite in place: the bind-mounted inode stays
    M=$(docker inspect -f '{{range .Mounts}}{{if eq .Source "'"$F"'"}}{{.Destination}}{{end}}{{end}}' "$C")
    docker exec "$C" caddy reload --config "$M" --adapter caddyfile

To roll back, `cat` the backup into `"$F"` and run the same reload. Restart nothing else.

Cutover order:
1. The lab is green on the commit, and the image is built with the digests it printed.
2. R-SIGNER is ruled and the genesis pins in edge.toml are filled. The ruled envelope is in the inbox and its pack is on a rail keys-door reads. The healthcheck shows healthy at that seq.
3. Caddy is on keys-net. Apply the block with the lab's one change, `issuer internal` under `key_type p256`. From a checkout of the commit on the host, run `bash ops/keys-edge/lab/lab.sh host /opt/keys-edge/inbox/<ruled envelope>.json`. It runs every step-e probe against 127.0.0.1 (curl `--resolve keys.skaists.dev:443:127.0.0.1`), trusting only the root it exports from `buzz-prod-caddy-1:/data/caddy/pki/authorities/local/root.crt` (`KEYS_EDGE_CADDY` names another container), and expects the release that envelope names. It needs docker and node, builds the lab tools image, starts one probe container on the host network and removes it; it never touches keys-door, keys-net, Caddy or their volumes. It must end with the summary and no `LAB FAIL` while DNS still names Pages. This mode has not run on the host yet (UNVERIFIED).
4. DNS: set an A record for keys.skaists.dev to 2.25.245.161 only. Add no AAAA until an IPv6 probe passes. Then apply the block as committed (no issuer line), validate and reload. Caddy gets its P-256 certificate once the ACME validators reach this host.
5. Run keychain-edge-probe (workflow_dispatch) on the public name. It must be green.
6. Detach the Pages custom domain only after that. The Pages deployment stays as the warm rollback: point DNS back and re-attach.

PQ ledger (claims stop at "sound by construction / isolated by design"):

| layer | mechanism | class |
|---|---|---|
| key exchange | TLS 1.3, X25519MLKEM768 only: no classical-only group, no TLS 1.2 | hybrid only |
| certificate | ACME, ECDSA P-256 | classical (no PQ WebPKI before ~2027) |
| release authority | ML-DSA-65 over record.json, two verifiers (fips204 + bsigner) | post-quantum; the edge serves only bytes the record names |
| anchors | Hive custom_json, Arweave | classical witnesses of existence and order; reported, never a serving gate |

A browser's trust in the page still rests on the classical certificate. The record limits what this edge serves; it cannot limit what a forged certificate could serve.

The lab: `.github/workflows/keychain-edge-lab.yml` runs `lab/lab.sh all`. `lab.sh chain` runs only its node part (step b); `lab.sh host ENVELOPE` is cutover step 3. Step f needs keys-door's chain endpoint (contract §7 A1): it fails, never skips, where keys-door lacks it. Its peer is plain http through a forwarder on keys-door #2's loopback, because keys-door trusts only the webpki roots compiled into it and no lab CA can stand behind an https peer, so the lab does not exercise a peer's TLS.
