# x0xd — the x0x daemon on buzz-hostinger (STAGING, not applied).
#
# Follows the estate's own pattern (ops/x0x/hostinger/x0x-service.nix on the
# branch): pinned musl release tarball from saorsa-labs/x0x, dedicated `x0x`
# system user, loopback-only API at 127.0.0.1:12700, P2P bind 0.0.0.0:5483.
#
# What this module does NOT do: it does not decide the daemon's mesh
# identity, bootstrap peers, or ACLs — those live in x0xd.toml, which the
# operator provides. The x0x-control agent consumes the daemon's messaging;
# the daemon itself is transport, never authority.
#
# Honest unknowns (verify on the box before deploy):
# * The pinned hash below is copied from ops/x0x/hostinger/x0x-service.nix
#   as recorded on the branch — it was NOT independently re-verified against
#   the GitHub release. Run `nix-prefetch-url <url>` and compare before
#   first deploy; nix will also fail loudly on mismatch.
# * Whether x0xd is already running on buzz-hostinger under another unit.
#   If it is, reconcile (one daemon per box) instead of stacking this one.
{ config, lib, pkgs, ... }:

let
  cfg = config.services.x0xd;

  x0xPackage = if cfg.binaryPath != null then null else pkgs.stdenvNoCC.mkDerivation {
    pname = "x0x";
    version = cfg.version;
    src = pkgs.fetchurl {
      url = "https://github.com/saorsa-labs/x0x/releases/download/v${cfg.version}/x0x-linux-x64-musl.tar.gz";
      hash = cfg.hash;
    };
    dontConfigure = true;
    dontBuild = true;
    dontFixup = true;
    installPhase = ''
      mkdir -p $out/bin $out/share/x0x
      install -m755 x0xd x0x $out/bin/
      cp LICENSE-MIT LICENSE-APACHE build-provenance.json $out/share/x0x/ 2>/dev/null || true
    '';
  };

  bin = if cfg.binaryPath != null then cfg.binaryPath else "${x0xPackage}/bin/x0xd";
in
{
  options.services.x0xd = {
    enable = lib.mkEnableOption "x0x daemon (post-quantum P2P transport)";

    version = lib.mkOption {
      type = lib.types.str;
      default = "0.46.0";
      description = "Pinned x0x release version (musl tarball).";
    };

    hash = lib.mkOption {
      type = lib.types.str;
      default = "sha256-eZQZQenXIxEFXPbtYoKcSmOrq4bcdGDSBP3LdNUO0Ko=";
      description = ''
        SRI hash of the release tarball, as recorded in
        ops/x0x/hostinger/x0x-service.nix. NOT independently re-verified:
        run nix-prefetch-url on the URL and compare before first deploy.
      '';
    };

    binaryPath = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        Manual-install override: path to an x0xd binary already on the
        box (e.g. /var/lib/x0x/bin/x0xd). When set, the fetchurl build is
        skipped. The operator is responsible for the binary's provenance.
      '';
    };

    configFile = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/x0x/x0xd.toml";
      description = ''
        x0xd config path. Must set api_address to a loopback address
        (127.0.0.1:12700 per estate convention), bind_address 0.0.0.0:5483,
        and the box's mesh identity/bootstrap. An example lives next to
        this module as x0xd.toml.example.
      '';
    };

    memoryMax = lib.mkOption { type = lib.types.str; default = "1G"; description = "systemd MemoryMax."; };
  };

  config = lib.mkIf cfg.enable {
    # x0x P2P port. Already open on buzz-hostinger; declarative + idempotent.
    networking.firewall.allowedUDPPorts = [ 5483 ];

    users.groups.x0x = { };
    users.users.x0x = {
      isSystemUser = true;
      group = "x0x";
      home = "/var/lib/x0x";
      description = "x0x daemon (post-quantum P2P transport)";
    };

    systemd.services.x0x = {
      description = "x0x daemon — post-quantum P2P transport for the estate";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      serviceConfig = {
        Type = "simple";
        User = "x0x";
        Group = "x0x";
        StateDirectory = "x0x";
        StateDirectoryMode = "0700";
        UMask = "0077";
        ExecStartPre = "${bin} --config ${cfg.configFile} --check";
        ExecStart = "${bin} --config ${cfg.configFile} --skip-update-check";
        Restart = "always";
        RestartSec = 5;
        TimeoutStopSec = 30;
        MemoryMax = cfg.memoryMax;
        MemoryHigh = "768M";
        CPUQuota = "100%";
        TasksMax = 128;
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        CapabilityBoundingSet = "";
        RestrictSUIDSGID = true;
        IPAccounting = true;
        RestrictAddressFamilies = "AF_INET AF_INET6 AF_UNIX";
      };
    };
  };
}
