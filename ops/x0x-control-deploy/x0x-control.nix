# x0x-control box agent — NixOS module (STAGING, not applied).
#
# The agent that retires SSH on estate boxes. Sealed ML-KEM-768 orders land
# in an inbox directory; this service polls the inbox and executes each order
# with `x0x-control serve-once` (the crate's only serve mode — one order per
# invocation, full verbatim receipt, nonce ledger against replays).
#
# Design decisions (judged, documented):
# * serve-once-per-order in a poll loop, NOT a long-running daemon: the crate
#   ships no long-running `serve` subcommand. A 5s poll loop over an inbox
#   dir is the honest shape today; a native `serve` mode is future crate
#   work. Each invocation is independent — a crash mid-order cannot corrupt
#   another order's receipt.
# * Runs as root by default: the privileged scopes (nixos-rebuild, nft,
#   docker, systemctl) cannot run under DynamicUser. The default-deny scope
#   policy IS the authorization boundary, and every order — run or refused —
#   lands a full verbatim receipt plus a ledger entry. Set `user` to a
#   lesser account only with a read-only policy file.
# * The KEM seed lives at `seedFile` (0600, created by the on-box keygen
#   ceremony). It is referenced by PATH ONLY — never embedded in the nix
#   store, never in this repo, never printed.
# * Inbox contract: the x0x daemon's message handler (or the operator's
#   bridge script) writes each sealed envelope JSON to `inbox/` with an
#   atomic write+rename as `<order-id>.order.json`. The loop moves each file
#   to `processing/` before executing, so a second loop (or a restart) can
#   never double-execute.
#
# Import from the host flake, e.g. /etc/nixos/buzz-hostinger/configuration.nix:
#   imports = [ /path/to/x0x-control.nix ];
#   services.x0x-control.enable = true;
{ config, lib, pkgs, ... }:

let
  cfg = config.services.x0x-control;

  loop = pkgs.writeShellScriptBin "x0x-control-loop" ''
    set -eu
    BASE="${cfg.stateDir}"
    INBOX="$BASE/inbox"
    PROC="$BASE/processing"
    DONE="$BASE/done"
    OUTBOX="$BASE/outbox"
    mkdir -p "$INBOX" "$PROC" "$DONE" "$OUTBOX"
    BIN="${cfg.binaryPath}"
    while true; do
      for f in "$INBOX"/*.order.json; do
        [ -e "$f" ] || continue
        id=$(basename "$f" .order.json)
        # atomic claim: move out of the inbox before executing
        mv "$f" "$PROC/$id.order.json"
        set +e
        ${pkgs.coreutils}/bin/timeout 600 "$BIN" serve-once \
          --seed "${cfg.seedFile}" \
          --policy "${cfg.policyFile}" \
          --ledger "$BASE/ledger" \
          --in "$PROC/$id.order.json" \
          --out "$OUTBOX/$id.receipt.json" \
          ${lib.optionalString cfg.receiptSigning.enable
            "--bsigner ${cfg.receiptSigning.bsignerBin} --sign-key-id ${cfg.receiptSigning.keyId} --sign-keydir ${cfg.receiptSigning.keydir} --rec-env ${cfg.receiptSigning.recEnvVar}"}
        rc=$?
        set -e
        # receipt (or refusal) is recorded; the envelope never re-enters the inbox
        mv "$PROC/$id.order.json" "$DONE/$id.order.json"
        echo "x0x-control: order $id finished rc=$rc" >&2
      done
      sleep ${toString cfg.pollSeconds}
    done
  '';
in
{
  options.services.x0x-control = {
    enable = lib.mkEnableOption "x0x-control box agent (ML-KEM-768 sealed orders)";

    binaryPath = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/x0x-control/bin/x0x-control";
      description = ''
        Path to the x0x-control binary on the box. The estate pattern
        (see ops/llama-pool/llama-server.nix) installs host-built binaries
        under /var/lib; set this to a nix store path instead if you package
        the crate.
      '';
    };

    stateDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/x0x-control";
      description = "State dir: seed, policy, ledger, inbox/outbox. Created by keygen ceremony, not by nix.";
    };

    seedFile = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/x0x-control/seed.b64";
      description = ''
        File holding the base64 64-byte KEM seed (0600, root-owned).
        Created ON THE BOX by `x0x-control keygen`. Referenced by path
        only — never lands in the nix store.
      '';
    };

    policyFile = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/x0x-control/policy.json";
      description = "Default-deny scope policy JSON (see policy.example.json next to this module).";
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "root";
      description = ''
        Service user. Root is the default because the control plane's
        privileged scopes (nixos-rebuild, nft, docker, systemctl) cannot
        run under DynamicUser. The default-deny policy is the
        authorization boundary. Use a lesser user only with a read-only
        policy.
      '';
    };

    pollSeconds = lib.mkOption {
      type = lib.types.ints.positive;
      default = 5;
      description = "Inbox poll interval in seconds.";
    };

    receiptSigning = {
      enable = lib.mkEnableOption "bsigner-signed receipts (delegates to the frozen bsigner CLI)";
      bsignerBin = lib.mkOption {
        type = lib.types.str;
        default = "/var/lib/bsigner/bin/bsigner";
        description = "Path to the bsigner binary used to sign receipts.";
      };
      keyId = lib.mkOption { type = lib.types.str; default = ""; description = "bsigner --key-id for receipt signatures."; };
      keydir = lib.mkOption { type = lib.types.str; default = ""; description = "bsigner --keydir for receipt signatures."; };
      recEnvVar = lib.mkOption {
        type = lib.types.str;
        default = "";
        description = ''
          NAME of the env var holding the bsigner recovery secret (passed
          as --rec-env VAR; the secret itself never appears in argv). Load
          it via EnvironmentFile, e.g. /var/lib/x0x-control/bsigner-rec.env
          (0600) containing X0X_BSIGNER_REC=<secret>.
        '';
      };
      recEnvFile = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "Optional EnvironmentFile holding the recovery-secret env var (0600).";
      };
    };

    memoryMax = lib.mkOption { type = lib.types.str; default = "512M"; description = "systemd MemoryMax."; };
  };

  config = lib.mkIf cfg.enable {
    # UDP 5483 (x0x hub) is already open on buzz-hostinger; kept declarative
    # and idempotent here so this module is self-describing.
    networking.firewall.allowedUDPPorts = [ 5483 ];

    systemd.services.x0x-control = {
      description = "x0x-control box agent — sealed orders, no shell, full receipts";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      wantedBy = [ "multi-user.target" ];
      path = [ pkgs.coreutils pkgs.bash ];
      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        ExecStartPre = [
          # fail fast (and loud, no secrets) if the seed or policy is missing
          "${pkgs.bash}/bin/bash -c 'test -f ${cfg.seedFile} || { echo \"x0x-control: seed file ${cfg.seedFile} missing — run the keygen ceremony\" >&2; exit 1; }'"
          "${pkgs.bash}/bin/bash -c 'test -f ${cfg.policyFile} || { echo \"x0x-control: policy file ${cfg.policyFile} missing\" >&2; exit 1; }'"
        ];
        ExecStart = "${loop}/bin/x0x-control-loop";
        Restart = "always";
        RestartSec = 5;
        MemoryMax = cfg.memoryMax;
        CPUQuota = "100%";
        TasksMax = 64;
        # hardening that does not break nixos-rebuild/docker children
        NoNewPrivileges = true;
        ProtectSystem = true;
        ProtectHome = true;
        PrivateTmp = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        RestrictRealtime = true;
        # the loop script plus EnvironmentFile for the optional bsigner secret
        EnvironmentFile = lib.mkIf (cfg.receiptSigning.enable && cfg.receiptSigning.recEnvFile != null)
          cfg.receiptSigning.recEnvFile;
      };
    };
  };
}
