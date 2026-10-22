{ pkgs, ... }:
let
  # LEGACY-COMPAT: the relay door is a central server being sunset
  # (with backwards compatibility). This scope is the minimum needed to
  # finish the meter cutover on it; do not grow it.
  #
  # The door.meter scope, merged into the box policy at activation.
  # Merged (jq `*`), never overwritten: the deployed policy's exact
  # shapes (e.g. the member-restart unit) are box state this file
  # must not clobber. `*` deep-merges objects, so only the
  # scopes."door.meter" array is replaced; every other deployed scope
  # survives untouched. Policy is re-read per order; no restart needed.
  #
  # x0x-control matches arg_prefixes by string prefix, so:
  #  - no `sed`: any `s|...` prefix admits appended `e`/`w file` flags
  #    (GNU sed exec / arbitrary root write) and arbitrary upstreams.
  #    The fixed rewrite runs here at activation instead (below); the
  #    remote caller can only copy the pre-rendered file into place.
  #  - URL prefixes end in `/` so `http://172.20.0.1:8092@evil/` fails.
  #  - no `curl`: a "-" prefix admits `-o/any/path` (root file write);
  #    the busybox wget probe on buzz-net covers both 8091 and 8092.
  #  - image prefix is `busybox:` so only official busybox tags match,
  #    not an attacker-owned `busyboxX/...` repo.
  doorMeterPolicy = pkgs.writeText "door-meter-policy.json" (builtins.toJSON {
    scopes."door.meter" = [
      { argv0 = "/run/current-system/sw/bin/systemctl"; max_args = 4; arg_prefixes = [ "restart" "enable" "is-active" "door-meter" "llama-pool-fw" "door-meter-fw" "--now" ]; }
      { argv0 = "/run/current-system/sw/bin/docker"; max_args = 12; arg_prefixes = [ "run" "--rm" "--network" "buzz-prod_buzz-net" "busybox:" "wget" "-qO-" "-T" "5" "http://172.20.0.1:8092/" "http://172.20.0.1:8091/" "exec" "buzz-prod-caddy-1" "caddy" "reload" "--config" "/etc/caddy/Caddyfile" ]; }
      { argv0 = "/run/current-system/sw/bin/cp"; max_args = 2; arg_prefixes = [ "/opt/buzz/deploy/compose/Caddyfile.hostinger" ]; }
    ];
  });
  compose = "/opt/buzz/deploy/compose";
in {
  # door-meter: per-key metered gate for the llama-pool door
  # (crates/door-meter, ops/llama-pool/METERED-GATE.md). Sits between
  # Caddy (172.20.0.1:8092) and the member (172.20.0.1:8091).
  #
  # Activation installs the mesh-transferred musl binary and writes
  # keys.json from the box-local door.env (the key is hashed, never
  # printed, never in the nix store): existing door key -> capped
  # "test" account (100 MiB), plus a 1-byte probe account whose key
  # lands in /root/door-meter-probe.env (0600) for the 402 proof.
  # Secret-bearing files are created under umask 077 (no 0644 window).
  #
  # It also pre-renders the Caddy repoint with ONE fixed expression:
  # Caddyfile.hostinger.metered (member 8091 -> meter 8092) and a
  # one-time Caddyfile.hostinger.premeter backup. Cutover is then
  # `cp .../Caddyfile.hostinger.metered .../Caddyfile.hostinger`,
  # rollback the same with .premeter. Nothing is repointed here.
  system.activationScripts.doorMeter = ''
    BIN=$(ls /var/lib/x0x/data/transfers/*_door-meter 2>/dev/null | head -1)
    if [ -n "$BIN" ]; then
      install -m 0755 "$BIN" /var/lib/llama-pool/door-meter
    fi
    if [ -f /var/lib/llama-pool/door.env ]; then
      (
        umask 077
        set -a; . /var/lib/llama-pool/door.env; set +a
        H=$(printf %s "$POOL_KEY" | ${pkgs.coreutils}/bin/sha256sum | cut -d' ' -f1)
        PROBE="probe-$(date +%s)"
        PH=$(printf %s "$PROBE" | ${pkgs.coreutils}/bin/sha256sum | cut -d' ' -f1)
        printf '[{"key_sha256":"%s","account":"test","cap_bytes":104857600},{"key_sha256":"%s","account":"probe","cap_bytes":1}]\n' "$H" "$PH" > /var/lib/llama-pool/keys.json
        chmod 600 /var/lib/llama-pool/keys.json
        echo "PROBE_KEY=$PROBE" > /root/door-meter-probe.env
        chmod 600 /root/door-meter-probe.env
      )
    fi
    if [ -f ${compose}/Caddyfile.hostinger ]; then
      [ -f ${compose}/Caddyfile.hostinger.premeter ] || cp -p ${compose}/Caddyfile.hostinger ${compose}/Caddyfile.hostinger.premeter
      ${pkgs.gnused}/bin/sed 's|reverse_proxy 172.20.0.1:8091 {|reverse_proxy 172.20.0.1:8092 {|' ${compose}/Caddyfile.hostinger > ${compose}/Caddyfile.hostinger.metered.tmp \
        && mv ${compose}/Caddyfile.hostinger.metered.tmp ${compose}/Caddyfile.hostinger.metered
    fi
    # door.deploy's cp source: a root-only staging dir (replaces the old
    # world-writable /tmp/ prefix, which admitted /tmp/../anywhere).
    install -d -m 0700 -o root -g root /var/lib/x0x-control/stage
    if [ -f /var/lib/x0x-control/policy.json ]; then
      # umask before create (no world-readable window); mv only on a
      # successful merge, so a jq failure can never truncate the policy.
      ( umask 077
        ${pkgs.jq}/bin/jq -s '.[0] * .[1]' /var/lib/x0x-control/policy.json ${doorMeterPolicy} > /var/lib/x0x-control/policy.json.tmp \
          && mv /var/lib/x0x-control/policy.json.tmp /var/lib/x0x-control/policy.json \
          || rm -f /var/lib/x0x-control/policy.json.tmp )
    fi
  '';

  # Container -> meter hop, same proven pattern as llama-pool-fw
  # (iptables-backend firewall: extraInputRules is silently dead).
  systemd.services."door-meter-fw" = {
    description = "door-meter: accept buzz-net containers to meter 8092";
    after = [ "firewall.service" "docker.service" ];
    wants = [ "firewall.service" ];
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      ExecStart = "${pkgs.bash}/bin/bash -c '${pkgs.iptables}/bin/iptables -w -C nixos-fw -s 172.20.0.0/16 -p tcp --dport 8092 -j nixos-fw-accept 2>/dev/null || ${pkgs.iptables}/bin/iptables -w -I nixos-fw 1 -s 172.20.0.0/16 -p tcp --dport 8092 -j nixos-fw-accept'";
    };
  };

  systemd.services."door-meter" = {
    description = "door-meter: per-key metered gate for the llama-pool door";
    after = [ "network-online.target" "llama-server-hostinger.service" "door-meter-fw.service" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];
    unitConfig.ConditionPathExists = "/var/lib/llama-pool/keys.json";
    serviceConfig = {
      Type = "simple";
      ExecStart = "/var/lib/llama-pool/door-meter --listen 172.20.0.1:8092 --upstream 172.20.0.1:8091 --keys /var/lib/llama-pool/keys.json --meter /var/lib/llama-pool/meter.jsonl";
      Restart = "always";
      RestartSec = 3;
      MemoryMax = "256M";
      NoNewPrivileges = true;
      PrivateTmp = true;
    };
  };
}
