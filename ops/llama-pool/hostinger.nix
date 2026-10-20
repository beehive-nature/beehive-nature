# Hostinger member + the pool door (INTERCHANGEABLE AGENT, Phase 1).
# AUTHORED AHEAD OF THE BOX: not yet applied; the founder applies it
# through the hPanel rebuild and this file lands verbatim (ops/ law:
# in-tree and on-box must never diverge silently).
#
# Shape: Caddy is the door. It health-checks every member on /health,
# fails over across healthy members, and demands the pool key. Members
# themselves bind mesh-only (see llama-server.nix) and hold no secrets.
#
# Sovereignty law (issue #479): this door is an OPTIONAL, REPLACEABLE
# adapter — never an architectural dependency and never an authority.
# Agents may point at any member door or compatible gateway; the pool
# survives this door's disappearance. Egress law: the door's bandwidth
# is funded by the pool operator's authorized budget only. The pool key
# IS the payer authorization — no key, no service (401 below), and a
# hard per-key rate ceiling (rate-limit module, deploy-time) refuses
# once the budget is spent. There is no estate-funded fallback route.
{ config, lib, pkgs, ... }:

{
  imports = [
    (import ./llama-server.nix {
      member = "hostinger";
      # DEPLOY-TIME: this host's mesh address (existing compute rail
      # binds the bridge at 172.18.0.1 — see ops/bmeshllm/README.md).
      bindAddress = "172.18.0.1";
      port = 8091;
      # Staged upgrade model (ops/bmeshllm: staged 2026-09-15, on disk).
      modelPath = "/opt/buzz-compute/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf";
      threads = 3;
    })
  ];

  services.caddy = {
    enable = true;
    # The pool key is delivered by environment file on the box, never by
    # this repo: create /var/lib/llama-pool/door.env (root, 0600) with
    #   POOL_KEY=<the pool key>
    # Caddy substitutes {$POOL_KEY} from its environment at startup.
    virtualHosts."llm.door" = {
      # DEPLOY-TIME: replace llm.door with the real door hostname.
      extraConfig = ''
        @nokey not header Authorization "Bearer {$POOL_KEY}"
        handle @nokey {
          respond "unauthorized" 401
        }
        reverse_proxy 172.18.0.1:8091 ORACLE_MESH_ADDR:8091 {
          lb_policy round_robin
          health_uri /health
          health_interval 10s
          health_timeout 5s
          fail_duration 30s
          max_fails 1
        }
      '';
    };
  };

  systemd.services.caddy.serviceConfig.EnvironmentFile =
    "/var/lib/llama-pool/door.env";

  # The door host's public edge is Caddy's 443, opened by the host's own
  # existing Caddy configuration; no llama port is ever opened here.
}
