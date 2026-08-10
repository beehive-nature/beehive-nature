# Phase 0 node garden — NixOS module (PHASE0_AR_ANT_SETUP_SPEC steps 1-3).
# AUTHORED AHEAD OF THE VPS: not yet applied to a live box; the spec's
# VERIFICATION section is the acceptance gate.
#
# ar-io-node runs via upstream's docker-compose, UNMODIFIED (AGPL-3.0 stays
# clean: unmodified network use, no fork to disclose). antnode runs native.
# No key material lives in this file or this repo — see the env files below.
{ config, lib, pkgs, ... }:

{
  virtualisation.docker.enable = true;

  # ---- ar-io-node: self-hosted AR gateway, NO-TOKEN mode -------------------
  # Runs upstream compose from /var/lib/bnr/ar-io-node (cloned at deploy time)
  # with our .env (ops/phase0/ar-io-node.env — AR_IO_WALLET unset = no token,
  # no staking). Ports: 3000 envoy (public edge), 4000 core (GraphQL).
  systemd.services.bnr-ar-io-node = {
    description = "BNR self-hosted ar.io gateway (no-token mode)";
    after = [ "docker.service" "network-online.target" ];
    requires = [ "docker.service" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];
    path = [ pkgs.docker ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      WorkingDirectory = "/var/lib/bnr/ar-io-node";
      ExecStart = "${pkgs.docker}/bin/docker compose up -d";
      ExecStop = "${pkgs.docker}/bin/docker compose down";
    };
  };

  # ---- Autonomi nodes x2: storage farming + chunk hosting ------------------
  # antnode binary comes from the autonomi checkout (spec: "from ~/autonomi/");
  # pin the store path at deploy time. CUSTODY (storage-substrate-split item 8):
  # the node wallet SECRET_KEY lives ONLY in /var/lib/bnr/antnode.env, root-owned
  # mode 600, created by hand at deploy. Infrastructure wallet, never a user key.
  systemd.services."bnr-antnode@" = {
    description = "BNR Autonomi node %i (storage farming)";
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    serviceConfig = {
      # DEPLOY-TIME PLACEHOLDER: point at the built antnode binary.
      ExecStart = "/var/lib/bnr/bin/antnode --root-dir /var/lib/bnr/antnode-%i";
      EnvironmentFile = "/var/lib/bnr/antnode.env";
      Restart = "on-failure";
      RestartSec = 30;
      DynamicUser = false;
      StateDirectory = "bnr/antnode-%i";
    };
  };

  # Enable two instances (bnr-antnode@1, bnr-antnode@2); a third is one line.
  systemd.targets.multi-user.wants = [ "bnr-antnode@1.service" "bnr-antnode@2.service" ];

  # Edge: envoy 3000 (public), core 4000 (GraphQL, LAN/relay only by default).
  networking.firewall.allowedTCPPorts = [ 3000 ];
}
