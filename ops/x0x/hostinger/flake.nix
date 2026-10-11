{
  description = "Skaists relay and bounded Buzz workers on Hostinger KVM";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/c5c4a43b0e8056328ec4529f735cabdb8f1942bb";
  outputs = { nixpkgs, ... }: {
    nixosConfigurations.buzz-hostinger = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [ ./configuration.nix ];
    };
  };
}
