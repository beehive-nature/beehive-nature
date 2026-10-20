# llama-pool member — one llama.cpp server as a declarative NixOS service.
# INTERCHANGEABLE AGENT, Phase 1 (authored ahead of the boxes; NOT applied).
#
# Import this from a host module with the member's facts:
#   imports = [ (import ./llama-server.nix {
#     member = "hostinger";            # hostinger | oracle | laptop
#     bindAddress = "172.18.0.1";      # DEPLOY-TIME: this host's MESH address
#     port = 8091;
#     modelPath = "/var/lib/llama-pool/models/model.gguf";
#   }) ];
#
# Laws baked in:
#   * mesh-only bind — llama-server binds ONLY the given mesh address and
#     no firewall port is opened; the door (Caddy, Hostinger) is the sole
#     public edge and it reaches members over the mesh.
#   * restart-on-failure — a dead member comes back without a human.
#   * no secrets in this file or repo — llama-server needs none; the pool
#     key lives at the door, never on members.
{ member, bindAddress, port, modelPath, threads ? 3, ctxSize ? 16384 }:

{ config, lib, pkgs, ... }:

{
  systemd.services."llama-server-${member}" = {
    description = "llama-pool member ${member} (llama.cpp, mesh-only)";
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      Type = "simple";
      # DEPLOY-TIME: pin the built llama.cpp store path or install
      # llama-cpp into the host profile; /var/lib path follows ops/x0x law.
      ExecStart = lib.concatStringsSep " " [
        "/var/lib/llama-pool/bin/llama-server"
        "--host ${bindAddress}"
        "--port ${toString port}"
        "--model ${modelPath}"
        "--threads ${toString threads}"
        "--ctx-size ${toString ctxSize}"
        "--parallel 1"
        "--cont-batching"
        "--cache-type-k q8_0"
        "--cache-type-v q8_0"
        "-fa on"
        "--alias llama-pool"
      ];
      Restart = "on-failure";
      RestartSec = 5;
      DynamicUser = true;
      StateDirectory = "llama-pool";
      # resource caps (same discipline as ops/x0x/x0x.service)
      MemoryMax = "6G";
      CPUQuota = "300%";
      TasksMax = 64;
      # hardening
      NoNewPrivileges = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      PrivateTmp = true;
      ProtectKernelTunables = true;
      ProtectKernelModules = true;
      ProtectControlGroups = true;
      RestrictAddressFamilies = "AF_INET AF_INET6 AF_UNIX";
      LockPersonality = true;
      RestrictRealtime = true;
      RestrictSUIDSGID = true;
      CapabilityBoundingSet = "";
      ReadOnlyPaths = [ modelPath ];
    };
  };

  # Deliberately NO networking.firewall entry: the member is mesh-only.
  # If a future change wants a public port, that is a founder gesture.
}
