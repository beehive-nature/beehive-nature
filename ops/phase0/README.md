# Phase 0 — AR/ANT node garden (authored ahead of the VPS)

Per `docs/dispatches/PHASE0_AR_ANT_SETUP_SPEC.md`: ar-io-node (Docker, no-token,
no-staking) + 2x Autonomi nodes + the storage routing rule. **Authored now, deployed
when the box arrives — nothing here is verified against live infra yet**, and the
VERIFICATION section of the spec is the acceptance gate, not this README.

## Files

| file | what |
|---|---|
| `configuration.nix` | NixOS module: Docker + ar-io-node (upstream compose, unmodified) + 2x antnode systemd services |
| `ar-io-node.env` | Our env for upstream's `docker-compose.yaml` — **no-token mode** (`AR_IO_WALLET` unset, no staking) |

The routing rule (spec step 6) is code, not ops: `crates/atmirror/src/route.rs`.

## Deploy (when the VPS exists)

1. Import `configuration.nix` from the box's `/etc/nixos/configuration.nix`
   (`imports = [ ./bnr-phase0.nix ];`), set the placeholder paths, `nixos-rebuild switch`.
2. `git clone https://github.com/ar-io/ar-io-node /var/lib/bnr/ar-io-node` and copy
   `ar-io-node.env` to `/var/lib/bnr/ar-io-node/.env`. We run upstream's compose
   **unmodified** (AGPL-3.0: unmodified network use; if we ever patch it, the fork gets
   published — CLAUDE.md AGPL note).
3. Autonomi custody (storage-substrate-split item 8): create `/var/lib/bnr/antnode.env`
   root-owned mode 600 with the node wallet `SECRET_KEY`. **Infrastructure cost wallet,
   not user funds; never a user key, never in this repo.**
4. `systemctl start bnr-ar-io-node bnr-antnode@1 bnr-antnode@2`

## Acceptance (from the spec — run these on the box, receipts into the mailbox)

- GraphQL query answered by OUR gateway (port 4000), not arweave.net
- Autonomi chunk upload + download round-trip on the live network
- Take ar-io-node down; reads still work via the fallback list
