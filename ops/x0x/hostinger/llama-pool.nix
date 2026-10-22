{ config, lib, pkgs, ... }:
{
  environment.systemPackages = [ pkgs.llama-cpp ];
  # extraInputRules (nft syntax) is silently dead in this box's iptables-backend firewall (proven 2026-10-20: generated firewall-start has no extra-rules section; live nixos-fw drops container->172.20.0.1:8091). Idempotent oneshot applies the rule instead.
  systemd.services."llama-pool-fw" = {
    description = "llama-pool: accept buzz-net containers to member 8091";
    after = [ "firewall.service" "docker.service" ];
    wants = [ "firewall.service" ];
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      ExecStart = "${pkgs.bash}/bin/bash -c '${pkgs.iptables}/bin/iptables -w -C nixos-fw -s 172.20.0.0/16 -p tcp --dport 8091 -j nixos-fw-accept 2>/dev/null || ${pkgs.iptables}/bin/iptables -w -I nixos-fw 1 -s 172.20.0.0/16 -p tcp --dport 8091 -j nixos-fw-accept'";
    };
  };
  systemd.services."llama-server-hostinger" = {
    description = "llama-pool member hostinger (llama.cpp)";
    after = [ "network-online.target" "docker.service" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      Type = "simple";
      ExecStart = "/run/current-system/sw/bin/llama-server --host 172.20.0.1 --port 8091 --model /var/lib/llama-pool/models/Qwen3.5-4B-UD-Q4_K_XL.gguf --threads 3 --ctx-size 16384 --parallel 1 --cont-batching --cache-type-k q8_0 --cache-type-v q8_0 -fa on --alias llama-pool";
      Restart = "on-failure";
      RestartSec = 5;
      DynamicUser = true;
      StateDirectory = "llama-pool";
      MemoryMax = "6G";
      CPUQuota = "300%";
      TasksMax = 64;
      NoNewPrivileges = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      PrivateTmp = true;
      LockPersonality = true;
      RestrictSUIDSGID = true;
      CapabilityBoundingSet = "";
      ReadOnlyPaths = [ "/var/lib/llama-pool/models/Qwen3.5-4B-UD-Q4_K_XL.gguf" ];
    };
  };
}
