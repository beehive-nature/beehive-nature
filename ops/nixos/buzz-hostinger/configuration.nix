{ modulesPath, pkgs, ... }:
{
  imports = [ (modulesPath + "/profiles/qemu-guest.nix") ./buzz-services.nix ];
  system.stateVersion = "26.05";
  networking.hostName = "buzz-hostinger";
  boot.loader.grub.enable = true;
  boot.loader.grub.device = "/dev/sda";
  boot.initrd.availableKernelModules = [ "ata_piix" "uhci_hcd" "virtio_pci" "virtio_scsi" "sd_mod" "sr_mod" ];
  fileSystems."/" = {
    device = "/dev/disk/by-uuid/f222513b-ded1-49fa-b591-20ce86a2fe7f";
    fsType = "ext4";
  };
  networking.useDHCP = false;
  networking.usePredictableInterfaceNames = false;
  networking.useNetworkd = true;
  systemd.network.networks."10-uplink" = {
    # Bind to hardware identity so interface naming cannot strand a reboot.
    matchConfig = { MACAddress = "b6:e8:d4:c3:b0:f6"; };
    address = [ "2.25.245.161/24" "2a02:4780:95:222e::1/48" ];
    routes = [
      { Gateway = "2.25.245.254"; }
      { Gateway = "2a02:4780:95::1"; }
    ];
    networkConfig = { DHCP = "no"; DNS = [ "153.92.2.6" "1.1.1.1" "8.8.4.4" ]; };
  };
  services.resolved = {
    enable = true;
    settings.Resolve = { MulticastDNS = false; LLMNR = false; };
  };
  services.qemuGuest.enable = true;
  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "prohibit-password";
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };
  users.users.root.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICPrhK4FyXrRJFQmg44QnVZeb++c8ZyKmuIGDy8MX9jG buzz-hostinger-admin-laptop"
  ];
  networking.firewall.enable = true;
  networking.firewall.allowedTCPPorts = [ 22 80 443 ];
  virtualisation.docker = {
    enable = true;
    daemon.settings = {
      log-driver = "json-file";
      log-opts = { max-size = "10m"; max-file = "3"; };
      live-restore = true;
    };
  };
  environment.systemPackages = with pkgs; [ git curl jq rsync restic docker-compose htop ];
  services.journald.extraConfig = "SystemMaxUse=256M\nRuntimeMaxUse=64M\nMaxRetentionSec=14day";
  nix.settings.experimental-features = [ "nix-command" "flakes" ];
  nix.settings.max-jobs = 2;
  nix.settings.cores = 4;
  nix.gc = { automatic = true; dates = "weekly"; options = "--delete-older-than 14d"; };
  system.autoUpgrade.enable = false;
  time.timeZone = "UTC";
}
