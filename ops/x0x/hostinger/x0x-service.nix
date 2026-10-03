{ pkgs, ... }:
let
  x0xPackage = pkgs.stdenvNoCC.mkDerivation {
    pname = "x0x";
    version = "0.46.0";
    src = pkgs.fetchurl {
      url = "https://github.com/saorsa-labs/x0x/releases/download/v0.46.0/x0x-linux-x64-musl.tar.gz";
      hash = "sha256-eZQZQenXIxEFXPbtYoKcSmOrq4bcdGDSBP3LdNUO0Ko=";
    };
    dontConfigure = true;
    dontBuild = true;
    dontFixup = true;
    installPhase = ''
      mkdir -p $out/bin $out/share/x0x
      install -m755 x0xd x0x $out/bin/
      cp LICENSE-MIT LICENSE-APACHE build-provenance.json $out/share/x0x/
    '';
  };
in {
  environment.systemPackages = [ x0xPackage ];
  users.groups.x0x = {};
  users.users.x0x = {
    isSystemUser = true;
    group = "x0x";
    home = "/var/lib/x0x";
  };
  environment.etc."x0x/x0xd.toml".source = ./x0xd.toml;
  systemd.services.x0x = {
    description = "Always-on x0x node for the Buzz Hostinger estate";
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
      ExecStartPre = "${x0xPackage}/bin/x0xd --config /etc/x0x/x0xd.toml --check";
      ExecStart = "${x0xPackage}/bin/x0xd --config /etc/x0x/x0xd.toml --skip-update-check";
      Restart = "on-failure";
      RestartSec = 5;
      TimeoutStopSec = 30;
      MemoryMax = "1G";
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
    };
  };
}