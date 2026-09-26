{ pkgs, ... }:
let
  directory = "/opt/buzz/deploy/compose";
  compose = "${pkgs.docker}/bin/docker compose -p buzz-prod -f compose.yml -f compose.hostinger.yml";
in {
  # The marker is created only after a consistent final restore and cutover checks.
  systemd.services.buzz-stack = {
    description = "skaists.buzz production services";
    wantedBy = [ "multi-user.target" ];
    after = [ "network-online.target" "docker.service" ];
    requires = [ "docker.service" ];
    wants = [ "network-online.target" ];
    unitConfig.ConditionPathExists = "${directory}/.production-enabled";
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      WorkingDirectory = directory;
      ExecStartPre = "${compose} config --quiet";
      ExecStart = "${compose} up -d --wait --wait-timeout 120";
      ExecStop = "${compose} stop";
      TimeoutStartSec = 180;
    };
  };
  systemd.services.hive-board = {
    description = "Export skaists public board";
    after = [ "buzz-stack.service" ];
    unitConfig.ConditionPathExists = "${directory}/.production-enabled";
    path = with pkgs; [ docker bash coreutils ];
    serviceConfig = {
      Type = "oneshot";
      ExecStart = "${pkgs.bash}/bin/bash ${directory}/hive/hive-board.sh";
    };
  };
  systemd.timers.hive-board = {
    wantedBy = [ "timers.target" ];
    timerConfig = { OnBootSec = "2m"; OnUnitActiveSec = "1m"; };
  };
  systemd.services.hive-public = {
    description = "Export only explicitly public skaists channels";
    after = [ "buzz-stack.service" ];
    unitConfig.ConditionPathExists = "${directory}/.production-enabled";
    path = with pkgs; [ docker bash coreutils python3 ];
    serviceConfig = {
      Type = "oneshot";
      ExecStart = "${pkgs.bash}/bin/bash ${directory}/hive-public/hive-public.sh";
    };
  };
  systemd.timers.hive-public = {
    wantedBy = [ "timers.target" ];
    timerConfig = { OnBootSec = "3m"; OnUnitActiveSec = "5m"; };
  };
}
